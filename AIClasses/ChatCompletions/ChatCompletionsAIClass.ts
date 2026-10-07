import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { AIToolCall } from "AIClasses/AIToolCall";
import { fromString as aiToolFromString } from "Enums/AITool";
import type { IAIToolDefinition } from "AIClasses/ToolDefinitions/IAIToolDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import { Exception } from "Helpers/Exception";
import { parseToolCalls, parseFunctionResponse } from "Helpers/ResponseHelper";
import type {
    ChatCompletionToolCallDelta,
    ChatCompletionStreamChunk,
    ChatCompletionToolDefinition,
    ChatCompletionMessage,
    ChatCompletionContentPart
} from "./ChatCompletionsTypes";

export abstract class ChatCompletionsAIClass extends BaseAIClass {

    private readonly STOP_REASON_TOOL_CALLS: string = "tool_calls";

    /** The Chat Completions endpoint for this provider. */
    protected abstract get apiUrl(): string;

    /** Max output tokens to request. Subclasses may override. */
    protected get maxTokens(): number {
        return 16384;
    }

    // Accumulation state for streaming tool calls, keyed in the order the calls started
    private accumulatedToolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
    // Keys for which toolCallStarted has already been emitted this stream
    private startedToolCalls: Set<number> = new Set();
    // Maps the index a server sent to the key of the call it is currently streaming
    private toolCallKeys: Map<number, number> = new Map();
    private latestToolCallKey: number | undefined = undefined;

    public async* streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown> {
        const messages = await this.buildMessages(conversation);
        const tools = this.getTools();

        const requestBody: Record<string, unknown> = {
            model: this.model(),
            max_tokens: this.maxTokens,
            messages: messages,
            stream: true
        };

        // Only include tools if there are definitions
        if (tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = this.buildChatCompletionsToolChoice();
            // Some servers (e.g. llama.cpp) only make parallel calls when asked, servers that can't simply ignore it
            requestBody.parallel_tool_calls = true;
        }

        const headers = {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
        };

        yield* this.streamingService.streamRequest(
            this.apiUrl,
            requestBody,
            (chunk: string) => this.parseStreamChunk(chunk),
            headers,
            (error) => this.extractRetryDelay(error)
        );
    }

    private async buildMessages(conversation: Conversation): Promise<ChatCompletionMessage[]> {
        this.accumulatedToolCalls.clear();
        this.startedToolCalls.clear();
        this.toolCallKeys.clear();
        this.latestToolCallKey = undefined;

        // Refresh file cache only if conversation has attachments
        if (conversation.hasAttachments()) {
            await this.aiFileService.refreshCache();
        }

        const systemPrompt = `${this.systemPrompt}\n\n${this.userInstruction}`;
        const messages = await this.extractContents(conversation.contents);

        return [
            { role: "system", content: systemPrompt },
            ...messages
        ];
    }

    protected parseStreamChunk(chunk: string): IStreamChunk {
        try {
            // Chat Completions sends "[DONE]" as the final message
            if (chunk.trim() === "[DONE]") {
                return { content: "", isComplete: true };
            }

            const data = JSON.parse(chunk) as ChatCompletionStreamChunk;

            let text = "";
            let toolCalls: AIToolCall[] | undefined = undefined;
            let isComplete = false;
            let shouldContinue = false;
            let toolCallStarted: string | undefined = undefined;

            if (!data.choices || data.choices.length === 0) {
                return { content: "", isComplete: false };
            }

            const choice = data.choices[0];

            // Handle text content
            if (typeof choice.delta.content === "string") {
                text = choice.delta.content;
            } else if (Array.isArray(choice.delta.content)) {
                // Thinking chunks are deliberately dropped for now; only the answer text is surfaced
                text = choice.delta.content
                    .filter((part): part is { type: "text"; text: string } => part.type === "text")
                    .map(part => part.text)
                    .join("");
            }

            // Handle tool call deltas
            if (choice.delta.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                    const key = this.resolveToolCallKey(tc);

                    if (!this.accumulatedToolCalls.has(key)) {
                        // New tool call starting
                        this.accumulatedToolCalls.set(key, {
                            id: tc.id || "",
                            name: tc.function?.name || "",
                            args: tc.function?.arguments || ""
                        });
                    } else {
                        // Accumulate arguments for existing tool call
                        const existing = this.accumulatedToolCalls.get(key)!;
                        if (tc.id) existing.id = tc.id;
                        if (tc.function?.name) existing.name += tc.function.name;
                        if (tc.function?.arguments) existing.args += tc.function.arguments;
                    }

                    // Some providers stream the function name fragmented across multiple deltas rather than
                    // whole in the first one, so fire "started" the moment the accumulated name first becomes non-empty.
                    const accumulated = this.accumulatedToolCalls.get(key)!;
                    if (!this.startedToolCalls.has(key) && accumulated.name) {
                        this.startedToolCalls.add(key);
                        toolCallStarted = accumulated.name;
                    }
                }
            }

            // Handle completion
            if (choice.finish_reason) {
                isComplete = true;

                if (choice.finish_reason === this.STOP_REASON_TOOL_CALLS) {
                    shouldContinue = true;

                    // Finalize every accumulated tool call, in the order they started
                    toolCalls = [];
                    for (const accumulatedToolCall of this.accumulatedToolCalls.values()) {
                        if (!accumulatedToolCall.name) {
                            continue;
                        }
                        try {
                            // A tool without arguments may stream none
                            const args = JSON.parse(accumulatedToolCall.args || "{}") as Record<string, unknown>;
                            toolCalls.push(new AIToolCall(
                                aiToolFromString(accumulatedToolCall.name),
                                args,
                                accumulatedToolCall.id || undefined,
                                undefined
                            ));
                        } catch (error) {
                            Exception.log(error);
                        }
                    }

                    this.accumulatedToolCalls.clear();
                    this.toolCallKeys.clear();
                    this.latestToolCallKey = undefined;
                }
            }

            return {
                content: text,
                isComplete: isComplete,
                toolCalls: toolCalls,
                shouldContinue: shouldContinue,
                toolCallStarted: toolCallStarted
            };
        } catch (error) {
            return this.createErrorChunk(error);
        }
    }

    /**
     * Resolves which accumulated call a delta belongs to. Local servers vary in how they stream parallel
     * calls: some omit the index, others reuse index 0 for every call, so a delta that clearly starts a
     * new call (a different id, or a name after arguments have already streamed) gets a key of its own.
     */
    private resolveToolCallKey(delta: ChatCompletionToolCallDelta): number {
        const currentKey = delta.index !== undefined ? this.toolCallKeys.get(delta.index) : this.latestToolCallKey;
        const current = currentKey !== undefined ? this.accumulatedToolCalls.get(currentKey) : undefined;

        const startsNewCall = !current
            || (!!delta.id && !!current.id && delta.id !== current.id)
            || (!!delta.function?.name && current.args !== "");

        if (currentKey !== undefined && !startsNewCall) {
            return currentKey;
        }

        const newKey = this.accumulatedToolCalls.size;
        if (delta.index !== undefined) {
            this.toolCallKeys.set(delta.index, newKey);
        }
        this.latestToolCallKey = newKey;
        return newKey;
    }

    protected async extractContents(conversationContent: ConversationContent[]): Promise<ChatCompletionMessage[]> {
        const results: ChatCompletionMessage[] = [];

        for (const content of this.filterConversationContents(conversationContent)) {
            const contentToExtract = content.content ?? "";

            // Case 1: Assistant message with tool calls
            if (content.toolCalls) {
                const parsedContent = parseToolCalls(content.toolCalls);

                if (parsedContent) {
                    // A native tool-call id means the call originated from this provider and
                    // can be replayed in the structured format. Otherwise (a call from another
                    // provider, or no id) fall back to legacy text so history stays coherent.
                    const isNative = parsedContent.every(storedToolCall => storedToolCall.toolCall.id
                        && storedToolCall.toolCall.id.trim() !== ""
                        && this.isNativeToolCallId(storedToolCall.toolCall.id));

                    if (isNative) {
                        // Native function calls - use proper function call format
                        results.push({
                            role: content.role,
                            content: contentToExtract || "",
                            tool_calls: parsedContent.map(storedToolCall => ({
                                id: storedToolCall.toolCall.id,
                                type: "function" as const,
                                function: {
                                    name: storedToolCall.toolCall.name,
                                    arguments: JSON.stringify(storedToolCall.toolCall.args)
                                }
                            }))
                        });
                    } else {
                        // Cross-provider function calls (from Claude/OpenAI) or no id - use legacy text format
                        const legacyText = this.convertToolCallsToText(parsedContent);
                        const combinedContent = contentToExtract.trim() !== ""
                            ? `${contentToExtract}\n\n${legacyText}`
                            : legacyText;

                        results.push({
                            role: content.role,
                            content: combinedContent
                        });
                    }
                } else {
                    results.push({
                        role: content.role,
                        content: contentToExtract.trim() !== "" ? contentToExtract : "Error parsing function call"
                    });
                }
                continue;
            }

            // Case 2: Binary file attachments
            if (content.attachments && content.attachments.length > 0) {
                const { formattedParts, uploadErrors } = await this.processAttachments<ChatCompletionContentPart>(
                    content.attachments,
                    (attachments) => this.formatBinaryFiles(attachments)
                );

                const contentParts: ChatCompletionContentPart[] = [];

                if (contentToExtract.trim() !== "") {
                    contentParts.push({ type: "text", text: contentToExtract });
                }

                contentParts.push(...formattedParts);

                for (const uploadError of uploadErrors) {
                    contentParts.push({
                        type: "text",
                        text: Exception.messageFrom(uploadError)
                    });
                }

                if (contentParts.length > 0) {
                    results.push({
                        role: content.role,
                        content: contentParts
                    });
                }
                continue;
            }

            // Case 3: Function call response (tool result)
            if (content.functionResponse) {
                const parsedContent = parseFunctionResponse(content.functionResponse);

                if (parsedContent) {
                    const isNative = parsedContent.id
                        && parsedContent.id.trim() !== ""
                        && this.isNativeToolCallId(parsedContent.id);

                    if (isNative) {
                        // Native function response - use proper format
                        results.push({
                            role: "tool",
                            content: JSON.stringify(parsedContent.functionResponse.response),
                            tool_call_id: parsedContent.id,
                            name: parsedContent.functionResponse.name
                        });
                    } else {
                        // Cross-provider function response (from Claude/OpenAI) or no id - use legacy text format
                        const legacyText = this.convertFunctionResponseToText(parsedContent);
                        results.push({
                            role: content.role,
                            content: legacyText
                        });
                    }
                } else {
                    results.push({
                        role: content.role,
                        content: content.functionResponse
                    });
                }
                continue;
            }

            // Case 4: Regular text message
            if (contentToExtract.trim() !== "") {
                results.push({
                    role: content.role,
                    content: contentToExtract
                });
            }
        }

        return results;
    }

    protected mapFunctionDefinitions(aiToolDefinitions: IAIToolDefinition[]): ChatCompletionToolDefinition[] {
        return aiToolDefinitions.map((functionDefinition) => ({
            type: "function" as const,
            function: {
                name: functionDefinition.name,
                description: functionDefinition.description,
                parameters: {
                    type: "object" as const,
                    properties: functionDefinition.parameters.properties,
                    required: functionDefinition.parameters.required
                }
            }
        }));
    }

    private buildChatCompletionsToolChoice(): string {
        return this.buildToolChoice<string>({
            auto: "auto",
            enabled: "any",
            disabled: "none"
        });
    }

    /**
     * The tools advertised to the model. Defaults to the mapped function definitions.
     * Subclasses override to inject provider-specific built-in tools (e.g. web search).
     */
    protected getTools(): ChatCompletionToolDefinition[] {
        return this.mapFunctionDefinitions(this.aiToolDefinitions);
    }

    /**
     * Whether a stored tool-call id is a native id for this provider (vs. one carried
     * over from another provider in cross-provider conversation history). Default treats
     * any non-empty id as native; providers with a known id format override this.
     */
    protected isNativeToolCallId(id: string): boolean {
        return id.trim() !== "";
    }
}

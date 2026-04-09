import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIToolCall } from "AIClasses/AIToolCall";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { fromString as aiToolFromString, AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "AIClasses/ToolDefinitions/IAIToolDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { Exception } from "Helpers/Exception";
import { MimeType, toMimeType } from "Enums/MimeType";
import { isTextFile } from "Enums/FileType";
import { MimeTypeToFileTypes } from "Enums/FileTypeMimeTypeMapping";
import { ApiError, ApiErrorType } from "Types/ApiError";
import { parseToolCall, parseFunctionResponse } from "Helpers/ResponseHelper";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import type { MistralStreamChunk, MistralToolDefinition, MistralMessage, MistralContentPart } from "./MistralTypes";
import type { MistralFileService } from "./MistralFileService";
import { Copy, replaceCopy } from "Enums/Copy";
import { MistralAgent } from "./MistralAgent";
import { AIToolResponsePayload } from "AIClasses/ToolDefinitions/AIToolResponsePayload";

export class Mistral extends BaseAIClass {

    private readonly STOP_REASON_TOOL_CALLS: string = "tool_calls";

    private readonly SUPPORTED_MIMETYPES = [
        MimeType.TEXT_PLAIN,
        MimeType.APPLICATION_PDF,
        MimeType.IMAGE_JPEG,
        MimeType.IMAGE_PNG,
        MimeType.IMAGE_GIF,
        MimeType.IMAGE_WEBP
    ];

    private readonly agent: MistralAgent = new MistralAgent();

    // Accumulation state for streaming tool calls
    private accumulatedToolCalls: Map<number, { id: string; name: string; args: string }> = new Map();

    public constructor() {
        super(AIProvider.Mistral);
    }

    public async* streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown> {
        const messages = await this.buildMessages(conversation);

        const tools = [
            {
                type: "function" as const,
                function: {
                    name: AITool.RequestWebSearch,
                    description: `Use this function when you need to search the web for current information, recent events, news, or facts that may have changed.`,
                    parameters: {
                        type: "object" as const,
                        properties: {
                            query: { type: "string", description: "The search query to look up on the web." }
                        },
                        required: ["query"]
                    }
                }
            },
            ...this.mapFunctionDefinitions(this.aiToolDefinitions)
        ];

        const requestBody: Record<string, unknown> = {
            model: this.model(),
            max_tokens: 16384,
            messages: messages,
            stream: true
        };

        // Only include tools if there are definitions
        if (tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = this.buildMistralToolChoice();
        }

        const headers = {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
        };

        yield* this.streamingService.streamRequest(
            AIProviderURL.Mistral,
            requestBody,
            (chunk: string) => this.parseStreamChunk(chunk),
            headers,
            (error) => this.extractRetryDelay(error)
        );
    }

    public async resolveToolCall(toolCall: AIToolCall): Promise<AIToolResponse | null> {
        if (toolCall.name !== AITool.RequestWebSearch) {
            return null;
        }
        const query = (toolCall.arguments as Record<string, string>).query ?? "";
        const result = await this.agent.search(query);
        return new AIToolResponse(toolCall.name, new AIToolResponsePayload({ result }), toolCall.toolId);
    }

    private async buildMessages(conversation: Conversation): Promise<MistralMessage[]> {
        this.accumulatedToolCalls.clear();

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
            // Mistral sends "[DONE]" as the final message
            if (chunk.trim() === "[DONE]") {
                return { content: "", isComplete: true };
            }

            const data = JSON.parse(chunk) as MistralStreamChunk;

            let text = "";
            let toolCall: AIToolCall | undefined = undefined;
            let isComplete = false;
            let shouldContinue = false;
            let toolCallStarted: string | undefined = undefined;

            if (!data.choices || data.choices.length === 0) {
                return { content: "", isComplete: false };
            }

            const choice = data.choices[0];

            // Handle text content
            if (choice.delta.content) {
                text = choice.delta.content;
            }

            // Handle tool call deltas
            if (choice.delta.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                    const index = tc.index ?? 0;

                    if (!this.accumulatedToolCalls.has(index)) {
                        // New tool call starting
                        this.accumulatedToolCalls.set(index, {
                            id: tc.id || "",
                            name: tc.function?.name || "",
                            args: tc.function?.arguments || ""
                        });

                        if (tc.function?.name) {
                            toolCallStarted = tc.function.name;
                        }
                    } else {
                        // Accumulate arguments for existing tool call
                        const existing = this.accumulatedToolCalls.get(index)!;
                        if (tc.id) existing.id = tc.id;
                        if (tc.function?.name) existing.name += tc.function.name;
                        if (tc.function?.arguments) existing.args += tc.function.arguments;
                    }
                }
            }

            // Handle completion
            if (choice.finish_reason) {
                isComplete = true;

                if (choice.finish_reason === this.STOP_REASON_TOOL_CALLS) {
                    shouldContinue = true;

                    // Finalize the first accumulated tool call
                    // (additional tool calls in a single response are not supported by this plugin's architecture)
                    const firstToolCall = this.accumulatedToolCalls.get(0);
                    if (firstToolCall && firstToolCall.name && firstToolCall.args) {
                        try {
                            const args = JSON.parse(firstToolCall.args) as Record<string, unknown>;
                            toolCall = new AIToolCall(
                                aiToolFromString(firstToolCall.name),
                                args as Record<string, object>,
                                firstToolCall.id || undefined,
                                undefined
                            );
                        } catch (error) {
                            Exception.log(error);
                        }
                    }

                    this.accumulatedToolCalls.clear();
                }
            }

            return {
                content: text,
                isComplete: isComplete,
                toolCall: toolCall,
                shouldContinue: shouldContinue,
                toolCallStarted: toolCallStarted
            };
        } catch (error) {
            return this.createErrorChunk(error);
        }
    }

    protected async extractContents(conversationContent: ConversationContent[]): Promise<MistralMessage[]> {
        const results: MistralMessage[] = [];

        for (const content of this.filterConversationContents(conversationContent)) {
            const contentToExtract = content.content ?? "";

            // Case 1: Assistant message with tool call
            if (content.toolCall) {
                const parsedContent = parseToolCall(content.toolCall);

                if (parsedContent) {
                    // Check if this is a cross-provider function call (has toolId in the stored format)
                    // Mistral requires IDs to be alphanumeric only (a-z, A-Z, 0-9) with length of 9
                    // If the ID doesn't match this format, it's from another provider (Claude/OpenAI)
                    const mistralIdRegex = /^[a-zA-Z0-9]{9}$/;
                    const isCrossProvider = parsedContent.toolCall.id && 
                                          !mistralIdRegex.test(parsedContent.toolCall.id);

                    if (!isCrossProvider && parsedContent.toolCall.id && parsedContent.toolCall.id.trim() !== "") {
                        // Native Mistral function call - use proper function call format
                        results.push({
                            role: Role.Assistant,
                            content: contentToExtract || "",
                            tool_calls: [{
                                id: parsedContent.toolCall.id,
                                type: "function",
                                function: {
                                    name: parsedContent.toolCall.name,
                                    arguments: JSON.stringify(parsedContent.toolCall.args)
                                }
                            }]
                        });
                    } else {
                        // Cross-provider function call (from Claude/OpenAI) or no ID - use legacy text format
                        const legacyText = this.convertToolCallToText(parsedContent);
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
                const { formattedParts, uploadErrors } = await this.processAttachments<MistralContentPart>(
                    content.attachments,
                    (attachments) => this.formatBinaryFiles(attachments)
                );

                const contentParts: MistralContentPart[] = [];

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
                    // Check if this is a cross-provider function response
                    // Mistral requires tool_call_id to be alphanumeric only (a-z, A-Z, 0-9) with length of 9
                    const mistralIdRegex = /^[a-zA-Z0-9]{9}$/;
                    const isCrossProvider = parsedContent.id && 
                                          !mistralIdRegex.test(parsedContent.id);

                    if (!isCrossProvider && parsedContent.id && parsedContent.id.trim() !== "") {
                        // Native Mistral function response - use proper format
                        results.push({
                            role: "tool",
                            content: JSON.stringify(parsedContent.functionResponse.response),
                            tool_call_id: parsedContent.id,
                            name: parsedContent.functionResponse.name
                        });
                    } else {
                        // Cross-provider function response (from Claude/OpenAI) or no ID - use legacy text format
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

    protected mapFunctionDefinitions(aiToolDefinitions: IAIToolDefinition[]): MistralToolDefinition[] {
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

    public formatBinaryFiles(attachments: Attachment[]): string {
        const contentParts: MistralContentPart[] = [];
        const fileService = this.aiFileService as MistralFileService;

        for (const attachment of attachments) {
            const fileID = attachment.getFileID(this.provider);
            if (!fileID) {
                continue; // Skip - upload failed, error message added in extractContents()
            }

            const mimeType = toMimeType(attachment.getMimeType());

            let isPlainText = false;
            if (MimeTypeToFileTypes[mimeType].some(fileType => isTextFile(fileType))) {
                isPlainText = true;
            }

            if (!isPlainText && !this.isSupportedMimeType(mimeType)) {
                contentParts.push({
                    type: "text",
                    text: `Unsupported mime type '${mimeType}': ${attachment.fileName}`
                });
                continue;
            }

            // Documents and text files: use signed URL via document_url
            if (isPlainText || mimeType === MimeType.APPLICATION_PDF) {
                const signedUrl = fileService.getSignedUrl(fileID);
                if (signedUrl) {
                    contentParts.push(
                        { type: "text", text: replaceCopy(Copy.AttachedFile, [attachment.fileName]) },
                        { type: "document_url", document_url: signedUrl }
                    );
                } else {
                    contentParts.push({
                        type: "text",
                        text: `Failed to get signed URL for ${attachment.fileName}`
                    });
                }
                continue;
            }

            // Images: use signed URL via image_url
            const signedUrl = fileService.getSignedUrl(fileID);
            if (signedUrl) {
                contentParts.push(
                    { type: "text", text: replaceCopy(Copy.AttachedFile, [attachment.fileName]) },
                    {
                        type: "image_url",
                        image_url: signedUrl
                    }
                );
            } else {
                contentParts.push({
                    type: "text",
                    text: `Failed to get signed URL for image ${attachment.fileName}`
                });
            }
        }

        return JSON.stringify(contentParts);
    }

    private buildMistralToolChoice(): string {
        if (this.aiToolDefinitions.length === 0) {
            return "auto";
        }

        switch (this.aiToolUsageMode) {
            case AIToolUsageMode.Auto:
                return "auto";
            case AIToolUsageMode.Enabled:
                return "any";
            case AIToolUsageMode.Disabled:
                return "none";
        }
    }

    private extractRetryDelay(error: ApiError): number | undefined {
        if (error.info.type !== ApiErrorType.RATE_LIMIT || !error.info.responseHeaders) {
            return undefined;
        }

        const retryAfter = error.info.responseHeaders.get('Retry-After') ??
                           error.info.responseHeaders.get('retry-after');
        if (!retryAfter) return undefined;

        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) return seconds;

        const date = new Date(retryAfter);
        if (!isNaN(date.getTime())) {
            const now = Date.now();
            const delayMs = date.getTime() - now;
            return Math.max(0, Math.ceil(delayMs / 1000));
        }

        return undefined;
    }

    private isSupportedMimeType(mimeType: MimeType): boolean {
        return this.SUPPORTED_MIMETYPES.includes(mimeType);
    }
}

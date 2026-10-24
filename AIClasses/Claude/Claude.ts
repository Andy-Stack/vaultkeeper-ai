import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIToolCall } from "AIClasses/AIToolCall";
import { fromString as aiToolFromString } from "Enums/AITool";
import type { IAIToolDefinition } from "AIClasses/ToolDefinitions/IAIToolDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { RawMessageStreamEvent, ContentBlockParam, Tool, TextBlockParam, ToolUnion, WebSearchTool20250305 } from '@anthropic-ai/sdk/resources/messages';
import { Exception } from "Helpers/Exception";
import { MimeType, toMimeType } from "Enums/MimeType";
import { isTextFile } from "Enums/FileType";
import { MimeTypeToFileTypes } from "Enums/FileTypeMimeTypeMapping";
import { parseToolCalls, parseFunctionResponse } from "Helpers/ResponseHelper";
import { Copy } from "Enums/Copy";
import { replaceCopy } from 'Helpers/Helpers';
import type { Thought } from "Conversations/Thought";
import type { ClaudeInputTransformation } from "./ClaudeTypes";

export class Claude extends BaseAIClass {

    private readonly STOP_REASON_TOOL_USE: string = "tool_use";
    
    private readonly SUPPORTED_MIMETYPES = [
        MimeType.TEXT_PLAIN,
        MimeType.APPLICATION_PDF,
        MimeType.IMAGE_JPEG,
        MimeType.IMAGE_PNG,
        MimeType.IMAGE_GIF,
        MimeType.IMAGE_WEBP
    ];

    protected get supportedMimeTypes(): MimeType[] {
        return this.SUPPORTED_MIMETYPES;
    }

    // The content block being streamed, built exactly as Claude sends it so it can be sent back unchanged
    private currentBlock: Record<string, unknown> | null = null;
    private currentBlockJson: string = "";

    public constructor() {
        super(AIProvider.Claude);
    }

    public async* streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown> {
        
        this.currentBlock = null;
        this.currentBlockJson = "";
        this.resetThought();

        // Refresh file cache only if conversation has attachments
        if (conversation.hasAttachments()) {
            await this.aiFileService.refreshCache();
        }

        // Build system prompt and convert to array with cache control
        const systemPromptText = `${this.systemPrompt}\n\n${this.userInstruction}`;
        const systemPrompt: TextBlockParam[] = [
            {
                type: "text",
                text: systemPromptText,
                cache_control: { type: "ephemeral" }
            }
        ];

        const messages = this.addCacheControlToMessages(
            await this.extractContents(conversation.contents));

        const tools = this.getTools();

        const requestBody: Record<string, unknown> = {
            model: this.model(),
            max_tokens: 64000,
            system: systemPrompt,
            messages: messages,
            tools: tools,
            tool_choice: this.buildClaudeToolChoice(),
            // Drop thinking blocks whose earlier history changed (e.g. settings altered the tools) instead of rejecting the request
            thinking: { type: "adaptive", display: "summarized", block_binding: { prefix_mismatch_behavior: "drop_block" } },
            stream: true
        };

        const effort = this.effort();
        if (effort) {
            requestBody.output_config = { effort };
        }

        // Additional headers for Claude API
        const headers = {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "files-api-2025-04-14,thinking-binding-controls-2026-08-01",
            "anthropic-dangerous-direct-browser-access": "true"
        };

        yield* this.streamingService.streamRequest(
            AIProviderURL.Claude,
            requestBody,
            (chunk: string) => this.parseStreamChunk(chunk),
            headers,
            (error) => this.extractRetryDelay(error)
        );
    }

    protected parseStreamChunk(chunk: string): IStreamChunk {
        try {
            const data = JSON.parse(chunk) as RawMessageStreamEvent;

            let text = "";
            let thought = "";
            let toolCalls: AIToolCall[] | undefined = undefined;
            let isComplete = false;
            let shouldContinue = false;
            let completedThought: Thought | undefined = undefined;
            let providerBlocks: unknown[] | undefined = undefined;

            if (data.type === "message_start") {
                this.logDroppedThinkingBlocks(data.message as { input_transformations?: ClaudeInputTransformation[] });
            }

            if (data.type === "content_block_start") {
                this.currentBlock = { ...data.content_block };
                this.currentBlockJson = "";

                if (data.content_block.type === "tool_use") {
                    return {
                        content: "",
                        isComplete: false,
                        toolCallStarted: data.content_block.name
                    };
                }
            }

            if (data.type === "content_block_delta") {
                const delta = data.delta;
                switch (delta.type) {
                    case "text_delta":
                        text = delta.text;
                        this.appendToCurrentBlock("text", delta.text);
                        break;
                    case "citations_delta":
                        if (this.currentBlock) {
                            this.currentBlock.citations = [...(this.currentBlock.citations as unknown[] | null ?? []), delta.citation];
                        }
                        break;
                    case "thinking_delta":
                        thought = this.appendThought(delta.thinking);
                        this.appendToCurrentBlock("thinking", delta.thinking);
                        break;
                    case "signature_delta":
                        this.appendToCurrentBlock("signature", delta.signature);
                        break;
                    case "input_json_delta":
                        this.currentBlockJson += delta.partial_json;
                        break;
                }
            }

            // Each finished block is kept for replay, and tool calls and thoughts are taken from it
            if (data.type === "content_block_stop" && this.currentBlock) {
                const block = this.finishCurrentBlock();

                if (block) {
                    providerBlocks = [block];

                    if (block.type === "tool_use") {
                        toolCalls = [new AIToolCall(
                            aiToolFromString(block.name as string),
                            block.input as Record<string, unknown>,
                            block.id as string,
                            undefined  // thoughtSignature not used by Claude
                        )];
                    } else if (block.type === "thinking") {
                        completedThought = this.completeThought();
                    }
                }
            }

            // Handle message_delta - check for completion
            if (data.type === "message_delta") {
                const deltaEvent = data;
                const stopReason = deltaEvent.delta.stop_reason;
                if (stopReason) {
                    isComplete = true;
                    shouldContinue = stopReason === this.STOP_REASON_TOOL_USE;
                }
            }

            // Handle message_stop - mark as complete
            if (data.type === "message_stop") {
                isComplete = true;
            }

            return {
                content: text,
                isComplete: isComplete,
                toolCalls: toolCalls,
                shouldContinue: shouldContinue,
                thought: thought,
                completedThought: completedThought,
                providerBlocks: providerBlocks
            };
        } catch (error) {
            return this.createErrorChunk(error);
        }
    }

    protected async extractContents(conversationContent: ConversationContent[]): Promise<{ role: Role; content: ContentBlockParam[]; }[]> {
        const results = [];

        for (const content of conversationContent) {
            const providerBlocks = this.ownProviderBlocks(content);
            if (providerBlocks) {
                results.push({ role: Role.Assistant, content: providerBlocks as ContentBlockParam[] });
                continue;
            }

            const contentBlocks: ContentBlockParam[] = [];
            const contentToExtract = content.content ?? "";

            if (contentToExtract.trim() !== "" && !content.functionResponse && (!content.attachments || content.attachments.length === 0)) {
                contentBlocks.push({
                    type: "text",
                    text: contentToExtract
                });
            }

            // Add every function call made in the turn
            if (content.toolCalls) {
                const parsedContent = parseToolCalls(content.toolCalls);

                if (parsedContent) {
                    if (parsedContent.every(storedToolCall => storedToolCall.toolCall.id && storedToolCall.toolCall.id.trim() !== "")) {
                        contentBlocks.push(...parsedContent.map(storedToolCall => ({
                            type: "tool_use" as const,
                            id: storedToolCall.toolCall.id,
                            name: storedToolCall.toolCall.name,
                            input: storedToolCall.toolCall.args
                        })));
                    } else {
                        contentBlocks.push({
                            type: "text",
                            text: this.convertToolCallsToText(parsedContent)
                        });
                    }
                } else {
                    contentBlocks.push({
                        type: "text",
                        text: "Error parsing function call"
                    });
                }
            }

            // Add binary file attachments if present
            if (content.attachments && content.attachments.length > 0) {
                const { formattedParts, uploadErrors } = await this.processAttachments<ContentBlockParam>(
                    content.attachments,
                    (attachments) => this.formatBinaryFiles(attachments)
                );

                contentBlocks.push(...formattedParts);

                for (const uploadError of uploadErrors) {
                    contentBlocks.push({
                        type: "text",
                        text: Exception.messageFrom(uploadError)
                    });
                }
            }

            // Add function response if present
            if (content.functionResponse) {
                const parsedContent = parseFunctionResponse(content.functionResponse);

                if (parsedContent) {
                    if (parsedContent.id && parsedContent.id.trim() !== "") {
                        contentBlocks.push({
                            type: "tool_result",
                            tool_use_id: parsedContent.id,
                            content: JSON.stringify(parsedContent.functionResponse.response)
                        });
                    } else {
                        contentBlocks.push({
                            type: "text",
                            text: this.convertFunctionResponseToText(parsedContent)
                        });
                    }
                } else {
                    contentBlocks.push({
                        type: "text",
                        text: content.functionResponse
                    });
                }
            }

            results.push({
                role: content.role,
                content: contentBlocks
            });
        }

        // Results for every call in a turn must share a single user message
        return this.mergeConsecutiveRoles(results.filter(message => message.content.length > 0),
            (target, source) => target.content = [...target.content, ...source.content]);
    }

    private appendToCurrentBlock(field: string, text: string) {
        if (this.currentBlock) {
            this.currentBlock[field] = `${this.currentBlock[field] as string | undefined ?? ""}${text}`;
        }
    }

    // Tool inputs stream as JSON, a block whose input can't be parsed is discarded with its tool call
    private finishCurrentBlock(): Record<string, unknown> | undefined {
        const block = this.currentBlock!;
        const json = this.currentBlockJson;
        this.currentBlock = null;
        this.currentBlockJson = "";

        if (json === "") {
            return block;
        }
        try {
            return { ...block, input: JSON.parse(json) as unknown };
        } catch (error) {
            Exception.log(error);
            return undefined;
        }
    }

    private logDroppedThinkingBlocks(message: { input_transformations?: ClaudeInputTransformation[] }) {
        for (const transformation of message.input_transformations ?? []) {
            if (transformation.type === "thinking_dropped") {
                Exception.warn(`Claude dropped thinking block at ${transformation.path}: ${transformation.reason}`);
            }
        }
    }

    protected mapFunctionDefinitions(aiToolDefinitions: IAIToolDefinition[]): Tool[] {
        return aiToolDefinitions.map((functionDefinition) => ({
            name: functionDefinition.name,
            description: functionDefinition.description,
            input_schema: {
                type: "object" as const,
                properties: functionDefinition.parameters.properties,
                required: functionDefinition.parameters.required
            }
        }));
    }

    protected formatBinaryFiles(attachments: Attachment[]): Promise<string> {
        const contentBlocks = attachments.flatMap(attachment => {
            const fileID = attachment.getFileID(this.provider);
            if (!fileID) {
                return []; // Skip - upload failed, error message added in extractContents()
            }

            const mimeType = toMimeType(attachment.getMimeType());

            let isPlainText = false;

            // This content can be sent up with the 'MimeType.TEXT_PLAIN' mime type
            if (MimeTypeToFileTypes[mimeType].some(fileType => isTextFile(fileType))) {
                isPlainText = true;
            }

            if (!isPlainText && !this.isSupportedMimeType(mimeType)) {
                return [{ type: "text", text: `User attempted to share a file with an unsupported mime type '${mimeType}': ${attachment.fileName}` }];
            }

            return [
                {type: "text", text: replaceCopy(Copy.AttachedFile, [attachment.fileName]) },
                {
                    type: isPlainText || mimeType === MimeType.APPLICATION_PDF ? "document" : "image",
                    source: {
                        type: "file",
                        file_id: fileID
                    }
                }
            ];
        });
        return Promise.resolve(JSON.stringify(contentBlocks));
    }

    // Adds cache control to the last tool in the tools array.
    private addCacheControlToTools(tools: ToolUnion[]): ToolUnion[] {
        if (tools.length === 0) {
            return tools;
        }

        const cachedTools = [...tools];
        const lastIndex = cachedTools.length - 1;

        cachedTools[lastIndex] = {
            ...cachedTools[lastIndex],
            cache_control: { type: "ephemeral" }
        };

        return cachedTools;
    }

    // Adds cache control to the last content block of the second-to-last message.
    private addCacheControlToMessages(
        messages: { role: Role; content: ContentBlockParam[]; }[]
    ): { role: Role; content: ContentBlockParam[]; }[] {
        if (messages.length < 2) {
            return messages;
        }

        const cachedMessages = messages.map(msg => ({
            ...msg,
            content: [...msg.content]
        }));

        const secondToLastIndex = cachedMessages.length - 2;
        const secondToLastMessage = cachedMessages[secondToLastIndex];

        const contentLength = secondToLastMessage.content.length;
        if (contentLength === 0) {
            return messages;
        }

        const lastContentIndex = contentLength - 1;
        const lastContentBlock = secondToLastMessage.content[lastContentIndex];

        // Thinking blocks can't be cached, which only happens if a replayed turn ended in thought
        if (lastContentBlock.type === "thinking" || lastContentBlock.type === "redacted_thinking") {
            return messages;
        }

        secondToLastMessage.content[lastContentIndex] = {
            ...lastContentBlock,
            cache_control: { type: "ephemeral" }
        };

        return cachedMessages;
    }

    private getTools(): ToolUnion[] {
        if (this.settingsService.settings.enableWebSearch) {
            const webSearchTool: WebSearchTool20250305 = {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 5
            };

            return this.addCacheControlToTools([
                webSearchTool, ...this.mapFunctionDefinitions(this.aiToolDefinitions)]);
        }
        return this.addCacheControlToTools(this.mapFunctionDefinitions(this.aiToolDefinitions));
    }

    private buildClaudeToolChoice(): { type: string } {
        return this.buildToolChoice<{ type: string }>({
            auto: { type: "auto" },
            enabled: { type: "any" },
            disabled: { type: "none" }
        });
    }
}
import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { fromString as aiFunctionFromString } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { RawMessageStreamEvent, ContentBlockParam, Tool, TextBlockParam, ToolUnion, WebSearchTool20250305 } from '@anthropic-ai/sdk/resources/messages';
import { Exception } from "Helpers/Exception";
import { MimeType, toMimeType } from "Enums/MimeType";
import { isTextFile } from "Enums/FileType";
import { MimeTypeToFileTypes } from "Enums/FileTypeMimeTypeMapping";
import { ApiError, ApiErrorType } from "Types/ApiError";

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

    private accumulatedFunctionName: string | null = null;
    private accumulatedFunctionArgs: string = "";
    private accumulatedFunctionId: string | null = null;

    public constructor() {
        super(AIProvider.Claude);
    }

    public async* streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown> {
        
        this.accumulatedFunctionName = null;
        this.accumulatedFunctionArgs = "";
        this.accumulatedFunctionId = null;

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

        const webSearchTool: WebSearchTool20250305 = {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5
        };

        const tools: ToolUnion[] = this.addCacheControlToTools([
            webSearchTool, ...this.mapFunctionDefinitions(this.toolDefinitions)]);

        const requestBody = {
            model: this.settingsService.settings.model,
            max_tokens: 16384,
            system: systemPrompt,
            messages: messages,
            tools: tools,
            stream: true
        };

        // Additional headers for Claude API
        const headers = {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "files-api-2025-04-14",
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
            let functionCall: AIFunctionCall | undefined = undefined;
            let isComplete = false;
            let shouldContinue = false;

            // Handle content_block_start - detect tool_use blocks
            if (data.type === "content_block_start") {
                const startEvent = data;
                if (startEvent.content_block.type === "tool_use") {
                    const toolBlock = startEvent.content_block;
                    this.accumulatedFunctionName = toolBlock.name || null;
                    this.accumulatedFunctionArgs = "";
                    this.accumulatedFunctionId = toolBlock.id || null;
                }
            }

            // Handle content_block_delta - accumulate text or tool arguments
            if (data.type === "content_block_delta") {
                const deltaEvent = data;
                if (deltaEvent.delta.type === "text_delta") {
                    const textDelta = deltaEvent.delta;
                    text = textDelta.text || "";
                } else if (deltaEvent.delta.type === "input_json_delta") {
                    const inputDelta = deltaEvent.delta;
                    this.accumulatedFunctionArgs += inputDelta.partial_json || "";
                }
            }

            // Handle content_block_stop - finalize tool calls
            if (data.type === "content_block_stop") {
                if (this.accumulatedFunctionName && this.accumulatedFunctionArgs) {
                    try {
                        const args = JSON.parse(this.accumulatedFunctionArgs) as Record<string, unknown>;
                        functionCall = new AIFunctionCall(
                            aiFunctionFromString(this.accumulatedFunctionName),
                            args as Record<string, object>,
                            this.accumulatedFunctionId || undefined,
                            undefined  // thoughtSignature not used by Claude
                        );
                    } catch (error) {
                        Exception.log(error);
                    }
                    // Reset accumulation for next potential tool use
                    this.accumulatedFunctionName = null;
                    this.accumulatedFunctionArgs = "";
                    this.accumulatedFunctionId = null;
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
                functionCall: functionCall,
                shouldContinue: shouldContinue,
            };
        } catch (error) {
            return this.createErrorChunk(error);
        }
    }

    protected async extractContents(conversationContent: ConversationContent[]): Promise<{ role: Role; content: ContentBlockParam[]; }[]> {
        const results = [];

        for (const content of this.filterConversationContents(conversationContent)) {
            const contentBlocks: ContentBlockParam[] = [];
            const contentToExtract = content.content ?? "";

            if (contentToExtract.trim() !== "" && !content.functionResponse && (!content.attachments || content.attachments.length === 0)) {
                contentBlocks.push({
                    type: "text",
                    text: contentToExtract
                });
            }

            // Add function call if present
            if (content.functionCall) {
                const parsedContent = this.parseFunctionCall(content.functionCall);

                if (parsedContent) {
                    if (parsedContent.functionCall.id && parsedContent.functionCall.id.trim() !== "") {
                        contentBlocks.push({
                            type: "tool_use",
                            id: parsedContent.functionCall.id,
                            name: parsedContent.functionCall.name,
                            input: parsedContent.functionCall.args
                        });
                    } else {
                        contentBlocks.push({
                            type: "text",
                            text: this.convertFunctionCallToText(parsedContent)
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
                const parsedContent = this.parseFunctionResponse(content.functionResponse);

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

        return results.filter(message => message.content.length > 0);
    }

    protected mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): Tool[] {
        return aiFunctionDefinitions.map((functionDefinition) => ({
            name: functionDefinition.name,
            description: functionDefinition.description,
            input_schema: {
                type: "object" as const,
                properties: functionDefinition.parameters.properties,
                required: functionDefinition.parameters.required
            }
        }));
    }

    public formatBinaryFiles(attachments: Attachment[]): string {
        const contentBlocks = attachments.flatMap(attachment => {
            const fileID = attachment.getFileID(this.provider);
            if (!fileID) {
                return []; // Skip - upload failed, error message added in extractContents()
            }

            const mimeType = toMimeType(attachment.mimeType);

            let isPlainText = false;

            // This content can be sent up with the 'MimeType.TEXT_PLAIN' mime type
            if (MimeTypeToFileTypes[mimeType].some(fileType => isTextFile(fileType))) {
                isPlainText = true;
            }

            if (!isPlainText && !this.isSupportedMimeType(mimeType)) {
                return [{ type: "text", text: `Unsupported mime type '${mimeType}': ${attachment.fileName}` }];
            }

            return [
                {type: "text", text: `Binary data for ${attachment.fileName} follows in next message` },
                {
                    type: isPlainText || mimeType === MimeType.APPLICATION_PDF ? "document" : "image",
                    source: {
                        type: "file",
                        file_id: fileID
                    }
                }
            ];
        });
        return JSON.stringify(contentBlocks);
    }

    private extractRetryDelay(error: ApiError): number | undefined {
        if (error.info.type !== ApiErrorType.RATE_LIMIT || !error.info.responseHeaders) {
            return undefined;
        }

        const retryAfter = error.info.responseHeaders.get('Retry-After');
        if (!retryAfter) return undefined;

        // Try parsing as seconds (number)
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) return seconds;

        // Try parsing as HTTP date
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

        secondToLastMessage.content[lastContentIndex] = {
            ...lastContentBlock,
            cache_control: { type: "ephemeral" }
        } as ContentBlockParam;

        return cachedMessages;
    }
}
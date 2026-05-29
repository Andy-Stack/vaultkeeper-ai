import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { ConversationContent } from "Conversations/ConversationContent";
import type { Attachment } from "Conversations/Attachment";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIToolCall } from "AIClasses/AIToolCall";
import { fromString as aiToolFromString } from "Enums/AITool";
import type { IAIToolDefinition } from "AIClasses/ToolDefinitions/IAIToolDefinition";
import type { ResponseEvent, ResponseOutputTextDelta, ResponseOutputItemAdded, ResponseOutputItemDone, ResponseErrorEvent, ResponseFailedEvent, OpenAIToolTool, ResponsesAPIInput } from "./OpenAITypes";
import { Exception } from "Helpers/Exception";
import { ApiError, ApiErrorType } from "Types/ApiError";
import { MimeType, toMimeType } from "Enums/MimeType";
import { isTextFile } from "Enums/FileType";
import { MimeTypeToFileTypes } from "Enums/FileTypeMimeTypeMapping";
import { parseToolCall, parseFunctionResponse } from "Helpers/ResponseHelper";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import { replaceCopy } from 'Helpers/Helpers';
import { Copy } from "Enums/Copy";

export class OpenAI extends BaseAIClass {

    private readonly SUPPORTED_MIMETYPES = [
        MimeType.TEXT_PLAIN,
        MimeType.APPLICATION_PDF,
        MimeType.IMAGE_JPEG,
        MimeType.IMAGE_PNG,
        MimeType.IMAGE_WEBP
    ];

    public constructor() {
        super(AIProvider.OpenAI);
    }

    public async* streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown> {

        // Refresh file cache only if conversation has attachments
        if (conversation.hasAttachments()) {
            await this.aiFileService.refreshCache();
        }

        const systemPrompt = `${this.systemPrompt}\n\n${this.userInstruction}`;

        const input = await this.extractContents(conversation.contents);

        const tools = this.getTools();

        const requestBody = {
            model: this.model(),
            instructions: systemPrompt,
            input: input,
            tools: tools,
            tool_choice: this.buildOpenAIToolChoice(),
            stream: true
        };

        const headers = {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
        };

        yield* this.streamingService.streamRequest(
            AIProviderURL.OpenAI,
            requestBody,
            (chunk: string) => this.parseStreamChunk(chunk),
            headers,
            (error) => this.extractRetryDelay(error)
        );
    }

    protected parseStreamChunk(chunk: string): IStreamChunk {
        try {
            // OpenAI Responses API sends "[DONE]" as the final message, which is not valid JSON
            if (chunk.trim() === "[DONE]") {
                return { content: "", isComplete: true };
            }

            const event = JSON.parse(chunk) as ResponseEvent;

            let text = "";
            let toolCall: AIToolCall | undefined = undefined;
            let isComplete = false;
            let shouldContinue = false;

            // Handle different event types
            switch (event.type) {
                case "response.output_text.delta": {
                    // Text content streaming
                    const deltaEvent = event as ResponseOutputTextDelta;
                    text = deltaEvent.delta;
                    break;
                }

                case "response.refusal.delta": {
                    // Model refused to respond - treat as text for now
                    const refusalEvent = event as ResponseOutputTextDelta;
                    text = refusalEvent.delta;
                    break;
                }

                case "error":
                case "response.error": {
                    const errorEvent = event as ResponseErrorEvent;
                    this.throwRetryableError(
                        errorEvent.message,
                        errorEvent.code || undefined,
                        ApiErrorType.SERVER_ERROR
                    );
                    break;
                }

                case "response.failed": {
                    const errorEvent = event as ResponseFailedEvent;
                    this.throwRetryableError(
                        errorEvent.response?.error?.message || "Response failed",
                        errorEvent.response?.error?.code || undefined,
                        ApiErrorType.SERVER_ERROR
                    );
                    break;
                }

                case "response.function_call_arguments.delta": {
                    // Function call arguments streaming - we can ignore these
                    // as we'll get the complete call in the "done" event
                    break;
                }

                case "response.function_call_arguments.done": {
                    // Function call arguments streaming - we can ignore these
                    // The complete function call info comes in response.output_item.done
                    break;
                }

                case "response.completed":
                case "response.done": {
                    // Response completed
                    isComplete = true;
                    break;
                }

                case "response.output_item.added": {
                    // Function call starting - get name immediately for early UI feedback
                    const itemAddedEvent = event as ResponseOutputItemAdded;

                    // Check if this is a function call and return tool name immediately
                    if (itemAddedEvent.item.type === "function_call" && itemAddedEvent.item.name) {
                        return {
                            content: "",
                            isComplete: false,
                            toolCallStarted: itemAddedEvent.item.name
                        };
                    }
                    break;
                }

                case "response.output_item.done": {
                    // Complete output item received - this includes function calls with name
                    const itemDoneEvent = event as ResponseOutputItemDone;

                    // Check if this is a function call
                    if (itemDoneEvent.item.type === "function_call" &&
                        itemDoneEvent.item.name &&
                        itemDoneEvent.item.arguments) {
                        try {
                            const args = JSON.parse(itemDoneEvent.item.arguments) as Record<string, unknown>;
                            toolCall = new AIToolCall(
                                aiToolFromString(itemDoneEvent.item.name),
                                args,
                                itemDoneEvent.item.call_id || itemDoneEvent.item_id,
                                undefined  // thoughtSignature not used by OpenAI
                            );
                            // When we receive a function call, we should continue the conversation
                            shouldContinue = true;
                        } catch (error) {
                            Exception.log(error);
                        }
                    }
                    break;
                }

                case "response.created":
                case "response.in_progress":
                case "response.content_part.added":
                case "response.content_part.done":
                case "response.output_text.done":
                case "response.web_search_call.in_progress":
                case "response.web_search_call.searching":
                case "response.web_search_call.completed":
                    // These events can be used for more granular tracking if needed
                    // For now, we handle content through the delta events
                    break;

                default:
                    // log in dev but just ignore unhandled cases in prod
                    Exception.log(`Unknown event type: ${event.type}`);
                    break;
            }

            return {
                content: text,
                isComplete: isComplete,
                toolCall: toolCall,
                shouldContinue: shouldContinue,
            };
        } catch (error) {
            return this.createErrorChunk(error);
        }
    }

    protected async extractContents(conversationContent: ConversationContent[]): Promise<ResponsesAPIInput[]> {
        const results: ResponsesAPIInput[] = [];

        for (const content of this.filterConversationContents(conversationContent)) {
            const contentToExtract = content.content ?? "";

            // Case 1: Assistant message with function call
            if (content.toolCall) {
                const parsedContent = parseToolCall(content.toolCall);

                if (parsedContent) {
                    // Check if function call has required id field (for OpenAI Responses API)
                    if (parsedContent.toolCall.id && parsedContent.toolCall.id.trim() !== "") {
                        // Add assistant text message if present
                        if (contentToExtract.trim() !== "") {
                            results.push({
                                role: content.role as "user" | "assistant",
                                content: contentToExtract
                            });
                        }

                        // Add function call as separate input item
                        results.push({
                            type: "function_call",
                            call_id: parsedContent.toolCall.id,
                            name: parsedContent.toolCall.name,
                            arguments: JSON.stringify(parsedContent.toolCall.args)
                        });
                    } else {
                        // No id (from other provider or legacy) - convert to text message
                        const legacyText = this.convertToolCallToText(parsedContent);
                        const messageContent = contentToExtract.trim();
                        const combinedContent = messageContent !== ""
                            ? `${messageContent}\n\n${legacyText}`
                            : legacyText;

                        results.push({
                            role: content.role as "user" | "assistant",
                            content: combinedContent
                        });
                    }
                } else {
                    // Fall back to regular message if parsing fails
                    results.push({
                        role: content.role as "user" | "assistant",
                        content: contentToExtract.trim() !== "" ? contentToExtract : "Error parsing function call"
                    });
                }
                continue;
            }

            // Case 2: Binary file attachments
            if (content.attachments && content.attachments.length > 0) {
                const { formattedParts, uploadErrors } = await this.processAttachments<ResponsesAPIInput>(
                    content.attachments,
                    (attachments) => this.formatBinaryFiles(attachments)
                );

                results.push(...formattedParts);

                for (const uploadError of uploadErrors) {
                    // OpenAI formatBinaryFiles returns array with role wrapper, so add as separate message
                    results.push({
                        role: "user",
                        content: Exception.messageFrom(uploadError)
                    });
                }
                continue;
            }

            // Case 3: Function call response
            if (content.functionResponse) {
                const parsedContent = parseFunctionResponse(content.functionResponse);

                if (parsedContent) {
                    // Check if response has required id field (for OpenAI Responses API)
                    if (parsedContent.id && parsedContent.id.trim() !== "") {
                        results.push({
                            type: "function_call_output",
                            call_id: parsedContent.id,
                            output: JSON.stringify(parsedContent.functionResponse.response)
                        });
                    } else {
                        // No id (from Gemini or legacy) - convert to text message
                        const legacyText = this.convertFunctionResponseToText(parsedContent);
                        results.push({
                            role: content.role as "user" | "assistant",
                            content: legacyText
                        });
                    }
                } else {
                    // Fall back to regular user message if parsing fails
                    results.push({
                        role: content.role as "user" | "assistant",
                        content: content.functionResponse
                    });
                }
                continue;
            }

            // Case 4: Regular text message (user or assistant)
            if (contentToExtract.trim() !== "") {
                results.push({
                    role: content.role as "user" | "assistant",
                    content: contentToExtract
                });
            }
        }

        return results;
    }

    protected mapFunctionDefinitions(aiToolDefinitions: IAIToolDefinition[]): OpenAIToolTool[] {
        return aiToolDefinitions.map((functionDefinition) => ({
            type: "function",
            name: functionDefinition.name,
            description: functionDefinition.description,
            parameters: functionDefinition.parameters
        }));
    }

    protected formatBinaryFiles(attachments: Attachment[]): string {
        const contentBlocks: unknown[] = [];

        for (const attachment of attachments) {
            const fileID = attachment.getFileID(this.provider);
            if (!fileID) {
                continue; // Skip - upload failed, error message added in extractContents()
            }

            const mimeType = toMimeType(attachment.getMimeType());

            let isPlainText = false;

            //This content can be sent up with the 'MimeType.TEXT_PLAIN' mime type
            if (MimeTypeToFileTypes[mimeType].some(fileType => isTextFile(fileType))) {
                isPlainText = true;
            }

            if (!isPlainText && !this.isSupportedMimeType(mimeType)) {
                contentBlocks.push({ type: "input_text", text: `Unsupported mime type '${mimeType}': ${attachment.fileName}` });
                continue;
            }

            contentBlocks.push(
                { type: "input_text", text: replaceCopy(Copy.AttachedFile, [attachment.fileName]) },
                {
                    type: isPlainText || mimeType === MimeType.APPLICATION_PDF ? "input_file" : "input_image",
                    file_id: fileID
                }
            );
        }

        return JSON.stringify([{
            role: "user",
            content: contentBlocks
        }]);
    }

    private getTools(): (OpenAIToolTool | { type: string })[] {
        if (this.settingsService.settings.enableWebSearch) {
            return [{
                type: "web_search"
            }, ...this.mapFunctionDefinitions(this.aiToolDefinitions)];
        }
        return this.mapFunctionDefinitions(this.aiToolDefinitions);
    }
    
    private buildOpenAIToolChoice(): string {
        // If no tools defined, fall back to auto
        if (this.aiToolDefinitions.length === 0) {
            return "auto";
        }

        switch (this.aiToolUsageMode) {
            case AIToolUsageMode.Auto:
                return "auto";
            case AIToolUsageMode.Enabled:
                return "required";
            case AIToolUsageMode.Disabled:
                return "none";
        }
    }

    private extractRetryDelay(error: ApiError): number | undefined {
        if (error.info.type !== ApiErrorType.RATE_LIMIT || !error.info.responseHeaders) {
            return undefined;
        }

        const headers = error.info.responseHeaders;

        // 1. Prefer standard Retry-After header (seconds or HTTP-date)
        const retryAfter = headers.get('retry-after');
        if (retryAfter) {
            const seconds = Number(retryAfter);
            if (!Number.isNaN(seconds)) {
                return Math.max(0, seconds);
            }
        }

        // 2. Fallback to provider-specific headers (e.g., OpenAI)
        const resetHeader =
            headers.get('x-ratelimit-reset-requests') ??
            headers.get('x-ratelimit-reset-tokens');

        if (resetHeader) {
            return this.parseDurationToSeconds(resetHeader);
        }

        return undefined;
    }

    /**
     * Parses duration strings (e.g., "15s", "600ms", "2m", "1h") into seconds.
     * Returns undefined if parsing fails.
     */
    private parseDurationToSeconds(value: string): number | undefined {
        const trimmed = value.trim();
        const numericValue = parseFloat(trimmed);
        
        if (Number.isNaN(numericValue)) {
            return undefined;
        }
        
        // Parse based on suffix
        if (trimmed.endsWith('ms')) {
            return Math.max(0, Math.ceil(numericValue / 1000));
        }
        if (trimmed.endsWith('s')) {
            return Math.max(0, numericValue);
        }
        if (trimmed.endsWith('m')) {
            return Math.max(0, numericValue * 60);
        }
        if (trimmed.endsWith('h')) {
            return Math.max(0, numericValue * 3600);
        }
        
        // Fallback: treat as raw seconds
        return Math.max(0, numericValue);
    }

    private isSupportedMimeType(mimeType: MimeType): boolean {
        return this.SUPPORTED_MIMETYPES.includes(mimeType);
    }
}
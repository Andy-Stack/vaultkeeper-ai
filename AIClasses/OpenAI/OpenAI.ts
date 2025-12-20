import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { ConversationContent } from "Conversations/ConversationContent";
import type { Attachment } from "Conversations/Attachment";
import { AIProvider, AIProviderURL, toProviderModel } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { fromString as aiFunctionFromString } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type { ResponseEvent, ResponseOutputTextDelta, ResponseOutputItemDone, ResponseErrorEvent, ResponseFailedEvent, OpenAIFunctionTool, ResponsesAPIInput } from "./OpenAITypes";
import { Exception } from "Helpers/Exception";
import { ApiErrorType } from "Types/ApiError";

export class OpenAI extends BaseAIClass {

    private readonly SUPPORTED_IMAGE_TYPES: string[] = ["image/jpeg", "image/png", "image/webp"];

    public constructor() {
        super(AIProvider.OpenAI);
    }

    public async* streamRequest(
        conversation: Conversation, allowDestructiveActions: boolean
    ): AsyncGenerator<IStreamChunk, void, unknown> {

        // Refresh file cache only if conversation has attachments
        if (conversation.hasAttachments()) {
            await this.aiFileService.refreshCache();
        }

        const systemPrompt = await this.buildSystemPrompt();

        const input = await this.extractContents(conversation.contents);

        const tools = [{
            type: "web_search"
        }, ...this.mapFunctionDefinitions(
            this.aiFunctionDefinitions.getQueryActions(allowDestructiveActions)
        )];

        const requestBody = {
            model: toProviderModel(this.settingsService.settings.model),
            instructions: systemPrompt,
            input: input,
            tools: tools,
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
            headers
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
            let functionCall: AIFunctionCall | undefined = undefined;
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

                case "response.output_item.done": {
                    // Complete output item received - this includes function calls with name
                    const itemDoneEvent = event as ResponseOutputItemDone;

                    // Check if this is a function call
                    if (itemDoneEvent.item.type === "function_call" &&
                        itemDoneEvent.item.name &&
                        itemDoneEvent.item.arguments) {
                        try {
                            const args = JSON.parse(itemDoneEvent.item.arguments) as Record<string, unknown>;
                            functionCall = new AIFunctionCall(
                                aiFunctionFromString(itemDoneEvent.item.name),
                                args as Record<string, object>,
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
                case "response.output_item.added":
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
                functionCall: functionCall,
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
            if (content.functionCall) {
                const parsedContent = this.parseFunctionCall(content.functionCall);

                if (parsedContent) {
                    // Check if function call has required id field (for OpenAI Responses API)
                    if (parsedContent.functionCall.id && parsedContent.functionCall.id.trim() !== "") {
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
                            call_id: parsedContent.functionCall.id,
                            name: parsedContent.functionCall.name,
                            arguments: JSON.stringify(parsedContent.functionCall.args)
                        });
                    } else {
                        // No id (from other provider or legacy) - convert to text message
                        const legacyText = this.convertFunctionCallToText(parsedContent);
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
                const { formattedParts, errorMessage } = await this.processAttachments<ResponsesAPIInput>(
                    content.attachments,
                    (attachments) => this.formatBinaryFiles(attachments)
                );

                results.push(...formattedParts);

                if (errorMessage) {
                    // OpenAI formatBinaryFiles returns array with role wrapper, so add as separate message
                    results.push({
                        role: "user",
                        content: errorMessage
                    });
                }
                continue;
            }

            // Case 3: Function call response
            if (content.functionResponse) {
                const parsedContent = this.parseFunctionResponse(content.functionResponse);

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

    protected mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): OpenAIFunctionTool[] {
        return aiFunctionDefinitions.map((functionDefinition) => ({
            type: "function",
            name: functionDefinition.name,
            description: functionDefinition.description,
            parameters: functionDefinition.parameters
        }));
    }

    public formatBinaryFiles(attachments: Attachment[]): string {
        const contentBlocks: unknown[] = [];

        for (const attachment of attachments) {
            // Check for uploaded file ID
            const fileID = attachment.getFileID(this.provider);
            if (!fileID) {
                // Skip - upload failed, error message added in extractContents()
                continue;
            }

            if (attachment.mimeType === "application/pdf") {
                // Use file ID format for PDFs
                contentBlocks.push({
                    type: "input_file",
                    file_id: fileID
                });
            } else {
                // Images
                if (!this.SUPPORTED_IMAGE_TYPES.includes(attachment.mimeType)) {
                    contentBlocks.push({
                        type: "input_text",
                        text: `Unsupported image format: ${attachment.fileName}`
                    });
                    continue;
                }

                // Use file ID format for images
                contentBlocks.push({
                    type: "input_image",
                    file_id: fileID
                });
            }
        }

        return JSON.stringify([{
            role: "user",
            content: contentBlocks
        }]);
    }
}
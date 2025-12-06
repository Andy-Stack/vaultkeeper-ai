import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { ConversationContent } from "Conversations/ConversationContent";
import { AIProvider, AIProviderURL, toProviderModel } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { fromString as aiFunctionFromString } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type { ResponseEvent, ResponseOutputTextDelta, ResponseFunctionCallArgumentsDone, ResponseDone, ResponseErrorEvent, ResponseFailedEvent, OpenAIFunctionTool } from "./OpenAITypes";
import { Exception } from "Helpers/Exception";
import { ApiErrorType } from "Types/ApiError";

export class OpenAI extends BaseAIClass {

    public constructor() {
        super(AIProvider.OpenAI);
    }

    public async* streamRequest(
        conversation: Conversation, allowDestructiveActions: boolean
    ): AsyncGenerator<IStreamChunk, void, unknown> {

        const systemPrompt = await this.buildSystemPrompt();

        const input = this.extractContents(conversation.contents);

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
                    // Complete function call received
                    const doneEvent = event as ResponseFunctionCallArgumentsDone;
                    const toolCall = doneEvent.call;

                    if (toolCall.type === "function" && toolCall.function) {
                        try {
                            const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
                            functionCall = new AIFunctionCall(
                                aiFunctionFromString(toolCall.function.name),
                                args as Record<string, object>,
                                toolCall.id
                            );
                            // When we receive a function call, we should continue the conversation
                            shouldContinue = true;
                        } catch (error) {
                            Exception.log(error);
                        }
                    }
                    break;
                }

                case "response.completed":
                case "response.done": {
                    // Response completed
                    isComplete = true;
                    const doneEvent = event as ResponseDone;

                    // Check if the response contains tool calls that should trigger continuation
                    if (doneEvent.response?.output) {
                        for (const outputItem of doneEvent.response.output) {
                            if (outputItem.tool_calls && outputItem.tool_calls.length > 0) {
                                shouldContinue = true;
                                break;
                            }
                        }
                    }
                    break;
                }

                case "response.created":
                case "response.in_progress":
                case "response.content_part.added":
                case "response.content_part.done":
                case "response.output_item.added":
                case "response.output_item.done":
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

    protected extractContents(conversationContent: ConversationContent[]) {
        return this.filterConversationContents(conversationContent)
            .map(content => {
                const contentToExtract = this.getContentToExtract(content);
                // Handle function call
                if (content.isFunctionCall && content.functionCall.trim() !== "") {
                    const parsedContent = this.parseFunctionCall(content.functionCall);
                    if (parsedContent) {
                        return {
                            role: content.role,
                            content: contentToExtract.trim() !== "" ? contentToExtract : null,
                            tool_calls: [
                                {
                                    id: parsedContent.functionCall.id,
                                    type: "function",
                                    function: {
                                        name: parsedContent.functionCall.name,
                                        arguments: JSON.stringify(parsedContent.functionCall.args)
                                    }
                                }
                            ]
                        };
                    } else {
                        return { // Fall back to regular message
                            role: content.role,
                            content: contentToExtract.trim() !== "" ? contentToExtract : "Error parsing function call"
                        };
                    }
                }

                // Handle function response
                if (content.isFunctionCallResponse && contentToExtract.trim() !== "") {
                    const parsedContent = this.parseFunctionResponse(contentToExtract);
                    if (parsedContent) {
                        return {
                            role: "tool",
                            tool_call_id: parsedContent.id,
                            content: JSON.stringify(parsedContent.functionResponse.response)
                        };
                    } else {
                        return { // Fall back to regular message
                            role: content.role,
                            content: contentToExtract
                        };
                    }
                }

                // Regular text message
                return {
                    role: content.role,
                    content: contentToExtract
                };
            })
            .filter(message => message.content !== "" || message.tool_calls || message.tool_call_id);
    }

    protected mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): OpenAIFunctionTool[] {
        return aiFunctionDefinitions.map((functionDefinition) => ({
            type: "function",
            name: functionDefinition.name,
            description: functionDefinition.description,
            parameters: functionDefinition.parameters
        }));
    }
}
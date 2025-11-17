import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import { StreamingService, type IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { ConversationContent } from "Conversations/ConversationContent";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { fromString as aiFunctionFromString } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { Role } from "Enums/Role";
import type { SettingsService } from "Services/SettingsService";
import type { StoredFunctionCall, StoredFunctionResponse } from "AIClasses/Schemas/AIFunctionTypes";
import { StringTools } from "Helpers/StringTools";
import type { ResponseEvent, ResponseOutputTextDelta, ResponseFunctionCallArgumentsDone, ResponseDone, OpenAIFunctionTool } from "./OpenAITypes";
import { Exception } from "Helpers/Exception";

export class OpenAI implements IAIClass {

    private readonly apiKey: string;
    private readonly aiPrompt: IPrompt = Resolve<IPrompt>(Services.IPrompt);
    private readonly settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
    private readonly streamingService: StreamingService = Resolve<StreamingService>(Services.StreamingService);
    private readonly aiFunctionDefinitions: AIFunctionDefinitions = Resolve<AIFunctionDefinitions>(Services.AIFunctionDefinitions);

    public constructor() {
        this.apiKey = this.settingsService.getApiKeyForProvider(AIProvider.OpenAI);
    }

    public async* streamRequest(
        conversation: Conversation, allowDestructiveActions: boolean, abortSignal?: AbortSignal
    ): AsyncGenerator<IStreamChunk, void, unknown> {

        const systemPrompt = [
            this.aiPrompt.systemInstruction(),
            await this.aiPrompt.userInstruction()
        ].filter(s => s).join("\n\n");

        const input = this.extractContents(conversation.contents);

        const tools = [{
            type: "web_search"
        }, ...this.mapFunctionDefinitions(
            this.aiFunctionDefinitions.getQueryActions(allowDestructiveActions)
        )];

        const requestBody = {
            model: this.settingsService.settings.model,
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
            abortSignal,
            headers
        );
    }

    private parseStreamChunk(chunk: string): IStreamChunk {
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

                case "response.error": {
                    // Error occurred during response generation
                    isComplete = true;
                    console.error("Response error:", event);
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

                case "response.output_item.added":
                case "response.output_item.done":
                    // These events can be used for more granular tracking if needed
                    // For now, we handle content through the delta events
                    break;

                default:
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
            Exception.log(error);
            return { content: "", isComplete: false, error: Exception.messageFrom(error) };
        }
    }

    private extractContents(conversationContent: ConversationContent[]) {
        return conversationContent
            .filter(content => content.content.trim() !== "" || content.functionCall.trim() !== "")
            .map(content => {
                const contentToExtract = content.role === Role.User ? content.promptContent : content.content;
                // Handle function call
                if (content.isFunctionCall && content.functionCall.trim() !== "") {
                    if (StringTools.isValidJson(content.functionCall)) {
                        try {
                            const parsedContent = JSON.parse(content.functionCall) as StoredFunctionCall;
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
                        } catch (error) {
                            Exception.log(error);
                            return { // Fall back to regular message
                                role: content.role,
                                content: contentToExtract.trim() !== "" ? contentToExtract : "Error parsing function call"
                            };
                        }
                    } else {
                        Exception.log("Invalid JSON in functionCall field");
                        return {
                            role: content.role,
                            content: contentToExtract.trim() !== "" ? contentToExtract : "Error parsing function call"
                        };
                    }
                }

                // Handle function response
                if (content.isFunctionCallResponse && contentToExtract.trim() !== "") {
                    if (StringTools.isValidJson(contentToExtract)) {
                        try {
                            const parsedContent = JSON.parse(contentToExtract) as StoredFunctionResponse;
                            return {
                                role: "tool",
                                tool_call_id: parsedContent.id,
                                content: JSON.stringify(parsedContent.functionResponse.response)
                            };
                        } catch (error) {
                            Exception.log(error);
                            return { // Fall back to regular message
                                role: content.role,
                                content: contentToExtract
                            };
                        }
                    } else {
                        Exception.log("Invalid JSON in function response content");
                        return {
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

    private mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): OpenAIFunctionTool[] {
        return aiFunctionDefinitions.map((functionDefinition) => ({
            type: "function",
            name: functionDefinition.name,
            description: functionDefinition.description,
            parameters: functionDefinition.parameters
        }));
    }
}
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import { StreamingService, type IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type VaultkeeperAIPlugin from "main";
import type { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { Role } from "Enums/Role";
import { isValidJson } from "Helpers/Helpers";
import type { SettingsService } from "Services/SettingsService";
import type { StoredFunctionCall, StoredFunctionResponse } from "AIClasses/Schemas/AIFunctionTypes";
import type { ChatCompletionChunk, ChatCompletionTool } from "openai/resources/chat/completions";

interface IToolCallAccumulator {
    id: string | null;
    name: string | null;
    arguments: string;
}

export class OpenAI implements IAIClass {

    private readonly STOP_REASON_TOOL_CALLS: string = "tool_calls";

    private readonly apiKey: string;
    private readonly aiPrompt: IPrompt = Resolve<IPrompt>(Services.IPrompt);
    private readonly plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    private readonly settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
    private readonly streamingService: StreamingService = Resolve<StreamingService>(Services.StreamingService);
    private readonly aiFunctionDefinitions: AIFunctionDefinitions = Resolve<AIFunctionDefinitions>(Services.AIFunctionDefinitions);

    // OpenAI can have multiple tool calls, so we track them by index
    private accumulatedToolCalls: Map<number, IToolCallAccumulator> = new Map();

    public constructor() {
        this.apiKey = this.settingsService.getApiKeyForProvider(AIProvider.OpenAI);
    }

    public async* streamRequest(
        conversation: Conversation, allowDestructiveActions: boolean, abortSignal?: AbortSignal
    ): AsyncGenerator<IStreamChunk, void, unknown> {
        // Reset tool call accumulation state for new request
        this.accumulatedToolCalls.clear();

        const systemPrompt = [
            this.aiPrompt.systemInstruction(),
            await this.aiPrompt.userInstruction()
        ].filter(s => s).join("\n\n");

        const messages = [
            {
                role: Role.System,
                content: systemPrompt
            },
            ...conversation.contents
            .filter(content => content.content.trim() !== "" || content.functionCall.trim() !== "")
            .map(content => {
                const contentToExtract = content.role === Role.User ? content.promptContent : content.content;
                // Handle function call
                if (content.isFunctionCall && content.functionCall.trim() !== "") {
                    if (isValidJson(content.functionCall)) {
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
                            console.error("Failed to parse function call:", error);
                            // Fall back to regular message
                            return {
                                role: content.role,
                                content: contentToExtract || "Error parsing function call"
                            };
                        }
                    } else {
                        console.error("Invalid JSON in functionCall field");
                        return {
                            role: content.role,
                            content: contentToExtract || "Error parsing function call"
                        };
                    }
                }

                // Handle function response
                if (content.isFunctionCallResponse && contentToExtract.trim() !== "") {
                    if (isValidJson(contentToExtract)) {
                        try {
                            const parsedContent = JSON.parse(contentToExtract) as StoredFunctionResponse;
                            return {
                                role: "tool",
                                tool_call_id: parsedContent.id,
                                content: JSON.stringify(parsedContent.functionResponse.response)
                            };
                        } catch (error) {
                            console.error("Failed to parse function response:", error);
                            // Fall back to regular message
                            return {
                                role: content.role,
                                content: contentToExtract
                            };
                        }
                    } else {
                        console.error("Invalid JSON in function response content");
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
            .filter(message => message.content !== "" || message.tool_calls || message.tool_call_id)
        ];

        const tools = this.mapFunctionDefinitions(
            this.aiFunctionDefinitions.getQueryActions(allowDestructiveActions)
        );

        const requestBody = {
            model: this.settingsService.settings.model,
            messages: messages,
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
            // OpenAI sends "[DONE]" as the final message, which is not valid JSON
            if (chunk.trim() === "[DONE]") {
                return { content: "", isComplete: true };
            }

            const data = JSON.parse(chunk) as ChatCompletionChunk;

            let text = "";
            let functionCall: AIFunctionCall | undefined = undefined;
            let isComplete = false;
            let shouldContinue = false;

            const choice = data.choices?.[0];
            if (!choice) {
                return { content: "", isComplete: false };
            }

            const delta = choice.delta;

            // Handle text content
            if (delta?.content) {
                text = delta.content;
            }

            // Handle tool calls - OpenAI streams them incrementally with an index
            if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                    const index = toolCall.index;

                    // Get or create accumulator for this tool call index
                    if (!this.accumulatedToolCalls.has(index)) {
                        this.accumulatedToolCalls.set(index, {
                            id: null,
                            name: null,
                            arguments: ""
                        });
                    }

                    const accumulator = this.accumulatedToolCalls.get(index)!;

                    // Accumulate tool call data
                    if (toolCall.id) {
                        accumulator.id = toolCall.id;
                    }
                    if (toolCall.function?.name) {
                        accumulator.name = toolCall.function.name;
                    }
                    if (toolCall.function?.arguments) {
                        accumulator.arguments += toolCall.function.arguments;
                    }
                }
            }

            // Check for completion
            if (choice.finish_reason) {
                isComplete = true;
                shouldContinue = choice.finish_reason === this.STOP_REASON_TOOL_CALLS;

                // If we're finishing with a tool call, create the function call object
                // For now, we'll handle the first tool call (OpenAI can have multiple)
                if (shouldContinue && this.accumulatedToolCalls.size > 0) {
                    // Get the first accumulated tool call
                    const firstToolCall = this.accumulatedToolCalls.get(0);
                    if (firstToolCall && firstToolCall.name && firstToolCall.arguments) {
                        try {
                            const args = JSON.parse(firstToolCall.arguments) as Record<string, unknown>;
                            functionCall = new AIFunctionCall(
                                firstToolCall.name,
                                args as Record<string, object>,
                                firstToolCall.id || undefined
                            );
                        } catch (error) {
                            console.error("Failed to parse accumulated tool call arguments:", error);
                        }
                    }
                }
            }

            return {
                content: text,
                isComplete: isComplete,
                functionCall: functionCall,
                shouldContinue: shouldContinue,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown parsing error";
            console.error("Failed to parse stream chunk:", message, "Chunk:", chunk);
            return { content: "", isComplete: false, error: `Failed to parse chunk: ${message}` };
        }
    }

    private mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): ChatCompletionTool[] {
        return aiFunctionDefinitions.map((functionDefinition) => ({
            type: "function",
            function: {
                name: functionDefinition.name,
                description: functionDefinition.description,
                parameters: functionDefinition.parameters
            }
        }));
    }
}

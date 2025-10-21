import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import { StreamingService, type StreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { AIProviderURL, AIProviderModel } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type AIAgentPlugin from "main";
import type { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { isValidJson } from "Helpers/Helpers";
import type { ConversationContent } from "Conversations/ConversationContent";

export class Claude implements IAIClass {

    private readonly STOP_REASON_TOOL_USE: string = "tool_use";

    private readonly apiKey: string;
    private readonly aiPrompt: IPrompt = Resolve<IPrompt>(Services.IPrompt);
    private readonly plugin: AIAgentPlugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
    private readonly streamingService: StreamingService = Resolve<StreamingService>(Services.StreamingService);
    private readonly aiFunctionDefinitions: AIFunctionDefinitions = Resolve<AIFunctionDefinitions>(Services.AIFunctionDefinitions);

    private accumulatedFunctionName: string | null = null;
    private accumulatedFunctionArgs: string = "";
    private accumulatedFunctionId: string | null = null;

    public constructor() {
        this.apiKey = this.plugin.settings.apiKey;
    }

    public async* streamRequest(
        conversation: Conversation, allowDestructiveActions: boolean, abortSignal?: AbortSignal
    ): AsyncGenerator<StreamChunk, void, unknown> {
        this.accumulatedFunctionName = null;
        this.accumulatedFunctionArgs = "";
        this.accumulatedFunctionId = null;

        const systemPrompt = [
            this.aiPrompt.systemInstruction(),
            await this.aiPrompt.userInstruction()
        ].filter(s => s).join("\n\n");

        const messages = this.extractContents(conversation.contents);

        const tools = this.mapFunctionDefinitions(
            this.aiFunctionDefinitions.getQueryActions(allowDestructiveActions)
        );

        const requestBody = {
            model: AIProviderModel.Claude,
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
            "anthropic-dangerous-direct-browser-access": "true"
        };

        yield* this.streamingService.streamRequest(
            AIProviderURL.Claude,
            requestBody,
            this.parseStreamChunk.bind(this),
            abortSignal,
            headers
        );
    }

    private parseStreamChunk(chunk: string): StreamChunk {
        try {
            const data = JSON.parse(chunk);

            let text = "";
            let functionCall: AIFunctionCall | undefined = undefined;
            let isComplete = false;
            let shouldContinue = false;

            const eventType = data.type;

            // Handle content_block_start - detect tool_use blocks
            if (eventType === "content_block_start" && data.content_block) {
                if (data.content_block.type === "tool_use") {
                    this.accumulatedFunctionName = data.content_block.name || null;
                    this.accumulatedFunctionArgs = "";
                    this.accumulatedFunctionId = data.content_block.id || null;
                }
            }

            // Handle content_block_delta - accumulate text or tool arguments
            if (eventType === "content_block_delta" && data.delta) {
                if (data.delta.type === "text_delta") {
                    text = data.delta.text || "";
                } else if (data.delta.type === "input_json_delta") {
                    this.accumulatedFunctionArgs += data.delta.partial_json || "";
                }
            }

            // Handle content_block_stop - finalize tool calls
            if (eventType === "content_block_stop") {
                if (this.accumulatedFunctionName && this.accumulatedFunctionArgs) {
                    try {
                        const args = JSON.parse(this.accumulatedFunctionArgs);
                        functionCall = new AIFunctionCall(
                            this.accumulatedFunctionName,
                            args,
                            this.accumulatedFunctionId || undefined
                        );
                    } catch (error) {
                        console.error("Failed to parse accumulated function args:", error);
                    }
                    // Reset accumulation for next potential tool use
                    this.accumulatedFunctionName = null;
                    this.accumulatedFunctionArgs = "";
                    this.accumulatedFunctionId = null;
                }
            }

            // Handle message_delta - check for completion
            if (eventType === "message_delta" && data.delta) {
                const stopReason = data.delta.stop_reason;
                if (stopReason) {
                    isComplete = true;
                    shouldContinue = stopReason === this.STOP_REASON_TOOL_USE;
                }
            }

            // Handle message_stop - mark as complete
            if (eventType === "message_stop") {
                isComplete = true;
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

    private extractContents(conversationContent: ConversationContent[]) {
        return conversationContent.filter(content => content.content.trim() !== "" || content.functionCall.trim() !== "")
            .map(content => {
                const contentBlocks: any[] = [];

                if (content.content.trim() !== "" && !content.isFunctionCallResponse) {
                    contentBlocks.push({
                        type: "text",
                        text: content.content
                    });
                }

                // Add function call if present
                if (content.isFunctionCall && content.functionCall.trim() !== "") {
                    if (isValidJson(content.functionCall)) {
                        try {
                            const parsedContent = JSON.parse(content.functionCall);
                            contentBlocks.push({
                                type: "tool_use",
                                id: parsedContent.functionCall.id,
                                name: parsedContent.functionCall.name,
                                input: parsedContent.functionCall.args
                            });
                        } catch (error) {
                            console.error("Failed to parse function call:", error);
                            // Fall back to treating as text
                            if (content.content.trim() === "") {
                                contentBlocks.push({
                                    type: "text",
                                    text: "Error parsing function call"
                                });
                            }
                        }
                    } else {
                        console.error("Invalid JSON in functionCall field");
                    }
                }

                // Add function response if present
                if (content.isFunctionCallResponse && content.content.trim() !== "") {
                    if (isValidJson(content.content)) {
                        try {
                            const parsedContent = JSON.parse(content.content);
                            contentBlocks.push({
                                type: "tool_result",
                                tool_use_id: parsedContent.id,
                                content: JSON.stringify(parsedContent.functionResponse.response)
                            });
                        } catch (error) {
                            console.error("Failed to parse function response:", error);
                            contentBlocks.push({
                                type: "text",
                                text: content.content
                            });
                        }
                    } else {
                        console.error("Invalid JSON in function response content");
                        contentBlocks.push({
                            type: "text",
                            text: content.content
                        });
                    }
                }

                return {
                    role: content.role,
                    content: contentBlocks
                };
            });
    }

    private mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): object[] {
        return aiFunctionDefinitions.map((functionDefinition) => ({
            name: functionDefinition.name,
            description: functionDefinition.description,
            input_schema: functionDefinition.parameters
        }));
    }
}

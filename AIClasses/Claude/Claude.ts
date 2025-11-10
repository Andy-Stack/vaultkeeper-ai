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
import { isValidJson } from "Helpers/Helpers";
import type { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { SettingsService } from "Services/SettingsService";
import type { RawMessageStreamEvent, ContentBlockParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import type { StoredFunctionCall, StoredFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionTypes";

export class Claude implements IAIClass {

    private readonly STOP_REASON_TOOL_USE: string = "tool_use";

    private readonly apiKey: string;
    private readonly aiPrompt: IPrompt = Resolve<IPrompt>(Services.IPrompt);
    private readonly plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    private readonly settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
    private readonly streamingService: StreamingService = Resolve<StreamingService>(Services.StreamingService);
    private readonly aiFunctionDefinitions: AIFunctionDefinitions = Resolve<AIFunctionDefinitions>(Services.AIFunctionDefinitions);

    private accumulatedFunctionName: string | null = null;
    private accumulatedFunctionArgs: string = "";
    private accumulatedFunctionId: string | null = null;

    public constructor() {
        this.apiKey = this.settingsService.getApiKeyForProvider(AIProvider.Claude);
    }

    public async* streamRequest(
        conversation: Conversation, allowDestructiveActions: boolean, abortSignal?: AbortSignal
    ): AsyncGenerator<IStreamChunk, void, unknown> {
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
            "anthropic-dangerous-direct-browser-access": "true"
        };

        yield* this.streamingService.streamRequest(
            AIProviderURL.Claude,
            requestBody,
            (chunk: string) => this.parseStreamChunk(chunk),
            abortSignal,
            headers
        );
    }

    private parseStreamChunk(chunk: string): IStreamChunk {
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
                            this.accumulatedFunctionName,
                            args as Record<string, object>,
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
            const message = error instanceof Error ? error.message : "Unknown parsing error";
            console.error("Failed to parse stream chunk:", message, "Chunk:", chunk);
            return { content: "", isComplete: false, error: `Failed to parse chunk: ${message}` };
        }
    }

    private extractContents(conversationContent: ConversationContent[]) {
        return conversationContent.filter(content => content.content.trim() !== "" || content.functionCall.trim() !== "")
            .map(content => {
                const contentBlocks: ContentBlockParam[] = [];
                const contentToExtract = content.role === Role.User ? content.promptContent : content.content;

                if (contentToExtract.trim() !== "" && !content.isFunctionCallResponse) {
                    contentBlocks.push({
                        type: "text",
                        text: contentToExtract
                    });
                }

                // Add function call if present
                if (content.isFunctionCall && content.functionCall.trim() !== "") {
                    if (isValidJson(content.functionCall)) {
                        try {
                            const parsedContent = JSON.parse(content.functionCall) as StoredFunctionCall;
                            contentBlocks.push({
                                type: "tool_use",
                                id: parsedContent.functionCall.id,
                                name: parsedContent.functionCall.name,
                                input: parsedContent.functionCall.args
                            });
                        } catch (error) {
                            console.error("Failed to parse function call:", error);
                            // Fall back to treating as text
                            if (contentToExtract.trim() === "") {
                                contentBlocks.push({
                                    type: "text",
                                    text: "Error parsing function call"
                                });
                            }
                        }
                    } else {
                        console.error("Invalid JSON in functionCall field");
                        // Fall back to treating as text
                        if (contentToExtract.trim() === "") {
                            contentBlocks.push({
                                type: "text",
                                text: "Error parsing function call"
                            });
                        }
                    }
                }

                // Add function response if present
                if (content.isFunctionCallResponse && contentToExtract.trim() !== "") {
                    if (isValidJson(contentToExtract)) {
                        try {
                            const parsedContent = JSON.parse(contentToExtract) as StoredFunctionResponse;
                            contentBlocks.push({
                                type: "tool_result",
                                tool_use_id: parsedContent.id,
                                content: JSON.stringify(parsedContent.functionResponse.response)
                            });
                        } catch (error) {
                            console.error("Failed to parse function response:", error);
                            contentBlocks.push({
                                type: "text",
                                text: contentToExtract
                            });
                        }
                    } else {
                        console.error("Invalid JSON in function response content");
                        contentBlocks.push({
                            type: "text",
                            text: contentToExtract
                        });
                    }
                }

                return {
                    role: content.role,
                    content: contentBlocks
                };
            })
            .filter(message => message.content.length > 0);
    }

    private mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): Tool[] {
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
}

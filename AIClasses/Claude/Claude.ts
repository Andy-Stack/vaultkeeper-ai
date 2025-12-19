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
import type { RawMessageStreamEvent, ContentBlockParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import { Exception } from "Helpers/Exception";

export class Claude extends BaseAIClass {

    private readonly STOP_REASON_TOOL_USE: string = "tool_use";
    private readonly SUPPORTED_IMAGE_TYPES: string[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    private accumulatedFunctionName: string | null = null;
    private accumulatedFunctionArgs: string = "";
    private accumulatedFunctionId: string | null = null;

    public constructor() {
        super(AIProvider.Claude);
    }

    public async* streamRequest(
        conversation: Conversation, allowDestructiveActions: boolean
    ): AsyncGenerator<IStreamChunk, void, unknown> {
        this.accumulatedFunctionName = null;
        this.accumulatedFunctionArgs = "";
        this.accumulatedFunctionId = null;

        // Refresh file cache only if conversation has attachments
        if (conversation.hasAttachments()) {
            await this.aiFileService.refreshCache();
        }

        const systemPrompt = await this.buildSystemPrompt();

        const messages = await this.extractContents(conversation.contents);

        const tools = [{
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5
        }, ...this.mapFunctionDefinitions(
            this.aiFunctionDefinitions.getQueryActions(allowDestructiveActions)
        )];

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
            headers
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
                // Upload all attachments and track failures
                const failedUploads: string[] = [];

                for (const attachment of content.attachments) {
                    try {
                        await this.aiFileService.uploadFile(attachment);
                    } catch (error) {
                        Exception.log(`Failed to upload ${attachment.fileName}: ${Exception.messageFrom(error)}`);
                        failedUploads.push(attachment.fileName);
                    }
                }

                // Format successfully uploaded files
                const formattedContent = this.formatBinaryFiles(content.attachments);
                const rawContent = JSON.parse(formattedContent) as ContentBlockParam[];
                contentBlocks.push(...rawContent);

                // Add error messages for failed uploads
                if (failedUploads.length > 0) {
                    contentBlocks.push({
                        type: "text",
                        text: `[Upload failed for: ${failedUploads.join(', ')}.]`
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
            // Check for uploaded file ID
            const fileID = attachment.getFileID(this.provider);
            if (!fileID) {
                // Skip - upload failed, error message added in extractContents()
                return [];
            }

            let blockType: string;
            if (attachment.mimeType === "application/pdf") {
                blockType = "document";
            } else {
                blockType = "image";
                if (!this.SUPPORTED_IMAGE_TYPES.includes(attachment.mimeType)) {
                    return [{ type: "text", text: `Unsupported image format: ${attachment.fileName}` }];
                }
            }

            return [
                {type: "text", text: attachment.fileName},
                {
                    type: blockType,
                    source: {
                        type: "file",
                        file_id: fileID
                    }
                }
            ];
        });
        return JSON.stringify(contentBlocks);
    }
}

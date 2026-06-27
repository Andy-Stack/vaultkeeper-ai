import { ChatCompletionsAIClass } from "AIClasses/ChatCompletions/ChatCompletionsAIClass";
import type { Attachment } from "Conversations/Attachment";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIToolCall } from "AIClasses/AIToolCall";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { AITool } from "Enums/AITool";
import { MimeType, toMimeType } from "Enums/MimeType";
import { isTextFile } from "Enums/FileType";
import { MimeTypeToFileTypes } from "Enums/FileTypeMimeTypeMapping";
import type { ChatCompletionToolDefinition, ChatCompletionContentPart } from "AIClasses/ChatCompletions/ChatCompletionsTypes";
import type { MistralFileService } from "./MistralFileService";
import { replaceCopy } from 'Helpers/Helpers';
import { Copy } from "Enums/Copy";
import { MistralAgent } from "./MistralAgent";
import { AIToolResponsePayload } from "AIClasses/ToolDefinitions/AIToolResponsePayload";

export class Mistral extends ChatCompletionsAIClass {

    // Mistral requires native tool-call ids to be alphanumeric only (a-z, A-Z, 0-9)
    // with length 9. An id not matching this format originates from another provider.
    private static readonly NATIVE_TOOL_CALL_ID = /^[a-zA-Z0-9]{9}$/;

    protected readonly SUPPORTED_MIMETYPES = [
        MimeType.TEXT_PLAIN,
        MimeType.APPLICATION_PDF,
        MimeType.IMAGE_JPEG,
        MimeType.IMAGE_PNG,
        MimeType.IMAGE_GIF,
        MimeType.IMAGE_WEBP
    ];

    private readonly agent: MistralAgent = new MistralAgent();

    public constructor() {
        super(AIProvider.Mistral);
    }

    protected get apiUrl(): string {
        return AIProviderURL.Mistral;
    }

    protected get supportedMimeTypes(): MimeType[] {
        return this.SUPPORTED_MIMETYPES;
    }

    protected isNativeToolCallId(id: string): boolean {
        return Mistral.NATIVE_TOOL_CALL_ID.test(id);
    }

    public async resolveToolCall(toolCall: AIToolCall): Promise<AIToolResponse | null> {
        if (toolCall.name !== AITool.RequestWebSearch) {
            return null;
        }
        const query = (toolCall.arguments as Record<string, string>).query ?? "";
        const result = await this.agent.search(query);
        return new AIToolResponse(toolCall.name, new AIToolResponsePayload({ result }), toolCall.toolId);
    }

    protected formatBinaryFiles(attachments: Attachment[]): string {
        const contentParts: ChatCompletionContentPart[] = [];
        const fileService = this.aiFileService as MistralFileService;

        for (const attachment of attachments) {
            const fileID = attachment.getFileID(this.provider);
            if (!fileID) {
                continue; // Skip - upload failed, error message added in extractContents()
            }

            const mimeType = toMimeType(attachment.getMimeType());

            let isPlainText = false;
            if (MimeTypeToFileTypes[mimeType].some(fileType => isTextFile(fileType))) {
                isPlainText = true;
            }

            if (!isPlainText && !this.isSupportedMimeType(mimeType)) {
                contentParts.push({
                    type: "text",
                    text: `Unsupported mime type '${mimeType}': ${attachment.fileName}`
                });
                continue;
            }

            // Documents and text files: use signed URL via document_url
            if (isPlainText || mimeType === MimeType.APPLICATION_PDF) {
                const signedUrl = fileService.getSignedUrl(fileID);
                if (signedUrl) {
                    contentParts.push(
                        { type: "text", text: replaceCopy(Copy.AttachedFile, [attachment.fileName]) },
                        { type: "document_url", document_url: signedUrl }
                    );
                } else {
                    contentParts.push({
                        type: "text",
                        text: `Failed to get signed URL for ${attachment.fileName}`
                    });
                }
                continue;
            }

            // Images: use signed URL via image_url
            const signedUrl = fileService.getSignedUrl(fileID);
            if (signedUrl) {
                contentParts.push(
                    { type: "text", text: replaceCopy(Copy.AttachedFile, [attachment.fileName]) },
                    {
                        type: "image_url",
                        image_url: signedUrl
                    }
                );
            } else {
                contentParts.push({
                    type: "text",
                    text: `Failed to get signed URL for image ${attachment.fileName}`
                });
            }
        }

        return JSON.stringify(contentParts);
    }

    protected getTools(): ChatCompletionToolDefinition[] {
        if (this.settingsService.settings.enableWebSearch) {
            return [
                {
                    type: "function" as const,
                    function: {
                        name: AITool.RequestWebSearch,
                        description: `Use this function when you need to search the web for current information, recent events, news, or facts that may have changed.`,
                        parameters: {
                            type: "object" as const,
                            properties: {
                                query: { type: "string", description: "The search query to look up on the web." }
                            },
                            required: ["query"]
                        }
                    }
                },
                ...this.mapFunctionDefinitions(this.aiToolDefinitions)
            ];
        }
        return this.mapFunctionDefinitions(this.aiToolDefinitions);
    }
}

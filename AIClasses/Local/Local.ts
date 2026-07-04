import { ChatCompletionsAIClass } from "AIClasses/ChatCompletions/ChatCompletionsAIClass";
import type { ChatCompletionContentPart } from "AIClasses/ChatCompletions/ChatCompletionsTypes";
import type { Attachment } from "Conversations/Attachment";
import { AIProvider } from "Enums/ApiProvider";
import { AgentType } from "Enums/AgentType";
import { Copy } from "Enums/Copy";
import { isTextFile } from "Enums/FileType";
import { MimeTypeToFileTypes } from "Enums/FileTypeMimeTypeMapping";
import { isImageMimeType, MimeType, toMimeType } from "Enums/MimeType";
import { replaceCopy } from "Helpers/Helpers";
import { StringTools } from "Helpers/StringTools";
import { pdfToImages } from "Helpers/DocumentHelper";
import { arrayBufferToBase64 } from "obsidian";

export class Local extends ChatCompletionsAIClass {

    public constructor() {
        super(AIProvider.Local);
    }

    protected get apiUrl(): string {
        return this.settingsService.settings.localUrl;
    }

    protected get supportedMimeTypes(): MimeType[] {
        return [
            MimeType.TEXT_PLAIN,
            MimeType.APPLICATION_PDF,
            MimeType.IMAGE_JPEG,
            MimeType.IMAGE_PNG
        ];
    }

    // No file-upload API for local models: inline attachments directly as base64.
    protected async formatBinaryFiles(attachments: Attachment[]): Promise<string> {
        const contentParts: ChatCompletionContentPart[] = [];

        for (const attachment of attachments) {
            const mimeType = toMimeType(attachment.getMimeType());

            const isPlainText = MimeTypeToFileTypes[mimeType].some(fileType => isTextFile(fileType));

            if (!isPlainText && !this.isSupportedMimeType(mimeType)) {
                contentParts.push({
                    type: "text",
                    text: `User attempted to share a file with an unsupported mime type '${mimeType}': ${attachment.fileName}`
                });
                continue;
            }

            // Local models can't read raw PDF bytes: rasterize each page to an image instead.
            if (mimeType === MimeType.APPLICATION_PDF) {
                const pdfImages = await pdfToImages(StringTools.toBuffer(attachment.base64));

                if (pdfImages.length === 0) {
                    contentParts.push({
                        type: "text",
                        text: `Failed to render any pages from ${attachment.fileName}`
                    });
                    continue;
                }

                contentParts.push({ type: "text", text: replaceCopy(Copy.AttachedFile, [attachment.fileName]) });
                for (const pageImage of pdfImages) {
                    contentParts.push({
                        type: "image_url",
                        image_url: { url: `data:${pageImage.mimeType};base64,${arrayBufferToBase64(pageImage.image)}` }
                    });
                }
                continue;
            }

            if (isImageMimeType(mimeType)) {
                contentParts.push(
                    { type: "text", text: replaceCopy(Copy.AttachedFile, [attachment.fileName]) },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${attachment.base64}` } }
                );
                continue;
            }

            const text = new TextDecoder().decode(StringTools.toBuffer(attachment.base64));
            contentParts.push({
                type: "text",
                text: `${replaceCopy(Copy.AttachedFile, [attachment.fileName])}\n\n${text}`
            });
        }

        return JSON.stringify(contentParts);
    }

    protected model(): string {
        const localModels = this.settingsService.settings.localModels;

        switch (this.agentType) {
            case AgentType.Main:
            case AgentType.Execution:
                return localModels.model;
            case AgentType.Orchestration:
            case AgentType.Planning:
                return localModels.planningModel;
            case AgentType.QuickAction:
                return localModels.quickActionModel;
        }
    }
}

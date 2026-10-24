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
import { ThinkTagSplitter, type ThinkTagSplit } from "Helpers/ThinkTagSplitter";
import type { Conversation } from "Conversations/Conversation";
import type { IStreamChunk } from "Services/StreamingService";

export class Local extends ChatCompletionsAIClass {

    private readonly thinkTagSplitter = new ThinkTagSplitter();

    public constructor() {
        super(AIProvider.Local);
    }

    public async* streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown> {
        this.thinkTagSplitter.reset();
        yield* super.streamRequest(conversation);
    }

    // Some local servers write reasoning inline as <think>…</think> instead of a separate field
    protected splitInlineThinking(text: string, isFinalChunk: boolean): ThinkTagSplit {
        const split = this.thinkTagSplitter.split(text);
        if (isFinalChunk) {
            const remainder = this.thinkTagSplitter.flush();
            split.content += remainder.content;
            split.thought += remainder.thought;
        }
        return split;
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

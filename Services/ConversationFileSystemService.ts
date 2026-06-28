import { Path } from "Enums/Path";
import { Resolve } from "./DependencyService";
import { FileSystemService } from "./FileSystemService";
import { Services } from "./Services";
import { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { Attachment } from "Conversations/Attachment";
import { Exception } from "Helpers/Exception";
import type { IAIFileService } from "AIClasses/IAIFileService";
import { Reference } from "Conversations/Reference";
import { arrayBufferToBase64 } from "obsidian";
import { StringTools } from "Helpers/StringTools";

export class ConversationFileSystemService {

    private fileSystemService: FileSystemService;
    private aiFileService: IAIFileService | undefined;

    private currentConversationPath: string | null = null;
    private deletionQueue: Promise<void> = Promise.resolve();
    private isDeleted: boolean = false;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
    }

    public resolveAIFileService() {
        this.aiFileService = Resolve<IAIFileService>(Services.IAIFileService);
    }

    public generateConversationPath(conversation: Conversation): string {
        return `${Path.Conversations}/${conversation.title}.json`;
    }

    public async saveConversation(conversation: Conversation): Promise<string | Error> {
        if (this.isDeleted) {
            return ""; // Return empty string to indicate silent skip (not an error)
        }

        if (!this.currentConversationPath) {
            this.currentConversationPath = this.generateConversationPath(conversation);
        } else {
            // can happen if the conversation is deleted during an active request
            const fileExists = await this.fileSystemService.exists(this.currentConversationPath, true);
            if (!fileExists) {
                return this.currentConversationPath;
            }
        }

        conversation.updated = new Date();

        // Save attachment files and update filePaths
        for (const content of conversation.contents) {
            for (const attachment of content.attachments) {
                if (!attachment.filePath && attachment.base64) {
                    const filePath = await this.saveAttachmentFile(attachment);
                    if (!(filePath instanceof Error)) {
                        attachment.filePath = filePath.replace(`${Path.Conversations}/`, '');
                    }
                }
            }
        }

        const conversationData = {
            title: conversation.title,
            created: conversation.created.toISOString(),
            updated: conversation.updated.toISOString(),
            contents: conversation.contents
                .map(content => ({
                    role: content.role,
                    timestamp: content.timestamp.toISOString(),
                    content: content.content,
                    displayContent: content.displayContent,
                    toolCall: content.toolCall,
                    functionResponse: content.functionResponse,
                    attachments: content.attachments.map(att => ({
                        fileName: att.fileName,
                        mimeType: att.mimeType,
                        filePath: att.filePath,
                        fileID: att.fileID
                    })),
                    references: content.references,
                    shouldDisplayContent: content.shouldDisplayContent,
                    toolId: content.toolId,
                    thoughtSignature: content.thoughtSignature,
                    errorType: content.errorType
                }))
        };

        const result = await this.fileSystemService.writeObjectToFile(this.currentConversationPath, conversationData, true, false);

        if (result instanceof Error) {
            return result;
        }

        return this.currentConversationPath;
    }

    public resetCurrentConversation() {
        this.currentConversationPath = null;
        this.isDeleted = false;
    }

    public getCurrentConversationPath(): string | null {
        return this.currentConversationPath;
    }

    public setCurrentConversationPath(filePath: string) {
        this.currentConversationPath = filePath;
        this.isDeleted = false;
    }

    public async deleteCurrentConversation(): Promise<void | Error> {
        if (!this.currentConversationPath) {
            return;
        }

        const readResult = await this.readConversation(this.currentConversationPath);

        if (readResult instanceof Error) {
            return readResult;
        }

        // Queue this to execute silently in the background - it's just a best effort
        this.deletionQueue = this.deletionQueue.then(() => this.attemptAIFileDeletion(readResult));

        const deleteResult = await this.fileSystemService.deleteFile(this.currentConversationPath, true, false);

        if (deleteResult instanceof Error) {
            return deleteResult;
        }

        // Mark as deleted to prevent subsequent saves during ongoing operations
        this.isDeleted = true;
        this.currentConversationPath = null;

        // Queue garbage collection after AI file deletion
        this.deletionQueue = this.deletionQueue.then(async () => {
            await this.garbageCollectAttachments();
        });
    }

    public async getAllConversations(): Promise<Conversation[]> {
        const files = await this.fileSystemService.listFilesInDirectory(Path.Conversations, false, true);
        const conversations: Conversation[] = [];

        for (const file of files) {
            const result = await this.readConversation(file.path);
            if (result instanceof Conversation) {
                conversations.push(result);
            }
        }

        return conversations;
    }

    public async garbageCollectAttachments(): Promise<void | Error> {
        try {
            // 1. Get all attachment files
            const attachmentFiles = await this.fileSystemService.listFilesInDirectory(
                Path.Attachments,
                false,
                true
            );

            if (attachmentFiles.length === 0) {
                return;
            }

            // 2. Build reference count map
            const referenceCount = new Map<string, number>();

            const conversations = await this.getAllConversations();
            for (const conversation of conversations) {
                for (const content of conversation.contents) {
                    for (const attachment of content.attachments) {
                        if (attachment.filePath) {
                            const count = referenceCount.get(attachment.filePath) || 0;
                            referenceCount.set(attachment.filePath, count + 1);
                        }
                    }
                }
            }

            // 3. Delete unreferenced files
            for (const file of attachmentFiles) {
                const relativePath = file.path.replace(`${Path.Conversations}/`, '');
                const refCount = referenceCount.get(relativePath) || 0;

                if (refCount === 0) {
                    const deleteResult = await this.fileSystemService.deleteFile(
                        file.path,
                        true,
                        false
                    );

                    if (deleteResult instanceof Error) {
                        Exception.log(deleteResult);
                    }
                }
            }
        } catch (error) {
            Exception.log(error);
            return Exception.new(error);
        }
    }

    public async updateConversationTitle(oldPath: string, newTitle: string): Promise<void | Error> {
        const newPath = `${Path.Conversations}/${newTitle}.json`;

        const result = await this.fileSystemService.moveFile(oldPath, newPath, true);

        if (result instanceof Error) {
            return result;
        }

        if (this.currentConversationPath === oldPath) {
            this.currentConversationPath = newPath;
        }
    }

    private async saveAttachmentFile(attachment: Attachment): Promise<string | Error> {
        const hash = await StringTools.computeSHA256Hash(attachment.base64);
        const fileName = `${hash}.bin`;
        const filePath = `${Path.Attachments}/${fileName}`;

        const exists = await this.fileSystemService.exists(filePath, true);
        if (exists) {
            return filePath;
        }

        const bytes = StringTools.toBytes(attachment.base64);
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

        const result = await this.fileSystemService.writeBinaryFile(filePath, arrayBuffer, true);

        if (result instanceof Error) {
            Exception.log(result);
            return filePath;
        }

        return filePath;
    }

    private async loadAttachmentFile(filePath: string): Promise<string> {
        const fullPath = `${Path.Conversations}/${filePath}`;
        const arrayBuffer = await this.fileSystemService.readBinaryFile(fullPath, true);

        if (arrayBuffer instanceof Error) {
            Exception.log(arrayBuffer);
            return "";
        }

        return arrayBufferToBase64(arrayBuffer);
    }

    private async readConversation(path: string): Promise<Conversation | Error> {
        const result = await this.fileSystemService.readObjectFromFile(path, true);
        
        if (result instanceof Error) {
            Exception.log(result);
            return result;
        }
        
        const conversation: Conversation = new Conversation();

        if (Conversation.isConversationData(result)) {
            conversation.title = result.title;
            conversation.created = new Date(result.created);
            conversation.updated = new Date(result.updated);

            const contentPromises = result.contents.map(async content => {
                const attachments = await this.deserializeAttachments(content.attachments);
                const references = this.deserializeReferences(content.references);

                return new ConversationContent({
                    role: content.role,
                    timestamp: new Date(content.timestamp),
                    content: content.content,
                    displayContent: content.displayContent,
                    toolCall: content.toolCall,
                    functionResponse: content.functionResponse,
                    attachments: attachments,
                    references: references,
                    shouldDisplayContent: content.shouldDisplayContent,
                    toolId: content.toolId,
                    thoughtSignature: content.thoughtSignature,
                    errorType: content.errorType
                });
            });

            conversation.contents = await Promise.all(contentPromises);
        }
        
        return conversation;
    }

    private async deserializeAttachments(attachmentsData: unknown): Promise<Attachment[]> {
        if (!Array.isArray(attachmentsData)) {
            return [];
        }

        const attachments: Attachment[] = [];

        for (const attachmentData of attachmentsData) {
            if (!Attachment.isAttachmentData(attachmentData)) {
                continue;
            }

            const base64 = await this.loadAttachmentFile(attachmentData.filePath);

            if (!base64) {
                Exception.warn(`Skipping attachment with missing file: ${attachmentData.fileName} (${attachmentData.filePath})`);
                continue;
            }

            const attachment = new Attachment(
                attachmentData.fileName,
                attachmentData.mimeType,
                base64,
                attachmentData.fileID || {},
                attachmentData.filePath
            );

            attachments.push(attachment);
        }

        return attachments;
    }

    private deserializeReferences(referencesData: unknown): Reference[] {
        if (!Array.isArray(referencesData)) {
            return [];
        }

        return referencesData
            .filter(Reference.isReferenceData)
            .map(referenceData => new Reference(
                referenceData.fileName,
                referenceData.size
            ));
    }

    private async attemptAIFileDeletion(conversation: Conversation) {
        try {
            await this.aiFileService?.refreshCache();
        } catch (error) {
            Exception.log(error);
        }

        const attachments = conversation.contents.map(c => c.attachments).flat();
        for (const attachment of attachments) {
            try {
                await this.aiFileService?.deleteFile(attachment);
            } catch (error) {
                Exception.log(error);
            }
        }
    }

}

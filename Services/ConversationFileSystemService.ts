import { Path } from "Enums/Path";
import { Resolve } from "./DependencyService";
import { FileSystemService } from "./FileSystemService";
import { Services } from "./Services";
import { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { Attachment } from "Conversations/Attachment";
import { Exception } from "Helpers/Exception";
import type { IAIFileService } from "AIClasses/IAIFileService";

export class ConversationFileSystemService {

    private fileSystemService: FileSystemService;
    private aiFileService: IAIFileService | undefined;

    private currentConversationPath: string | null = null;

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
                    functionCall: content.functionCall,
                    functionResponse: content.functionResponse,
                    attachments: content.attachments,
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
    }

    public getCurrentConversationPath(): string | null {
        return this.currentConversationPath;
    }

    public setCurrentConversationPath(filePath: string) {
        this.currentConversationPath = filePath;
    }

    public async deleteCurrentConversation(): Promise<void | Error> {
        if (!this.currentConversationPath) {
            return;
        }

        const readResult = await this.readConversation(this.currentConversationPath);

        if (readResult instanceof Error) {
            return readResult;
        }

        await this.attemptAIFileDeletion(readResult);
        
        const deleteResult = await this.fileSystemService.deleteFile(this.currentConversationPath, true, false);

        if (deleteResult instanceof Error) {
            return deleteResult;
        }

        this.resetCurrentConversation();
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
            conversation.contents = result.contents.map(content => {
                // Reconstruct Attachment instances from plain objects
                const attachments = this.deserializeAttachments(content.attachments);

                return new ConversationContent({
                    role: content.role,
                    timestamp: new Date(content.timestamp),
                    content: content.content,
                    displayContent: content.displayContent,
                    functionCall: content.functionCall,
                    functionResponse: content.functionResponse,
                    attachments: attachments,
                    shouldDisplayContent: content.shouldDisplayContent,
                    toolId: content.toolId,
                    thoughtSignature: content.thoughtSignature,
                    errorType: content.errorType
                });
            });
        }
        
        return conversation;
    }

    private deserializeAttachments(attachmentsData: unknown): Attachment[] {
        if (!Array.isArray(attachmentsData)) {
            return [];
        }

        return attachmentsData
            .filter(Attachment.isAttachmentData)
            .map(attachmentData => new Attachment(
                attachmentData.fileName,
                attachmentData.mimeType,
                attachmentData.base64,
                attachmentData.fileID || {}
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

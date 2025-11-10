import { Path } from "Enums/Path";
import { Resolve } from "./DependencyService";
import { FileSystemService } from "./FileSystemService";
import { Services } from "./Services";
import { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { Copy } from "Enums/Copy";

export class ConversationFileSystemService {

    private fileSystemService: FileSystemService;
    private currentConversationPath: string | null = null;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
    }

    public generateConversationPath(conversation: Conversation): string {
        return `${Path.Conversations}/${conversation.title}.json`;
    }

    public async saveConversation(conversation: Conversation): Promise<string> {
        if (!this.currentConversationPath) {
            this.currentConversationPath = this.generateConversationPath(conversation);
        }

        conversation.updated = new Date();
        
        const conversationData = {
            title: conversation.title,
            created: conversation.created.toISOString(),
            updated: conversation.updated.toISOString(),
            contents: conversation.contents
                .filter(content => content.content !== Copy.ApiRequestAborted.toString())
                .map(content => ({
                    role: content.role,
                    content: content.content,
                    promptContent: content.promptContent,
                    functionCall: content.functionCall,
                    timestamp: content.timestamp.toISOString(),
                    isFunctionCall: content.isFunctionCall,
                    isFunctionCallResponse: content.isFunctionCallResponse,
                    toolId: content.toolId
                }))
        };

        await this.fileSystemService.writeObjectToFile(this.currentConversationPath, conversationData, true);
        return this.currentConversationPath;
    }

    public resetCurrentConversation(): void {
        this.currentConversationPath = null;
    }

    public getCurrentConversationPath(): string | null {
        return this.currentConversationPath;
    }

    public setCurrentConversationPath(filePath: string): void {
        this.currentConversationPath = filePath;
    }

    public async deleteCurrentConversation(): Promise<boolean> {
        if (!this.currentConversationPath) {
            return false;
        }

        const deleted = await this.fileSystemService.deleteFile(this.currentConversationPath, true);

        if (deleted.success) {
            this.resetCurrentConversation();
        }

        return deleted.success;
    }

    public async getAllConversations(): Promise<Conversation[]> {
        const files = await this.fileSystemService.listFilesInDirectory(Path.Conversations, false, true);
        const conversations: Conversation[] = [];

        for (const file of files) {
            const data = await this.fileSystemService.readObjectFromFile(file.path, true);
            if (Conversation.isConversationData(data)) {
                const conversation: Conversation = new Conversation();
                conversation.title = data.title;
                conversation.created = new Date(data.created);
                conversation.updated = new Date(data.updated);
                conversation.contents = data.contents.map(content => {
                    return new ConversationContent(
                        content.role, content.content, content.promptContent, content.functionCall, new Date(content.timestamp), content.isFunctionCall, content.isFunctionCallResponse, content.toolId);
                });
                conversations.push(conversation);
            }
        }

        return conversations;
    }

    public async updateConversationTitle(oldPath: string, newTitle: string): Promise<void> {
        const newPath = `${Path.Conversations}/${newTitle}.json`;

        const result = await this.fileSystemService.moveFile(oldPath, newPath, true);

        if (!result.success) {
            throw new Error(`Failed to update conversation title: ${result.error}`);
        }

        if (this.currentConversationPath === oldPath) {
            this.currentConversationPath = newPath;
        }
    }

}

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

        const conversationData = {
            title: conversation.title,
            created: conversation.created.toISOString(),
            contents: conversation.contents
                .filter(content => content.content !== Copy.ApiRequestAborted)
                .map(content => ({
                    id: content.id,
                    role: content.role,
                    content: content.content,
                    timestamp: content.timestamp.toISOString(),
                    isFunctionCall: content.isFunctionCall,
                    isFunctionCallResponse: content.isFunctionCallResponse
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

        if (deleted) {
            this.resetCurrentConversation();
        }

        return deleted;
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
                conversation.contents = data.contents.map(content => {
                    return new ConversationContent(
                        content.role, content.content, new Date(content.timestamp), content.isFunctionCall, content.isFunctionCallResponse, content.id);
                });
                conversations.push(conversation);
            }
        }

        return conversations;
    }

}

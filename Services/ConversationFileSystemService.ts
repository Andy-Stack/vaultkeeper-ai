import { Path } from "Enums/Path";
import { Resolve } from "./DependencyService";
import { FileSystemService } from "./FileSystemService";
import { Services } from "./Services";
import { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";

export class ConversationFileSystemService {

    private fileSystemService: FileSystemService;
    private currentConversationPath: string | null = null;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
    }

    public generateConversationPath(conversation: Conversation): string {
        return `${Path.Conversations}/${conversation.title}.json`;
    }

    // public async loadConversation(filePath: string): Promise<{ messages: 
    //     Array<{ role: string, content: string, timestamp: Date }>, created: Date, title: string } | null> {
    //         const conversation: TFile | null = this.fileSystemService.readObjectFromFile(filePath) as unknown as TFile;
    // }

    public async saveConversation(conversation: Conversation): Promise<string> {
        if (!this.currentConversationPath) {
            this.currentConversationPath = this.generateConversationPath(conversation);
        }

        const conversationData = {
            title: conversation.title,
            created: conversation.created.toISOString(),
            contents: conversation.contents.map(content => ({
                role: content.role,
                content: content.content,
                timestamp: content.timestamp.toISOString()
            }))
        };

        await this.fileSystemService.writeObjectToFile(this.currentConversationPath, conversationData);
        return this.currentConversationPath;
    }

    public resetCurrentConversation(): void {
        this.currentConversationPath = null;
    }

    public async deleteCurrentConversation(): Promise<boolean> {
        if (!this.currentConversationPath) {
            return false;
        }

        const deleted = await this.fileSystemService.deleteFile(this.currentConversationPath);

        if (deleted) {
            this.resetCurrentConversation();
        }

        return deleted;
    }

    public async getAllConversations(): Promise<Conversation[]> {
        const files = await this.fileSystemService.listFilesInDirectory(Path.Conversations, false);
        const conversations: Conversation[] = [];

        for (const file of files) {
            const data = await this.fileSystemService.readObjectFromFile(file.path);
            if (Conversation.isConversationData(data)) {
                const conversation: Conversation = new Conversation();
                conversation.title = data.title;
                conversation.created = new Date(data.created);
                conversation.contents = data.contents.map(content => {
                    const conversationContent = new ConversationContent(content.role, content.content);
                    conversationContent.timestamp = new Date(content.timestamp);
                    return conversationContent;
                });
                conversations.push(conversation);
            }
        }

        return conversations;
    }

}

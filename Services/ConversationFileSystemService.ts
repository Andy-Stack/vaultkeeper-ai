import { Path } from "Enums/Path";
import { Resolve } from "./DependencyService";
import { FileSystemService } from "./FileSystemService";
import { Services } from "./Services";
import type { TFile } from "obsidian";
import { Conversation } from "Conversations/Conversation";

export class ConversationFileSystemService {

    private fileSystemService: FileSystemService;
    private currentConversationPath: string | null = null;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
    }

    public generateConversationFilename(): string {
        const now = new Date();
        const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '-');
        return `${Path.Conversations}/conversation-${timestamp}.json`;
    }

    // public async loadConversation(filePath: string): Promise<{ messages: 
    //     Array<{ role: string, content: string, timestamp: Date }>, created: Date, title: string } | null> {
    //         const conversation: TFile | null = this.fileSystemService.readObjectFromFile(filePath) as unknown as TFile;
    // }

    public async saveConversation(conversation: Conversation): Promise<string> {
        if (!this.currentConversationPath) {
            this.currentConversationPath = this.generateConversationFilename();
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

}

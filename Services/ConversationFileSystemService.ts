import { Resolve } from "./DependencyService";
import { FileSystemService } from "./FileSystemService";
import { Services } from "./Services";

export class ConversationFileSystemService {

    private fileSystemService: FileSystemService;
    private currentConversationPath: string | null = null;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
    }

    public generateConversationFilename(): string {
        const now = new Date();
        const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '-');
        return `conversations/chat-${timestamp}.json`;
    }

    public async saveConversation(messages: Array<{
        id: string,
        content: string,
        isUser: boolean
    }>): Promise<string> {
        if (!this.currentConversationPath) {
            this.currentConversationPath = this.generateConversationFilename();
        }

        const conversationData = {
            messages: messages.map(msg => ({
                id: msg.id,
                content: msg.content,
                isUser: msg.isUser
            })),
            savedAt: new Date().toISOString()
        };

        await this.fileSystemService.writeObjectToFile(this.currentConversationPath, conversationData);
        return this.currentConversationPath;
    }

    public getCurrentConversationPath(): string | null {
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

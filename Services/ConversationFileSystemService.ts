import { Path } from "Enums/Path";
import { Resolve } from "./DependencyService";
import { FileSystemService } from "./FileSystemService";
import { Services } from "./Services";
import { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { Copy } from "Enums/Copy";
import { Exception } from "Helpers/Exception";

export class ConversationFileSystemService {

    private fileSystemService: FileSystemService;
    private currentConversationPath: string | null = null;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
    }

    public generateConversationPath(conversation: Conversation): string {
        return `${Path.Conversations}/${conversation.title}.json`;
    }

    public async saveConversation(conversation: Conversation): Promise<string | Error> {
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
                    toolId: content.toolId,
                    errorType: content.errorType
                }))
        };

        const result = await this.fileSystemService.writeObjectToFile(this.currentConversationPath, conversationData, true);

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

        const result = await this.fileSystemService.deleteFile(this.currentConversationPath, true);

        if (result instanceof Error) {
            return result;
        }

        this.resetCurrentConversation();
    }

    public async getAllConversations(): Promise<Conversation[]> {
        const files = await this.fileSystemService.listFilesInDirectory(Path.Conversations, false, true);
        const conversations: Conversation[] = [];

        for (const file of files) {
            const result = await this.fileSystemService.readObjectFromFile(file.path, true);
            if (result instanceof Error) {
                Exception.log(`Failed to load conversation: ${file.path}`);
                continue;
            }
            if (Conversation.isConversationData(result)) {
                const conversation: Conversation = new Conversation();
                conversation.title = result.title;
                conversation.created = new Date(result.created);
                conversation.updated = new Date(result.updated);
                conversation.contents = result.contents.map(content => {
                    return new ConversationContent(
                        content.role,
                        content.content,
                        content.promptContent,
                        content.functionCall,
                        new Date(content.timestamp),
                        content.isFunctionCall,
                        content.isFunctionCallResponse,
                        content.toolId,
                        content.errorType
                    );
                });
                conversations.push(conversation);
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

}

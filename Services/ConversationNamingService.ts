import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import type { ConversationFileSystemService } from "./ConversationFileSystemService";
import type { Conversation } from "Conversations/Conversation";

export class ConversationNamingService {
    private namingProvider: IConversationNamingService | undefined;
    private conversationService: ConversationFileSystemService;

    constructor() {
        this.conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
    }

    public resolveNamingProvider() {
        this.namingProvider = Resolve<IConversationNamingService>(Services.IConversationNamingService);
    }

    public async requestName(conversation: Conversation, userPrompt: string, onNameChanged: ((name: string) => void) | undefined, abortController: AbortController): Promise<void> {
        if (!this.namingProvider) {
            return;
        }

        const conversationPath = this.conversationService.getCurrentConversationPath();
        
        if (!conversationPath) {
            return;
        }

        try {
            const generatedName: string = await this.namingProvider.generateName(userPrompt, abortController.signal);
            const validatedName: string = this.validateName(generatedName);

            const stillExists = this.conversationService.getCurrentConversationPath() === conversationPath;
            if (!stillExists) {
                return;
            }

            await this.conversationService.updateConversationTitle(conversationPath, validatedName);
            conversation.title = validatedName;
            await this.conversationService.saveConversation(conversation);
            onNameChanged?.(conversation.title);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error("Failed to generate name:", error);
        }
    }

    private validateName(generatedName: string): string {
        const cleanedTitle = generatedName.trim().replace(/^["']|["']$/g, "");
        return cleanedTitle.split(/\s+/).slice(0, 6).join(" ");
    }
}

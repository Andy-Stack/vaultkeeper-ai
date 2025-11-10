import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import type { ConversationFileSystemService } from "./ConversationFileSystemService";
import type { Conversation } from "Conversations/Conversation";
import type { VaultService } from "./VaultService";
import { Path } from "Enums/Path";

export class ConversationNamingService {
    private readonly stackLimit: number = 1000;

    private namingProvider: IConversationNamingService | undefined;
    private conversationService: ConversationFileSystemService;
    private vaultService: VaultService;

    constructor() {
        this.conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
        this.vaultService = Resolve<VaultService>(Services.VaultService);
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
            const validatedName: string = await this.validateName(generatedName);

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

    private async validateName(generatedName: string): Promise<string> {
        const cleanedTitle = generatedName.trim().replace(/^["']|["']$/g, "").split(/\s+/).slice(0, 6).join(" ");

        let index = 1;
        let availableTitle = cleanedTitle;
        while (await this.vaultService.exists(`${Path.Conversations}/${availableTitle}.json`, true)) {
            availableTitle = `${cleanedTitle}(${index})`;
            index++;

            if (index > this.stackLimit) {
                throw new Error(`Stack limit reached when trying to generate conversation name for "${cleanedTitle}"`);
            }
        }
        return availableTitle;
    }
}

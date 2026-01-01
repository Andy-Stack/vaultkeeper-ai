import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import type { ConversationFileSystemService } from "./ConversationFileSystemService";
import type { Conversation } from "Conversations/Conversation";
import type { VaultService } from "./VaultService";
import { Path } from "Enums/Path";
import { Exception } from "Helpers/Exception";
import { Notice } from "obsidian";
import { AbortService } from "./AbortService";

export class ConversationNamingService {
    private readonly stackLimit: number = 1000;

    private namingProvider: IConversationNamingService | undefined;
    private conversationService: ConversationFileSystemService;
    private vaultService: VaultService;
    private abortService: AbortService;

    constructor() {
        this.conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
        this.vaultService = Resolve<VaultService>(Services.VaultService);
        this.abortService = Resolve<AbortService>(Services.AbortService);
    }

    public resolveNamingProvider() {
        this.namingProvider = Resolve<IConversationNamingService>(Services.IConversationNamingService);
    }

    public async requestName(conversation: Conversation, userPrompt: string, onNameChanged: ((name: string) => void) | undefined) {
        await this.abortService.abortableOperation(async () => {
            if (!this.namingProvider) {
                return;
            }
    
            const conversationPath = this.conversationService.getCurrentConversationPath();
            if (!conversationPath) {
                return;
            }
    
            try {
                const prompt = `<message_to_title>\n${userPrompt}\n</message_to_title>`;
                const generatedName: string = await this.namingProvider.generateName(prompt);
                const validatedName: string = await this.validateName(generatedName);

                const stillExists = this.conversationService.getCurrentConversationPath() === conversationPath;
                if (!stillExists) {
                    return;
                }
    
                const updateResult = await this.conversationService.updateConversationTitle(conversationPath, validatedName);
                
                if (updateResult instanceof Error) {
                    Exception.throw(updateResult);
                }
    
                conversation.title = validatedName;
                const saveResult = await this.conversationService.saveConversation(conversation);
    
                if (saveResult instanceof Error) {
                    Exception.throw(saveResult);
                }
                
                onNameChanged?.(conversation.title);
            } catch (error) {
                if (!AbortService.isAbortError(error)) {
                    Exception.log(error);
                    new Notice(`Failed to name conversation '${conversation.title}'`);
                }
            }
        });
    }

    private async validateName(generatedName: string): Promise<string> {
        let cleanedTitle = generatedName.trim().replace(/^["']|["']$/g, "");

        const words = cleanedTitle.split(/\s+/);
        if (words.length > 10) {
            cleanedTitle = words.slice(0, 10).join(" ");
        }

        let index = 1;
        let availableTitle = cleanedTitle;
        while (await this.vaultService.exists(`${Path.Conversations}/${availableTitle}.json`, true)) {
            availableTitle = `${cleanedTitle}(${index})`;
            index++;

            if (index > this.stackLimit) {
                Exception.log(`Stack limit reached when trying to generate conversation name for "${cleanedTitle}"`);
            }
        }
        return availableTitle;
    }
}

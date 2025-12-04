export interface IConversationNamingService {
    generateName(userPrompt: string): Promise<string>;
}

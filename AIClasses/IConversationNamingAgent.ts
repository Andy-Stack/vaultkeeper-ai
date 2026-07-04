export interface IConversationNamingAgent {
    generateName(userPrompt: string): Promise<string>;
}

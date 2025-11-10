import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import { AIProvider, AIProviderURL, AIProviderModel } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIClasses/NamePrompt";
import type { SettingsService } from "Services/SettingsService";
import type { ChatCompletion } from "openai/resources/chat/completions";

export class OpenAIConversationNamingService implements IConversationNamingService {
    
    private readonly apiKey: string;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = settingsService.getApiKeyForProvider(AIProvider.OpenAI);
    }

    public async generateName(userPrompt: string, abortSignal?: AbortSignal): Promise<string> {

        const requestBody = {
            model: AIProviderModel.OpenAINamer,
            max_tokens: 100,
            messages: [
                {
                    role: Role.System,
                    content: NamePrompt
                },
                {
                    role: Role.User,
                    content: userPrompt
                }
            ]
        };

        const response = await fetch(AIProviderURL.OpenAI, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: abortSignal
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${await response.text()}`);
        }

        const data = await response.json() as ChatCompletion;
        const generatedName = data.choices?.[0]?.message?.content;

        if (!generatedName) {
            throw new Error("Failed to generate conversation name");
        }

        return generatedName;
    }
}
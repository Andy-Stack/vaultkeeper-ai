import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import { AIProvider, AIProviderURL, AIProviderModel } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIClasses/NamePrompt";
import type { SettingsService } from "Services/SettingsService";

export class ClaudeConversationNamingService implements IConversationNamingService {
    
    private readonly apiKey: string;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = settingsService.getApiKeyForProvider(AIProvider.Claude);
    }

    public async generateName(userPrompt: string, abortSignal?: AbortSignal): Promise<string> {

        const requestBody = {
            model: AIProviderModel.ClaudeNamer,
            max_tokens: 100,
            system: NamePrompt,
            messages: [{
                role: Role.User,
                content: userPrompt
            }]
        };

        const response = await fetch(AIProviderURL.Claude, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
                'content-type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: abortSignal
        });

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${await response.text()}`);
        }

        const data = await response.json();
        const generatedName = data.content?.[0]?.text;

        if (!generatedName) {
            throw new Error("Failed to generate conversation name");
        }

        return generatedName;
    }
}
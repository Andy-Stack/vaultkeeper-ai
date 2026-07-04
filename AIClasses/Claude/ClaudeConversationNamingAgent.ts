import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingAgent } from "AIClasses/IConversationNamingAgent";
import { AIProvider, AIProviderURL, AIProviderModel } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIPrompts/NamePrompt";
import type { SettingsService } from "Services/SettingsService";
import type Anthropic from '@anthropic-ai/sdk';
import { Exception } from "Helpers/Exception";
import type { AbortService } from "Services/AbortService";

export class ClaudeConversationNamingAgent implements IConversationNamingAgent {
    
    private readonly apiKey: string;
    private readonly abortService: AbortService;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = settingsService.getApiKeyForProvider(AIProvider.Claude);
        this.abortService = Resolve<AbortService>(Services.AbortService);
    }

    public async generateName(userPrompt: string): Promise<string> {
        return await this.abortService.abortableOperation(async () => {
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
                signal: this.abortService.signal()
            });
    
            if (!response.ok) {
                Exception.throw(`Claude API error: ${response.status} ${response.statusText} - ${await response.text()}`);
            }
    
            const data = await response.json() as Anthropic.Messages.Message;
            const firstContent = data.content?.[0];
    
            if (!firstContent || firstContent.type !== 'text') {
                Exception.throw("Failed to generate conversation name");
            }
    
            return firstContent.text;
        });
    }
}
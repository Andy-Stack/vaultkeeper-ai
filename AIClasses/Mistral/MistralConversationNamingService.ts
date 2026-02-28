import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import { AIProvider, AIProviderURL, AIProviderModel } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIPrompts/NamePrompt";
import type { SettingsService } from "Services/SettingsService";
import { Exception } from "Helpers/Exception";
import type { AbortService } from "Services/AbortService";
import type { MistralChatResponse } from "./MistralTypes";

export class MistralConversationNamingService implements IConversationNamingService {

    private readonly apiKey: string;
    private readonly abortService: AbortService;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = settingsService.getApiKeyForProvider(AIProvider.Mistral);
        this.abortService = Resolve<AbortService>(Services.AbortService);
    }

    public async generateName(userPrompt: string): Promise<string> {
        return await this.abortService.abortableOperation(async () => {
            const requestBody = {
                model: AIProviderModel.MistralNamer,
                max_tokens: 100,
                messages: [
                    {
                        role: "system",
                        content: NamePrompt
                    },
                    {
                        role: Role.User,
                        content: userPrompt
                    }
                ]
            };

            const response = await fetch(AIProviderURL.Mistral, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: this.abortService.signal()
            });

            if (!response.ok) {
                Exception.throw(`Mistral API error: ${response.status} ${response.statusText} - ${await response.text()}`);
            }

            const data = await response.json() as MistralChatResponse;
            const firstChoice = data.choices?.[0];

            if (!firstChoice || !firstChoice.message?.content) {
                Exception.throw("Failed to generate conversation name");
            }

            return firstChoice.message.content.trim();
        });
    }
}

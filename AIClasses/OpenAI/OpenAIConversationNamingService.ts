import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import { AIProvider, AIProviderURL, AIProviderModel } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIPrompts/NamePrompt";
import type { SettingsService } from "Services/SettingsService";
import type OpenAI from "openai";
import { Exception } from "Helpers/Exception";
import type { AbortService } from "Services/AbortService";

export class OpenAIConversationNamingService implements IConversationNamingService {

    private readonly apiKey: string;
    private readonly abortService: AbortService;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = settingsService.getApiKeyForProvider(AIProvider.OpenAI);
        this.abortService = Resolve<AbortService>(Services.AbortService);
    }

    public async generateName(userPrompt: string): Promise<string> {
        return await this.abortService.abortableOperation(async () => {
            const requestBody = {
                model: AIProviderModel.OpenAINamer,
                max_output_tokens: 100,
                instructions: NamePrompt,
                input: [
                    {
                        role: Role.User,
                        content: userPrompt
                    }
                ],
                stream: false
            };

            const response = await fetch(AIProviderURL.OpenAI, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: this.abortService.signal()
            });

            if (!response.ok) {
                Exception.throw(`OpenAI API error: ${response.status} ${response.statusText} - ${await response.text()}`);
            }

            const data = await response.json() as OpenAI.Responses.Response;

            // Try to get the name from output_text first (most common case)
            if (data.output_text && data.output_text.trim()) {
                return data.output_text.trim();
            }

            // Fall back to checking the output array
            const firstOutput = data.output?.[0];
            const generatedName = firstOutput && 'content' in firstOutput
                ? firstOutput.content?.[0]?.type === 'output_text'
                    ? firstOutput.content[0].text
                    : undefined
                : undefined;

            if (!generatedName) {
                Exception.throw("Failed to generate conversation name");
            }

            return generatedName;
        });
    }
}
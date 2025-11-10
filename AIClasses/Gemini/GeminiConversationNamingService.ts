import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import { AIProvider, AIProviderURL, AIProviderModel } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIClasses/NamePrompt";
import type { GenerateContentResponse } from "@google/genai";
import type { SettingsService } from "Services/SettingsService";

export class GeminiConversationNamingService implements IConversationNamingService {
    
    private readonly apiKey: string;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = settingsService.getApiKeyForProvider(AIProvider.Gemini);
    }

    public async generateName(userPrompt: string, abortSignal?: AbortSignal): Promise<string> {

        const requestBody = {
            system_instruction: {
                parts: [{ text: NamePrompt }]
            },
            contents: [{
                role: Role.User,
                parts: [{ text: userPrompt }]
            }]
        };

        const response = await fetch(`${AIProviderURL.Gemini}/${AIProviderModel.GeminiNamer}:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: abortSignal
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${await response.text()}`);
        }

        const data = await response.json() as GenerateContentResponse;
        const generatedName = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedName) {
            throw new Error("Failed to generate conversation name");
        }

        return generatedName;
    }
}

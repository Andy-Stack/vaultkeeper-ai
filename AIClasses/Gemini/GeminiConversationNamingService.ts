import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import type AIAgentPlugin from "main";
import { AIProviderURL } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIClasses/NamePrompt";

export class GeminiConversationNamingService implements IConversationNamingService {
    
    private readonly apiKey: string;

    public constructor() {
        this.apiKey = Resolve<AIAgentPlugin>(Services.AIAgentPlugin).settings.apiKey;
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

        const response = await fetch(AIProviderURL.GeminiNamer.replace("API_KEY", this.apiKey), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: abortSignal
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const generatedName = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedName) {
            throw new Error("Failed to generate conversation name");
        }

        return generatedName;
    }
}

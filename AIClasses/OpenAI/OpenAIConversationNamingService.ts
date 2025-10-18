import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import type AIAgentPlugin from "main";
import { AIProviderURL, AIProviderModel } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIClasses/NamePrompt";

export class OpenAIConversationNamingService implements IConversationNamingService {
    
    private readonly apiKey: string;

    public constructor() {
        this.apiKey = Resolve<AIAgentPlugin>(Services.AIAgentPlugin).settings.apiKey;
    }

    public async generateName(userPrompt: string, abortSignal?: AbortSignal): Promise<string> {

        const requestBody = {
            model: AIProviderModel.OpenAINamer,
            max_tokens: 50,
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

        const response = await fetch(AIProviderURL.OpenAINamer, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: abortSignal
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const generatedName = data.choices?.[0]?.message?.content;

        if (!generatedName) {
            throw new Error("Failed to generate conversation name");
        }

        return generatedName;
    }
}
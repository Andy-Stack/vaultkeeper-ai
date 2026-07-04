import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IConversationNamingAgent } from "AIClasses/IConversationNamingAgent";
import type { AIProvider } from "Enums/ApiProvider";
import { Role } from "Enums/Role";
import { NamePrompt } from "AIPrompts/NamePrompt";
import type { SettingsService } from "Services/SettingsService";
import { Exception } from "Helpers/Exception";
import type { AbortService } from "Services/AbortService";
import type { ChatCompletionResponse } from "./ChatCompletionsTypes";

/**
 * Base conversation-naming agent for providers speaking the OpenAI-compatible
 * Chat Completions protocol. Subclasses supply only the endpoint and namer model;
 * the request shape and response parsing are identical across such providers.
 */
export abstract class ChatCompletionsConversationNamingAgent implements IConversationNamingAgent {

    private readonly apiKey: string;
    private readonly abortService: AbortService;

    protected constructor(provider: AIProvider) {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = settingsService.getApiKeyForProvider(provider);
        this.abortService = Resolve<AbortService>(Services.AbortService);
    }

    /** The Chat Completions endpoint for this provider. */
    protected abstract get apiUrl(): string;

    /** The (typically small/fast) model used to generate conversation names. */
    protected abstract get namerModel(): string;

    public async generateName(userPrompt: string): Promise<string> {
        return await this.abortService.abortableOperation(async () => {
            const requestBody = {
                model: this.namerModel,
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

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: this.abortService.signal()
            });

            if (!response.ok) {
                Exception.throw(`Chat Completions API error: ${response.status} ${response.statusText} - ${await response.text()}`);
            }

            const data = await response.json() as ChatCompletionResponse;
            const firstChoice = data.choices?.[0];

            if (!firstChoice || !firstChoice.message?.content) {
                Exception.throw("Failed to generate conversation name");
            }

            return firstChoice.message.content.trim();
        });
    }
}

import type { ITokenService } from "AIClasses/ITokenService";
import Anthropic from '@anthropic-ai/sdk'
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import { Role } from "Enums/Role";
import { AIProvider } from "Enums/ApiProvider";
import type { SettingsService } from "Services/SettingsService";

export class ClaudeTokenService implements ITokenService {

    private ai: Anthropic;
    private model: string;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.ai = new Anthropic({
            apiKey: settingsService.getApiKeyForProvider(AIProvider.Claude),
            dangerouslyAllowBrowser: true
        });
        this.model = settingsService.settings.model;
    }

    public async countTokens(input: string): Promise<number> {
        if (input.trim() === "") {
            return 0;
        }

        // to maintain the convenience of the interface we just submit the entire input as one message
        const result = await this.ai.messages.countTokens({
            model: this.model,
            messages: [
                { role: Role.User, content: input }
            ]
        })
        return result.input_tokens;
    }

}
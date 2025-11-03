import type { ITokenService } from "AIClasses/ITokenService";
import { CountTokensResponse, GoogleGenAI } from '@google/genai'
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import { AIProvider } from "Enums/ApiProvider";
import type { SettingsService } from "Services/SettingsService";

export class GeminiTokenService implements ITokenService {

    private readonly ai: GoogleGenAI;
    private model: string;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.ai = new GoogleGenAI({
            apiKey: settingsService.getApiKeyForProvider(AIProvider.Gemini)
        });
        this.model = settingsService.settings.model;
    }

    public async countTokens(input: string): Promise<number> {
        if (input.trim() === "") {
            return 0;
        }

        const result: CountTokensResponse = await this.ai.models.countTokens({
            model: this.model,
            contents: input
        });
        return result.totalTokens ?? -1;
    }

}
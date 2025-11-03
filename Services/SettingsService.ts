import type AIAgentPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { AIProvider, AIProviderModel } from "Enums/ApiProvider";

const DEFAULT_SETTINGS: IAIAgentSettings = {
    firstTimeStart: true,

    model: AIProviderModel.ClaudeSonnet_4_5,
    apiKeys: {
        claude: "",
        openai: "",
        gemini: ""
    },
    exclusions: [],

    userInstruction: ""
}

export interface IAIAgentSettings {
    firstTimeStart: boolean;

    model: string;
    apiKeys: {
        claude: string;
        openai: string;
        gemini: string;
    };
    exclusions: string[];

    userInstruction: string;
}

export class SettingsService {

    private readonly plugin: AIAgentPlugin;
    
    public readonly settings: IAIAgentSettings;

    public constructor(loadedSettings: Partial<IAIAgentSettings>) {
        this.plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
    }

    public async saveSettings(onSave?: () => void) {
        await this.plugin.saveData(this.settings);
        if (onSave) {
            onSave();
        }
    }

    public getApiKeyForCurrentModel(): string {
        const provider = AIProvider.fromModel(this.settings.model);
        return this.getApiKeyForProvider(provider);
    }

    public getApiKeyForProvider(provider: AIProvider): string {
        switch (provider) {
            case AIProvider.Claude:
                return this.settings.apiKeys.claude;
            case AIProvider.OpenAI:
                return this.settings.apiKeys.openai;
            case AIProvider.Gemini:
                return this.settings.apiKeys.gemini;
        }
    }

    public setApiKeyForProvider(provider: AIProvider, key: string): void {
        switch (provider) {
            case AIProvider.Claude:
                this.settings.apiKeys.claude = key;
                break;
            case AIProvider.OpenAI:
                this.settings.apiKeys.openai = key;
                break;
            case AIProvider.Gemini:
                this.settings.apiKeys.gemini = key;
                break;
        }
    }

}
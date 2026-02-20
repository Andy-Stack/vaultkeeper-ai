import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { AIProvider, AIProviderModel, fromModel, isValidProviderModel } from "Enums/ApiProvider";

const DEFAULT_SETTINGS: IVaultkeeperAISettings = {
    firstTimeStart: true,
    userInstruction: "",

    model: AIProviderModel.ClaudeHaiku_4_5,
    planningModel: AIProviderModel.ClaudeSonnet_4_6,
    apiKeys: {
        claude: "",
        openai: "",
        gemini: ""
    },
    exclusions: [],

    searchResultsLimit: 15,
    snippetSizeLimit: 300
}

export interface IVaultkeeperAISettings {
    firstTimeStart: boolean;
    userInstruction: string;

    model: string;
    planningModel: string;
    apiKeys: {
        claude: string;
        openai: string;
        gemini: string;
    };
    exclusions: string[];

    searchResultsLimit: number;
    snippetSizeLimit: number;
}

export class SettingsService {

    private readonly plugin: VaultkeeperAIPlugin;
    
    public readonly settings: IVaultkeeperAISettings;

    public constructor(loadedSettings: Partial<IVaultkeeperAISettings>) {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
        this.ensureValidModels();
    }

    public async saveSettings(onSave?: () => void) {
        await this.plugin.saveData(this.settings);
        if (onSave) {
            onSave();
        }
    }

    public getApiKeyForCurrentModel(): string {
        const provider = fromModel(this.settings.model);
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

    public setApiKeyForProvider(provider: AIProvider, key: string) {
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

    private ensureValidModels(): void {
        const validModel = isValidProviderModel(this.settings.model);
        const validPlanningModel = isValidProviderModel(this.settings.model);

        if (!validModel) {
            this.settings.model = AIProviderModel.ClaudeSonnet_4_6;
        }
        if (!validPlanningModel) {
            this.settings.planningModel = AIProviderModel.ClaudeSonnet_4_6;
        }

        if (!validModel || !validPlanningModel) {
            this.saveSettings();
        }
    }

}
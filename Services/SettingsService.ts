import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { AIProvider, AIProviderModel, DEFAULT_MODEL_BY_PROVIDER, DEFAULT_PLANNING_MODEL_BY_PROVIDER, fromModel, isvalidProvider, isValidProviderModel, modelMatchesProvider } from "Enums/ApiProvider";

const DEFAULT_SETTINGS: IVaultkeeperAISettings = {
    firstTimeStart: true,
    userInstruction: "",

    provider: AIProvider.Claude,
    model: AIProviderModel.ClaudeHaiku_4_5,
    planningModel: AIProviderModel.ClaudeSonnet_4_6,
    quickActionModel: AIProviderModel.ClaudeHaiku_4_5,
    
    apiKeys: {
        claude: "",
        openai: "",
        gemini: "",
        mistral: ""
    },
    exclusions: [],

    searchResultsLimit: 30,
    snippetSizeLimit: 100,

    enableMemories: false,
    allowUpdatingMemories: true,

    enableWebSearch: true,
    enableWebViewer: false
}

export interface IVaultkeeperAISettings {
    firstTimeStart: boolean;
    userInstruction: string;

    provider: AIProvider;
    model: AIProviderModel;
    planningModel: AIProviderModel;
    quickActionModel: AIProviderModel;

    apiKeys: {
        claude: string;
        openai: string;
        gemini: string;
        mistral: string;
    };
    exclusions: string[];

    searchResultsLimit: number;
    snippetSizeLimit: number;

    enableMemories: boolean;
    allowUpdatingMemories: boolean;

    enableWebSearch: boolean;
    enableWebViewer: boolean;
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
            case AIProvider.Mistral:
                return this.settings.apiKeys.mistral;
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
            case AIProvider.Mistral:
                this.settings.apiKeys.mistral = key;
                break;
        }
    }

    private ensureValidModels(): void {
        let changed = false;

        let provider = this.settings.provider;

        if (!isvalidProvider(provider)) {
            provider = DEFAULT_SETTINGS.provider;
            changed = true;
        }

        if (!isValidProviderModel(this.settings.model) || !modelMatchesProvider(this.settings.model, provider)) {
            this.settings.model = DEFAULT_MODEL_BY_PROVIDER[provider];
            changed = true;
        }

        if (!isValidProviderModel(this.settings.planningModel) || !modelMatchesProvider(this.settings.planningModel, provider)) {
            this.settings.planningModel = DEFAULT_PLANNING_MODEL_BY_PROVIDER[provider];
            changed = true;
        }

        if (!isValidProviderModel(this.settings.quickActionModel) || !modelMatchesProvider(this.settings.quickActionModel, provider)) {
            this.settings.quickActionModel = DEFAULT_MODEL_BY_PROVIDER[provider];
            changed = true;
        }

        if (changed) {
            void this.saveSettings();
        }
    }

}
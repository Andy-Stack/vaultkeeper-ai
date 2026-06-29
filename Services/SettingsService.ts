import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { ChatMode } from "Enums/ChatMode";
import {
    AIProvider,
    AIProviderModel,
    DEFAULT_MODEL_BY_PROVIDER,
    DEFAULT_PLANNING_MODEL_BY_PROVIDER,
    DEFAULT_QUICK_MODEL_BY_PROVIDER,
    fromModel,
    isvalidProvider,
    isValidProviderModel,
    modelMatchesProvider
} from "Enums/ApiProvider";

export const DEFAULT_SETTINGS: IVaultkeeperAISettings = {
    firstTimeStart: true,

    chatMode: ChatMode.ReadOnly,
    userInstruction: "",

    provider: AIProvider.Claude,
    model: AIProviderModel.ClaudeSonnet_4_6,
    planningModel: AIProviderModel.ClaudeOpus_4_8,
    quickActionModel: AIProviderModel.ClaudeHaiku_4_5,
    
    cachedModelSettings: {
        [AIProvider.Claude]: {
            planningModel: DEFAULT_PLANNING_MODEL_BY_PROVIDER[AIProvider.Claude],
            quickActionModel: DEFAULT_QUICK_MODEL_BY_PROVIDER[AIProvider.Claude]
        },
        [AIProvider.OpenAI]: {
            planningModel: DEFAULT_PLANNING_MODEL_BY_PROVIDER[AIProvider.OpenAI],
            quickActionModel: DEFAULT_QUICK_MODEL_BY_PROVIDER[AIProvider.OpenAI]
        },
        [AIProvider.Gemini]: {
            planningModel: DEFAULT_PLANNING_MODEL_BY_PROVIDER[AIProvider.Gemini],
            quickActionModel: DEFAULT_QUICK_MODEL_BY_PROVIDER[AIProvider.Gemini]
        },
        [AIProvider.Mistral]: {
            planningModel: DEFAULT_PLANNING_MODEL_BY_PROVIDER[AIProvider.Mistral],
            quickActionModel: DEFAULT_QUICK_MODEL_BY_PROVIDER[AIProvider.Mistral]
        }
    },

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
    enableWebViewer: false,

    enableContextMenuActions: true,
    enableToolbarActions: true,

    hideDrawerElements: true
}

export interface IVaultkeeperAISettings {
    firstTimeStart: boolean;

    chatMode: ChatMode;
    userInstruction: string;

    provider: AIProvider;
    model: AIProviderModel;
    planningModel: AIProviderModel;
    quickActionModel: AIProviderModel;

    cachedModelSettings: Record<AIProvider, ProviderModelCache>;

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

    enableContextMenuActions: boolean;
    enableToolbarActions: boolean;

    hideDrawerElements: boolean;
}

export interface ProviderModelCache {
    planningModel: AIProviderModel;
    quickActionModel: AIProviderModel;
}

type SettingKey = keyof IVaultkeeperAISettings;
type SettingsChangedCallback = ((changedKeys: SettingKey[]) => void) | ((changedKeys: SettingKey[]) => Promise<void>);

export class SettingsService {

    public readonly settings: Readonly<IVaultkeeperAISettings>;

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly subscribers: WeakMap<object, SettingsChangedCallback> = new WeakMap();
    private readonly subscriberRefs: Set<WeakRef<object>> = new Set();

    private settingsSnapshot: string;

    public constructor(loadedSettings: Partial<IVaultkeeperAISettings>) {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
        this.settingsSnapshot = JSON.stringify(this.settings);
        void this.ensureValidModels();
    }

    public subscribeToSettingsChanged(callback: SettingsChangedCallback): object {
        const token = {};
        this.subscribers.set(token, callback);
        this.subscriberRefs.add(new WeakRef(token));
        return token;
    }

    public unsubscribe(subscriber: object): void {
        this.subscribers.delete(subscriber);
    }

    public async updateSettings(updateAction: ((settings: IVaultkeeperAISettings) => void) | ((settings: IVaultkeeperAISettings) => Promise<void>)) {
        await updateAction(this.settings);
        await this.saveSettings();
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

    public async setApiKeyForProvider(provider: AIProvider, key: string) {
        switch (provider) {
            case AIProvider.Claude:
                await this.updateSettings(settings => settings.apiKeys.claude = key);
                break;
            case AIProvider.OpenAI:
                await this.updateSettings(settings => settings.apiKeys.openai = key);                
                break;
            case AIProvider.Gemini:
                await this.updateSettings(settings => settings.apiKeys.gemini = key);                
                break;
            case AIProvider.Mistral:
                await this.updateSettings(settings => settings.apiKeys.mistral = key);
                break;
        }
    }

    public async ensureValidModels(): Promise<void> {
        await this.updateSettings(settings => {
            if (!isvalidProvider(settings.provider)) {
                settings.provider = DEFAULT_SETTINGS.provider;
            }
    
            if (!isValidProviderModel(settings.model) || !modelMatchesProvider(settings.model, settings.provider)) {
                settings.model = DEFAULT_MODEL_BY_PROVIDER[settings.provider];
            }
    
            if (!isValidProviderModel(settings.planningModel) || !modelMatchesProvider(settings.planningModel, settings.provider)) {
                settings.planningModel = DEFAULT_PLANNING_MODEL_BY_PROVIDER[settings.provider];
            }
    
            if (!isValidProviderModel(settings.quickActionModel) || !modelMatchesProvider(settings.quickActionModel, settings.provider)) {
                settings.quickActionModel = DEFAULT_QUICK_MODEL_BY_PROVIDER[settings.provider];
            }

            const cached = settings.cachedModelSettings[settings.provider];
            if (!isValidProviderModel(cached.planningModel) || !modelMatchesProvider(cached.planningModel, settings.provider)) {
                settings.cachedModelSettings[settings.provider].planningModel = DEFAULT_PLANNING_MODEL_BY_PROVIDER[settings.provider];
            }
            if (!isValidProviderModel(cached.quickActionModel) || !modelMatchesProvider(cached.quickActionModel, settings.provider)) {
                settings.cachedModelSettings[settings.provider].quickActionModel = DEFAULT_QUICK_MODEL_BY_PROVIDER[settings.provider];
            }
        });
    }

    private async saveSettings() {
        const oldSettings = JSON.parse(this.settingsSnapshot) as IVaultkeeperAISettings;
        await this.plugin.saveData(this.settings);
        const changedKeys = (Object.keys(this.settings) as SettingKey[])
            .filter(key => JSON.stringify(this.settings[key]) !== JSON.stringify(oldSettings[key]));
        if (changedKeys.length > 0) {
            this.settingsSnapshot = JSON.stringify(this.settings);
            for (const ref of this.subscriberRefs) {
                const subscriber = ref.deref();
                if (!subscriber) {
                    this.subscriberRefs.delete(ref);
                    continue;
                }
                await this.subscribers.get(subscriber)?.(changedKeys);
            }
        }
    }

}
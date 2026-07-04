import { ChatCompletionsConversationNamingAgent } from "AIClasses/ChatCompletions/ChatCompletionsConversationNamingService";
import { AIProvider } from "Enums/ApiProvider";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { SettingsService } from "Services/SettingsService";

export class LocalConversationNamingAgent extends ChatCompletionsConversationNamingAgent {

    private readonly settingsService: SettingsService;

    public constructor() {
        super(AIProvider.Local);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
    }

    protected get apiUrl(): string {
        return this.settingsService.settings.localUrl;
    }

    protected get namerModel(): string {
        return this.settingsService.settings.localModels.quickActionModel;
    }

}
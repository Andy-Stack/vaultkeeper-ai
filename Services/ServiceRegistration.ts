import { AIProvider, fromModel } from "Enums/ApiProvider";
import type VaultkeeperAIPlugin from "main";
import { RegisterSingleton, RegisterTransient, Resolve } from "./DependencyService";
import { Services } from "./Services";
import { AIPrompt, type IPrompt } from "AIPrompts/IPrompt";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import { Gemini } from "AIClasses/Gemini/Gemini";
import { GeminiConversationNamingService } from "AIClasses/Gemini/GeminiConversationNamingService";
import { StreamingMarkdownService } from "./StreamingMarkdownService";
import { FileSystemService } from "./FileSystemService";
import { ConversationFileSystemService } from "./ConversationFileSystemService";
import { ConversationHistoryModal } from "Modals/ConversationHistoryModal";
import { AIToolService } from "./AIServices/AIToolService";
import { StreamingService } from "./StreamingService";
import { WorkSpaceService } from "./WorkSpaceService";
import { ChatService } from "./ChatService";
import { ConversationNamingService } from "./ConversationNamingService";
import { VaultService } from "./VaultService";
import { ClaudeConversationNamingService } from "AIClasses/Claude/ClaudeConversationNamingService";
import { Claude } from "AIClasses/Claude/Claude";
import { OpenAIConversationNamingService } from "AIClasses/OpenAI/OpenAIConversationNamingService";
import { OpenAI } from "AIClasses/OpenAI/OpenAI";
import { SanitiserService } from "./SanitiserService";
import { VaultCacheService } from "./VaultCacheService";
import { UserInputService } from "./UserInputService";
import { SearchStateStore } from "Stores/SearchStateStore";
import { ExecutionPlanStore } from "Stores/ExecutionPlanStore";
import { InputService } from "./InputService";
import { HTMLService } from "./HTMLService";
import { SettingsService, type IVaultkeeperAISettings } from "./SettingsService";
import { HelpModal } from "Modals/HelpModal";
import { EventService } from "./EventService";
import { DiffService } from "./DiffService";
import { AbortService } from "./AbortService";
import type { IAIFileService } from "AIClasses/IAIFileService";
import { ClaudeFileService } from "AIClasses/Claude/ClaudeFileService";
import { GeminiFileService } from "AIClasses/Gemini/GeminiFileService";
import { OpenAIFileService } from "AIClasses/OpenAI/OpenAIFileService";
import { MainAgent } from "./AIServices/MainAgent";
import { Environment } from "Enums/Environment";
import { DebugService } from "./DebugService";

export async function RegisterPlugin(plugin: VaultkeeperAIPlugin) {
    RegisterSingleton<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin, plugin);
    RegisterSingleton<SettingsService>(Services.SettingsService, new SettingsService(await plugin.loadData() as Partial<IVaultkeeperAISettings>));
} 

export function RegisterDependencies() {
    if (process.env.NODE_ENV === Environment.DEV) {
        RegisterTransient<DebugService | undefined>(Services.DebugService, () => new DebugService());
    }

    RegisterSingleton<EventService>(Services.EventService, new EventService());
    RegisterSingleton<AbortService>(Services.AbortService, new AbortService());
    RegisterSingleton<HTMLService>(Services.HTMLService, new HTMLService());
    RegisterSingleton<SanitiserService>(Services.SanitiserService, new SanitiserService());
    RegisterSingleton<DiffService>(Services.DiffService, new DiffService());
    RegisterSingleton<VaultService>(Services.VaultService, new VaultService());
    RegisterSingleton<VaultCacheService>(Services.VaultCacheService, new VaultCacheService());
    RegisterSingleton<SearchStateStore>(Services.SearchStateStore, new SearchStateStore());
    RegisterSingleton<ExecutionPlanStore>(Services.ExecutionPlanStore, new ExecutionPlanStore());
    RegisterSingleton<UserInputService>(Services.UserInputService, new UserInputService());
    RegisterSingleton<WorkSpaceService>(Services.WorkSpaceService, new WorkSpaceService());
    RegisterSingleton<FileSystemService>(Services.FileSystemService, new FileSystemService());
    RegisterSingleton<ConversationFileSystemService>(Services.ConversationFileSystemService, new ConversationFileSystemService());
    RegisterSingleton<ConversationNamingService>(Services.ConversationNamingService, new ConversationNamingService());

    RegisterSingleton<IPrompt>(Services.IPrompt, new AIPrompt());
    RegisterSingleton<AIToolService>(Services.AIToolService, new AIToolService());
    RegisterSingleton<MainAgent>(Services.MainAgent, new MainAgent());
    RegisterSingleton<StreamingService>(Services.StreamingService, new StreamingService());
    RegisterSingleton<ChatService>(Services.ChatService, new ChatService());

    RegisterTransient<StreamingMarkdownService>(Services.StreamingMarkdownService, () => new StreamingMarkdownService());
    RegisterTransient<InputService>(Services.InputService, () => new InputService());

    RegisterModals();
    RegisterAiProvider();
}

export function RegisterAiProvider() {
    const settingsService = Resolve<SettingsService>(Services.SettingsService);
    const provider = fromModel(settingsService.settings.model);

    if (provider == AIProvider.Claude) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new ClaudeFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new Claude());
        RegisterSingleton<IConversationNamingService>(Services.IConversationNamingService, new ClaudeConversationNamingService());
    }
    else if (provider == AIProvider.Gemini) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new GeminiFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new Gemini());
        RegisterSingleton<IConversationNamingService>(Services.IConversationNamingService, new GeminiConversationNamingService());
    }
    else if (provider == AIProvider.OpenAI) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new OpenAIFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new OpenAI());
        RegisterSingleton<IConversationNamingService>(Services.IConversationNamingService, new OpenAIConversationNamingService());
    }

    Resolve<MainAgent>(Services.MainAgent).resolveAIProvider();
    Resolve<ConversationNamingService>(Services.ConversationNamingService).resolveNamingProvider();
    Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService).resolveAIFileService();
}

function RegisterModals() {
    RegisterTransient<ConversationHistoryModal>(Services.ConversationHistoryModal, () => new ConversationHistoryModal());
    RegisterTransient<HelpModal>(Services.HelpModal, () => new HelpModal())
}
// Core and Enums
import { AIProvider } from "Enums/ApiProvider";
import { Environment } from "Enums/Environment";
import type VaultkeeperAIPlugin from "main";
import { AssetsService } from "./AssetsService";

// Services
import { RegisterSingleton, RegisterTransient, Resolve } from "./DependencyService";
import { Services } from "./Services";
import { AbortService } from "./AbortService";
import { AIToolService } from "./AIServices/AIToolService";
import { ChatService } from "./ChatService";
import { ConversationFileSystemService } from "./ConversationFileSystemService";
import { ConversationNamingService } from "./ConversationNamingService";
import { DebugService } from "./DebugService";
import { DiffService } from "./DiffService";
import { EventService } from "./EventService";
import { FileSystemService } from "./FileSystemService";
import { HTMLService } from "./HTMLService";
import { InputService } from "./InputService";
import { MainAgent } from "./AIServices/MainAgent";
import { MemoriesService } from "./MemoriesService";
import { SanitiserService } from "./SanitiserService";
import { SettingsService, type IVaultkeeperAISettings } from "./SettingsService";
import { StreamingMarkdownService } from "./StreamingMarkdownService";
import { StreamingService } from "./StreamingService";
import { UserInputService } from "./UserInputService";
import { VaultCacheService } from "./VaultCacheService";
import { VaultService } from "./VaultService";
import { WorkSpaceService } from "./WorkSpaceService";
import { WebViewerService } from "./WebViewerService";

// Stores
import { ExecutionPlanStore } from "Stores/ExecutionPlanStore";
import { SearchStateStore } from "Stores/SearchStateStore";

// Modals
import { ConversationHistoryModal } from "Modals/ConversationHistoryModal";
import { HelpModal } from "Modals/HelpModal";

// AI Classes
import type { IAIClass } from "AIClasses/IAIClass";
import type { IAIFileService } from "AIClasses/IAIFileService";
import type { IConversationNamingAgent } from "AIClasses/IConversationNamingAgent";
import { Claude } from "AIClasses/Claude/Claude";
import { ClaudeConversationNamingAgent } from "AIClasses/Claude/ClaudeConversationNamingAgent";
import { ClaudeFileService } from "AIClasses/Claude/ClaudeFileService";
import { Gemini } from "AIClasses/Gemini/Gemini";
import { GeminiConversationNamingAgent } from "AIClasses/Gemini/GeminiConversationNamingAgent";
import { GeminiFileService } from "AIClasses/Gemini/GeminiFileService";
import { Mistral } from "AIClasses/Mistral/Mistral";
import { MistralConversationNamingAgent } from "AIClasses/Mistral/MistralConversationNamingAgent";
import { MistralFileService } from "AIClasses/Mistral/MistralFileService";
import { OpenAI } from "AIClasses/OpenAI/OpenAI";
import { OpenAIConversationNamingAgent } from "AIClasses/OpenAI/OpenAIConversationNamingAgent";
import { OpenAIFileService } from "AIClasses/OpenAI/OpenAIFileService";
import { Local } from "AIClasses/Local/Local";
import { LocalConversationNamingAgent } from "AIClasses/Local/LocalConversationNamingAgent";
import { LocalFileService } from "AIClasses/Local/LocalFileService";

// Prompts
import { AIPrompt, type IPrompt } from "AIPrompts/IPrompt";
import { QuickAgent } from "./AIServices/QuickAgent";
import { QuickActionsDefinitionsService } from "./QuickActions/QuickActionsDefinitionsService";
import { QuickActionsService } from "./QuickActions/QuickActionsService";


export async function RegisterPlugin(plugin: VaultkeeperAIPlugin) {
    RegisterSingleton<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin, plugin);
    RegisterSingleton<SettingsService>(Services.SettingsService, new SettingsService(await plugin.loadData() as Partial<IVaultkeeperAISettings>));
    RegisterSingleton<AssetsService>(Services.AssetsService, new AssetsService());
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
    RegisterSingleton<FileSystemService>(Services.FileSystemService, new FileSystemService());
    RegisterSingleton<SearchStateStore>(Services.SearchStateStore, new SearchStateStore());
    RegisterSingleton<ExecutionPlanStore>(Services.ExecutionPlanStore, new ExecutionPlanStore());
    RegisterSingleton<UserInputService>(Services.UserInputService, new UserInputService());
    RegisterSingleton<WorkSpaceService>(Services.WorkSpaceService, new WorkSpaceService());
    RegisterSingleton<MemoriesService>(Services.MemoriesService, new MemoriesService());
    RegisterSingleton<ConversationFileSystemService>(Services.ConversationFileSystemService, new ConversationFileSystemService());
    RegisterSingleton<ConversationNamingService>(Services.ConversationNamingService, new ConversationNamingService());
    RegisterSingleton<QuickActionsDefinitionsService>(Services.QuickActionsDefinitionsService, new QuickActionsDefinitionsService());
    RegisterSingleton<QuickActionsService>(Services.QuickActionsService, new QuickActionsService());
    
    RegisterTransient<WebViewerService>(Services.WebViewerService, () => new WebViewerService());
    
    RegisterSingleton<IPrompt>(Services.IPrompt, new AIPrompt());
    RegisterSingleton<AIToolService>(Services.AIToolService, new AIToolService());
    RegisterSingleton<MainAgent>(Services.MainAgent, new MainAgent());
    RegisterSingleton<StreamingService>(Services.StreamingService, new StreamingService());
    RegisterSingleton<ChatService>(Services.ChatService, new ChatService());

    RegisterTransient<QuickAgent>(Services.QuickAgent, () => new QuickAgent());
    RegisterTransient<StreamingMarkdownService>(Services.StreamingMarkdownService, () => new StreamingMarkdownService());
    RegisterTransient<InputService>(Services.InputService, () => new InputService());

    RegisterModals();
    RegisterAiProvider();
}

export function RegisterAiProvider() {
    const settingsService = Resolve<SettingsService>(Services.SettingsService);
    const provider = settingsService.settings.provider;

    if (provider == AIProvider.Claude) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new ClaudeFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new Claude());
        RegisterSingleton<IConversationNamingAgent>(Services.IConversationNamingService, new ClaudeConversationNamingAgent());
    }
    else if (provider == AIProvider.Gemini) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new GeminiFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new Gemini());
        RegisterSingleton<IConversationNamingAgent>(Services.IConversationNamingService, new GeminiConversationNamingAgent());
    }
    else if (provider == AIProvider.OpenAI) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new OpenAIFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new OpenAI());
        RegisterSingleton<IConversationNamingAgent>(Services.IConversationNamingService, new OpenAIConversationNamingAgent());
    }
    else if (provider == AIProvider.Mistral) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new MistralFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new Mistral());
        RegisterSingleton<IConversationNamingAgent>(Services.IConversationNamingService, new MistralConversationNamingAgent());
    }
    else if (provider == AIProvider.Local) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new LocalFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new Local());
        RegisterSingleton<IConversationNamingAgent>(Services.IConversationNamingService, new LocalConversationNamingAgent());
    }

    Resolve<MainAgent>(Services.MainAgent).resolveAIProvider();
    Resolve<ConversationNamingService>(Services.ConversationNamingService).resolveNamingProvider();
    Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService).resolveAIFileService();
}

function RegisterModals() {
    RegisterTransient<ConversationHistoryModal>(Services.ConversationHistoryModal, () => new ConversationHistoryModal());
    RegisterTransient<HelpModal>(Services.HelpModal, () => new HelpModal())
}
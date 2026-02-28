// Core and Enums
import { AIProvider, fromModel } from "Enums/ApiProvider";
import { Environment } from "Enums/Environment";
import type VaultkeeperAIPlugin from "main";

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
import { SanitiserService } from "./SanitiserService";
import { SettingsService, type IVaultkeeperAISettings } from "./SettingsService";
import { StreamingMarkdownService } from "./StreamingMarkdownService";
import { StreamingService } from "./StreamingService";
import { UserInputService } from "./UserInputService";
import { VaultCacheService } from "./VaultCacheService";
import { VaultService } from "./VaultService";
import { WorkSpaceService } from "./WorkSpaceService";

// Stores
import { ExecutionPlanStore } from "Stores/ExecutionPlanStore";
import { SearchStateStore } from "Stores/SearchStateStore";

// Modals
import { ConversationHistoryModal } from "Modals/ConversationHistoryModal";
import { HelpModal } from "Modals/HelpModal";

// AI Classes
import type { IAIClass } from "AIClasses/IAIClass";
import type { IAIFileService } from "AIClasses/IAIFileService";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import { Claude } from "AIClasses/Claude/Claude";
import { ClaudeConversationNamingService } from "AIClasses/Claude/ClaudeConversationNamingService";
import { ClaudeFileService } from "AIClasses/Claude/ClaudeFileService";
import { Gemini } from "AIClasses/Gemini/Gemini";
import { GeminiConversationNamingService } from "AIClasses/Gemini/GeminiConversationNamingService";
import { GeminiFileService } from "AIClasses/Gemini/GeminiFileService";
import { Mistral } from "AIClasses/Mistral/Mistral";
import { MistralConversationNamingService } from "AIClasses/Mistral/MistralConversationNamingService";
import { MistralFileService } from "AIClasses/Mistral/MistralFileService";
import { OpenAI } from "AIClasses/OpenAI/OpenAI";
import { OpenAIConversationNamingService } from "AIClasses/OpenAI/OpenAIConversationNamingService";
import { OpenAIFileService } from "AIClasses/OpenAI/OpenAIFileService";

// Prompts
import { AIPrompt, type IPrompt } from "AIPrompts/IPrompt";

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
    else if (provider == AIProvider.Mistral) {
        RegisterSingleton<IAIFileService>(Services.IAIFileService, new MistralFileService());
        RegisterSingleton<IAIClass>(Services.IAIClass, new Mistral());
        RegisterSingleton<IConversationNamingService>(Services.IConversationNamingService, new MistralConversationNamingService());
    }

    Resolve<MainAgent>(Services.MainAgent).resolveAIProvider();
    Resolve<ConversationNamingService>(Services.ConversationNamingService).resolveNamingProvider();
    Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService).resolveAIFileService();
}

function RegisterModals() {
    RegisterTransient<ConversationHistoryModal>(Services.ConversationHistoryModal, () => new ConversationHistoryModal());
    RegisterTransient<HelpModal>(Services.HelpModal, () => new HelpModal())
}
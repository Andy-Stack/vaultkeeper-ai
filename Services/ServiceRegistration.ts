import { AIProvider } from "Enums/ApiProvider";
import type AIAgentPlugin from "main";
import { RegisterSingleton, RegisterTransient, Resolve } from "./DependencyService";
import { Services } from "./Services";
import { AIPrompt, type IPrompt } from "AIClasses/IPrompt";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IConversationNamingService } from "AIClasses/IConversationNamingService";
import { Gemini } from "AIClasses/Gemini/Gemini";
import { GeminiConversationNamingService } from "AIClasses/Gemini/GeminiConversationNamingService";
import { StreamingMarkdownService } from "./StreamingMarkdownService";
import { FileSystemService } from "./FileSystemService";
import { ConversationFileSystemService } from "./ConversationFileSystemService";
import { ConversationHistoryModal } from "Modals/ConversationHistoryModal";
import { FileManager, type App } from "obsidian";
import { AIFunctionService } from "./AIFunctionService";
import { StreamingService } from "./StreamingService";
import { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { WorkSpaceService } from "./WorkSpaceService";
import { ChatService } from "./ChatService";
import { ConversationNamingService } from "./ConversationNamingService";
import { VaultService } from "./VaultService";
import type { ITokenService } from "AIClasses/ITokenService";
import { GeminiTokenService } from "AIClasses/Gemini/GeminiTokenService";
import { StatusBarService } from "./StatusBarService";
import { ClaudeTokenService } from "AIClasses/Claude/ClaudeTokenService";
import { OpenAITokenService } from "AIClasses/OpenAI/OpenAITokenService";
import { ClaudeConversationNamingService } from "AIClasses/Claude/ClaudeConversationNamingService";
import { Claude } from "AIClasses/Claude/Claude";
import { OpenAIConversationNamingService } from "AIClasses/OpenAI/OpenAIConversationNamingService";
import { OpenAI } from "AIClasses/OpenAI/OpenAI";
import { SanitiserService } from "./SanitiserService";

export function RegisterDependencies(plugin: AIAgentPlugin) {
    RegisterSingleton<AIAgentPlugin>(Services.AIAgentPlugin, plugin);
    RegisterSingleton<FileManager>(Services.FileManager, plugin.app.fileManager);
    RegisterSingleton<StatusBarService>(Services.StatusBarService, new StatusBarService());
    RegisterSingleton<SanitiserService>(Services.SanitiserService, new SanitiserService());
    RegisterSingleton<VaultService>(Services.VaultService, new VaultService());
    RegisterSingleton<WorkSpaceService>(Services.WorkSpaceService, new WorkSpaceService());
    RegisterSingleton<FileSystemService>(Services.FileSystemService, new FileSystemService());
    RegisterSingleton<ConversationFileSystemService>(Services.ConversationFileSystemService, new ConversationFileSystemService());
    RegisterSingleton<ConversationNamingService>(Services.ConversationNamingService, new ConversationNamingService());

    RegisterSingleton<IPrompt>(Services.IPrompt, new AIPrompt());
    RegisterSingleton<AIFunctionDefinitions>(Services.AIFunctionDefinitions, new AIFunctionDefinitions());
    RegisterSingleton<AIFunctionService>(Services.AIFunctionService, new AIFunctionService());
    RegisterSingleton<StreamingService>(Services.StreamingService, new StreamingService());
    RegisterSingleton<ChatService>(Services.ChatService, new ChatService());

    RegisterTransient<StreamingMarkdownService>(Services.StreamingMarkdownService, () => new StreamingMarkdownService());

    RegisterModals(plugin.app);
    RegisterAiProvider(plugin);
}

export function RegisterAiProvider(plugin: AIAgentPlugin) {
    const provider = AIProvider.fromModel(plugin.settings.model);

    if (provider == AIProvider.Claude) {
        RegisterSingleton<IAIClass>(Services.IAIClass, new Claude());
        RegisterSingleton<ITokenService>(Services.ITokenService, new ClaudeTokenService());
        RegisterSingleton<IConversationNamingService>(Services.IConversationNamingService, new ClaudeConversationNamingService());
    }
    else if (provider == AIProvider.Gemini) {
        RegisterSingleton<IAIClass>(Services.IAIClass, new Gemini());
        RegisterSingleton<ITokenService>(Services.ITokenService, new GeminiTokenService());
        RegisterSingleton<IConversationNamingService>(Services.IConversationNamingService, new GeminiConversationNamingService());
    }
    else if (provider == AIProvider.OpenAI) {
        RegisterSingleton<IAIClass>(Services.IAIClass, new OpenAI());
        RegisterSingleton<ITokenService>(Services.ITokenService, new OpenAITokenService());
        RegisterSingleton<IConversationNamingService>(Services.IConversationNamingService, new OpenAIConversationNamingService());
    }

    Resolve<ChatService>(Services.ChatService).resolveAIProvider();
    Resolve<ConversationNamingService>(Services.ConversationNamingService).resolveNamingProvider();
}

function RegisterModals(app: App) {
    RegisterTransient<ConversationHistoryModal>(Services.ConversationHistoryModal, () => new ConversationHistoryModal(app));
}
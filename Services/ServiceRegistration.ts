import { AIProvider } from "Enums/ApiProvider";
import type AIAgentPlugin from "main";
import { RegisterSingleton, RegisterTransient, Resolve } from "./DependencyService";
import { Services } from "./Services";
import { AIPrompt, type IPrompt } from "AIClasses/IPrompt";
import type { IAIClass } from "AIClasses/IAIClass";
import { Gemini } from "AIClasses/Gemini/Gemini";
import { StreamingMarkdownService } from "./StreamingMarkdownService";
import { MessageService } from "./MessageService";
import { FileSystemService } from "./FileSystemService";
import { ConversationFileSystemService } from "./ConversationFileSystemService";
import { ConversationHistoryModal } from "Modals/ConversationHistoryModal";
import type { App } from "obsidian";
import { AIFunctionService } from "./AIFunctionService";
import { StreamingService } from "./StreamingService";
import { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { WorkSpaceService } from "./WorkSpaceService";
import { ChatService } from "./ChatService";
import { VaultService } from "./VaultService";

export function RegisterDependencies(plugin: AIAgentPlugin) {
    RegisterSingleton(Services.AIAgentPlugin, plugin);
    RegisterSingleton(Services.VaultService, new VaultService());
    RegisterSingleton(Services.MessageService, new MessageService());
    RegisterSingleton(Services.WorkSpaceService, new WorkSpaceService());
    RegisterSingleton(Services.FileSystemService, new FileSystemService());
    RegisterSingleton(Services.ConversationFileSystemService, new ConversationFileSystemService());

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
    if (plugin.settings.apiProvider == AIProvider.Gemini) {
        RegisterSingleton<IAIClass>(Services.IAIClass, new Gemini());
    }
    Resolve<ChatService>(Services.ChatService).resolveAIProvider();
}

function RegisterModals(app: App) {
    RegisterTransient<ConversationHistoryModal>(Services.ConversationHistoryModal, () => new ConversationHistoryModal(app));
}
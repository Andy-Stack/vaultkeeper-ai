import { AIProvider } from "Enums/ApiProvider";
import type AIAgentPlugin from "main";
//import { OdbCache } from "ODB/Core/OdbCache";
import { RegisterSingleton, RegisterTransient } from "./DependencyService";
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

export function RegisterDependencies(plugin: AIAgentPlugin) {
    RegisterSingleton(Services.MessageService, new MessageService());
    RegisterSingleton(Services.AIAgentPlugin, plugin);
    //RegisterSingleton(Services.OdbCache, new OdbCache());
    RegisterSingleton(Services.FileSystemService, new FileSystemService());
    RegisterSingleton(Services.ConversationFileSystemService, new ConversationFileSystemService());

    RegisterSingleton<IPrompt>(Services.IPrompt, new AIPrompt());
    RegisterSingleton<AIFunctionService>(Services.AIFunctionService, new AIFunctionService());

    RegisterTransient<StreamingMarkdownService>(Services.StreamingMarkdownService, () => new StreamingMarkdownService());

    RegisterModals(plugin.app);
    RegisterAiProvider(plugin);
}

export function RegisterAiProvider(plugin: AIAgentPlugin) {
    if (plugin.settings.apiProvider == AIProvider.Gemini) {
        RegisterSingleton<IAIClass>(Services.IAIClass, new Gemini(plugin.settings.apiKey));
    }
}

function RegisterModals(app: App) {
    RegisterTransient<ConversationHistoryModal>(Services.ConversationHistoryModal, () => new ConversationHistoryModal(app));
}
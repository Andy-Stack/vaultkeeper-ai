import { AIProvider } from "Enums/ApiProvider";
import type DmsAssistantPlugin from "main";
import { OdbCache } from "ODB/Core/OdbCache";
import { RegisterSingleton, RegisterTransient } from "./DependencyService";
import { ModalService } from "./ModalService";
import { Services } from "./Services";
import { AIPrompt, type IPrompt } from "AIClasses/IPrompt";
import { Actioner } from "Actioner/Actioner";
import type { IActioner } from "Actioner/IActioner";
import type { IAIClass } from "AIClasses/IAIClass";
import { GeminiActionDefinitions } from "Actioner/Gemini/GeminiActionDefinitions";
import type { IActionDefinitions } from "Actioner/IActionDefinitions";
import { Gemini } from "AIClasses/Gemini/Gemini";
import { StreamingMarkdownService } from "./StreamingMarkdownService";
import { MessageService } from "./MessageService";
import { FileSystemService } from "./FileSystemService";
import { ConversationFileSystemService } from "./ConversationFileSystemService";

export function RegisterDependencies(plugin: DmsAssistantPlugin) {
    RegisterSingleton(Services.MessageService, new MessageService());
    RegisterSingleton(Services.DmsAssistantPlugin, plugin);
    RegisterSingleton(Services.OdbCache, new OdbCache());
    RegisterSingleton(Services.ModalService, new ModalService())
    RegisterSingleton(Services.FileSystemService, new FileSystemService(plugin));
    RegisterSingleton(Services.ConversationFileSystemService, new ConversationFileSystemService());

    RegisterSingleton<IPrompt>(Services.IPrompt, new AIPrompt());
    RegisterSingleton<IActioner>(Services.IActioner, new Actioner());

    RegisterTransient<StreamingMarkdownService>(Services.StreamingMarkdownService, () => new StreamingMarkdownService());

    RegisterAiProvider(plugin);
}

export function RegisterAiProvider(plugin: DmsAssistantPlugin) {
    if (plugin.settings.apiProvider == AIProvider.Gemini && plugin.settings.apiKey != "") {
        RegisterTransient<IActionDefinitions>(Services.IActionDefinitions, () => new GeminiActionDefinitions());
        RegisterSingleton<IAIClass>(Services.IAIClass, new Gemini(plugin.settings.apiKey));
    }
}
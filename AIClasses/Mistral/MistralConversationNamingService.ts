import { ChatCompletionsConversationNamingService } from "AIClasses/ChatCompletions/ChatCompletionsConversationNamingService";
import { AIProvider, AIProviderURL, AIProviderModel } from "Enums/ApiProvider";

export class MistralConversationNamingService extends ChatCompletionsConversationNamingService {

    public constructor() {
        super(AIProvider.Mistral);
    }

    protected get apiUrl(): string {
        return AIProviderURL.Mistral;
    }

    protected get namerModel(): string {
        return AIProviderModel.MistralNamer;
    }
}

import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import { type IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { AIProvider } from "Enums/ApiProvider";
import type { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import type { SettingsService } from "Services/SettingsService";
import type { StreamingService } from "Services/StreamingService";
import type { StoredFunctionCall, StoredFunctionResponse } from "AIClasses/Schemas/AIFunctionTypes";
import { Role } from "Enums/Role";
import { StringTools } from "Helpers/StringTools";
import { Exception } from "Helpers/Exception";
import { ApiErrorType } from "Types/ApiError";

export abstract class BaseAIClass implements IAIClass {

    protected readonly apiKey: string;
    protected readonly aiPrompt: IPrompt = Resolve<IPrompt>(Services.IPrompt);
    protected readonly settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
    protected readonly streamingService: StreamingService = Resolve<StreamingService>(Services.StreamingService);
    protected readonly aiFunctionDefinitions: AIFunctionDefinitions = Resolve<AIFunctionDefinitions>(Services.AIFunctionDefinitions);

    protected constructor(provider: AIProvider) {
        this.apiKey = this.settingsService.getApiKeyForProvider(provider);
    }


    public abstract streamRequest(
        conversation: Conversation,
        allowDestructiveActions: boolean,
        abortSignal?: AbortSignal
    ): AsyncGenerator<IStreamChunk, void, unknown>;

    protected abstract parseStreamChunk(chunk: string): IStreamChunk;
    protected abstract extractContents(conversationContent: ConversationContent[]): object;
    protected abstract mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): object;

    protected filterConversationContents(conversationContent: ConversationContent[]): ConversationContent[] {
        return conversationContent.filter((content, index, array) => {
            // Filter out empty content
            if (content.content.trim() === "" && content.functionCall.trim() === "") return false;

            // Keep non-function-calls
            if (!content.isFunctionCall) return true;

            // Keep if it's the last item (most recent)
            if (index === array.length - 1) return true;

            // Keep if next item is a function response
            const nextItem = array[index + 1];
            return nextItem && nextItem.isFunctionCallResponse;
        });
    }

    protected getContentToExtract(content: ConversationContent): string {
        return content.role === Role.User ? content.promptContent : content.content;
    }

    protected parseFunctionCall(functionCallJson: string): StoredFunctionCall | null {
        if (!StringTools.isValidJson(functionCallJson)) {
            Exception.log(`Invalid JSON in functionCall field:\n${functionCallJson}`);
            return null;
        }
        try {
            return JSON.parse(functionCallJson) as StoredFunctionCall;
        } catch (error) {
            Exception.log(error);
            return null;
        }
    }

    protected parseFunctionResponse(responseJson: string): StoredFunctionResponse | null {
        if (!StringTools.isValidJson(responseJson)) {
            Exception.log(`Invalid JSON in function response content:\n${responseJson}`);
            return null;
        }
        try {
            return JSON.parse(responseJson) as StoredFunctionResponse;
        } catch (error) {
            Exception.log(error);
            return null;
        }
    }

    protected createErrorChunk(error: unknown): IStreamChunk {
        Exception.log(error);
        return {
            content: "",
            isComplete: true,
            error: `Failed to parse chunk: ${Exception.messageFrom(error)}`,
            errorType: ApiErrorType.UNKNOWN
        };
    }

    protected async buildSystemPrompt(): Promise<string> {
        return [
            this.aiPrompt.systemInstruction(),
            await this.aiPrompt.userInstruction()
        ].filter(s => s).join("\n\n");
    }
}

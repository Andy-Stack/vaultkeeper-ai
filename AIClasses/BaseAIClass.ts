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
import { ApiError, ApiErrorType } from "Types/ApiError";
import type { AbortService } from "Services/AbortService";

export abstract class BaseAIClass implements IAIClass {

    protected readonly apiKey: string;
    protected readonly aiPrompt: IPrompt;
    protected readonly abortService: AbortService;
    protected readonly settingsService: SettingsService;
    protected readonly streamingService: StreamingService;
    protected readonly aiFunctionDefinitions: AIFunctionDefinitions;

    protected constructor(provider: AIProvider) {
        this.aiPrompt = Resolve<IPrompt>(Services.IPrompt);
        this.abortService = Resolve<AbortService>(Services.AbortService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.streamingService = Resolve<StreamingService>(Services.StreamingService);
        this.aiFunctionDefinitions = Resolve<AIFunctionDefinitions>(Services.AIFunctionDefinitions);

        this.apiKey = this.settingsService.getApiKeyForProvider(provider);
    }


    public abstract streamRequest(
        conversation: Conversation,
        allowDestructiveActions: boolean,
        abortSignal?: AbortSignal
    ): AsyncGenerator<IStreamChunk, void, unknown>;

    protected abstract parseStreamChunk(chunk: string): IStreamChunk;
    protected abstract extractContents(conversationContent: ConversationContent[]): unknown;
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

    protected throwRetryableError(message: string, code?: string, errorType?: ApiErrorType): never {
        throw new ApiError({
            type: errorType || ApiErrorType.SERVER_ERROR,
            message: code ? `${message} (${code})` : message,
            userMessage: "Service error.",
            isRetryable: true
        });
    }

    protected createErrorChunk(error: unknown, errorType?: ApiErrorType, userMessage?: string): IStreamChunk {
        // let ApiError propagate
        if (error instanceof ApiError) {
            throw error;
        }

        Exception.log(error);
        return {
            content: "",
            isComplete: true,
            error: userMessage || `Failed to parse chunk: ${Exception.messageFrom(error)}`,
            errorType: errorType || ApiErrorType.UNKNOWN
        };
    }

    protected async buildSystemPrompt(): Promise<string> {
        return [
            this.aiPrompt.systemInstruction(),
            await this.aiPrompt.userInstruction()
        ].filter(s => s).join("\n\n");
    }

    /**
     * Converts a function call to legacy text format for cross-provider compatibility.
     * Used when a provider doesn't have the required ID field (e.g., Gemini → Claude/OpenAI).
     */
    protected convertFunctionCallToText(parsedContent: StoredFunctionCall): string {
        const formattedJson = JSON.stringify({
            name: parsedContent.functionCall.name,
            args: parsedContent.functionCall.args
        }, null, 2);

        return `<!-- Historical tool call. This action was ALREADY COMPLETED.
     Use your native function calling for any NEW operations. -->
${formattedJson}`;
    }

    /**
     * Converts a function response to legacy text format for cross-provider compatibility.
     * Used when a provider doesn't have the required ID field (e.g., Gemini → Claude/OpenAI).
     */
    protected convertFunctionResponseToText(parsedContent: StoredFunctionResponse): string {
        const formattedJson = JSON.stringify({
            name: parsedContent.functionResponse.name,
            response: parsedContent.functionResponse.response
        }, null, 2);

        return `<!-- Historical tool result. This action was ALREADY COMPLETED. -->
${formattedJson}`;
    }
}

import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import { type IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { AIProvider } from "Enums/ApiProvider";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import type { Attachment } from "Conversations/Attachment";
import type { SettingsService } from "Services/SettingsService";
import type { StreamingService } from "Services/StreamingService";
import type { StoredFunctionCall, StoredFunctionResponse } from "AIClasses/Schemas/AIFunctionTypes";
import { StringTools } from "Helpers/StringTools";
import { Exception } from "Helpers/Exception";
import { ApiError, ApiErrorType } from "Types/ApiError";
import type { AbortService } from "Services/AbortService";
import type { IAIFileService } from "./IAIFileService";

export abstract class BaseAIClass implements IAIClass {

    protected readonly provider: AIProvider;
    protected readonly apiKey: string;
    protected readonly abortService: AbortService;
    protected readonly aiFileService: IAIFileService;
    protected readonly settingsService: SettingsService;
    protected readonly streamingService: StreamingService;

    private _systemPrompt: string = "";
    private _userInstruction: string = "";
    private _toolDefinitions: IAIFunctionDefinition[] = [];

    protected constructor(provider: AIProvider) {
        this.provider = provider;
        this.abortService = Resolve<AbortService>(Services.AbortService);
        this.aiFileService = Resolve<IAIFileService>(Services.IAIFileService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.streamingService = Resolve<StreamingService>(Services.StreamingService);

        this.apiKey = this.settingsService.getApiKeyForProvider(provider);
    }

    public set systemPrompt(systemPrompt: string) {
        this._systemPrompt = systemPrompt;
    }

    public get systemPrompt(): string {
        return this._systemPrompt;
    }

    public set userInstruction(userInstruction: string) {
        this._userInstruction = userInstruction;
    }

    public get userInstruction(): string {
        return this._userInstruction;
    }

    public get toolDefinitions(): IAIFunctionDefinition[] {
        return this._toolDefinitions;
    }

    public set toolDefinitions(toolDefinitions: IAIFunctionDefinition[]) {
        this._toolDefinitions = toolDefinitions;
    }

    public abstract streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown>;

    public abstract formatBinaryFiles(attachments: Attachment[]): string;

    protected abstract parseStreamChunk(chunk: string): IStreamChunk;
    protected abstract extractContents(conversationContent: ConversationContent[]): unknown;
    protected abstract mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): object;

    protected filterConversationContents(conversationContent: ConversationContent[]): ConversationContent[] {
        return conversationContent.filter((content, index, array) => {
            if (!content.content && !content.functionCall && !content.functionResponse && (!content.attachments || content.attachments.length === 0)) {
                return false; // Filter out empty content
            }

            if (!content.functionCall) {
                return true; // Keep non-function-calls
            }

            // Keep if it's the last item (most recent)
            if (index === array.length - 1) return true;

            // Keep if next item is a function response
            const nextItem = array[index + 1];
            return nextItem && nextItem.functionResponse;
        });
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

    protected async processAttachments<T>(
        attachments: Attachment[],
        formatBinaryFiles: (attachments: Attachment[]) => string
    ): Promise<{ formattedParts: T[], uploadErrors: Error[] }> {
        const uploadErrors: Error[] = [];

        for (const attachment of attachments) {
            try {
                if (attachment.base64.trim() === "") {
                    Exception.throw(`Failed to upload ${attachment.fileName}: File has no content`);
                }
                await this.aiFileService.uploadFile(attachment);
                if (!attachment.getFileID(this.provider)) {
                    Exception.throw(`Failed to upload ${attachment.fileName}: File ID undefined after upload attempt`);
                }
            } catch (error) {
                uploadErrors.push(Exception.new(error));
            }
        }

        const formattedContent = formatBinaryFiles(attachments);
        const formattedParts = JSON.parse(formattedContent) as T[];

        return { formattedParts, uploadErrors };
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

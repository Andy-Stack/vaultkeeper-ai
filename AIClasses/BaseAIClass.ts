import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import { type IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { type AIProvider, isValidProviderModel } from "Enums/ApiProvider";
import { AIEffort, EFFORT_BY_MODEL } from "Enums/AIEffort";
import type { IAIToolDefinition } from "AIClasses/ToolDefinitions/IAIToolDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import type { Attachment } from "Conversations/Attachment";
import type { SettingsService } from "Services/SettingsService";
import type { StreamingService } from "Services/StreamingService";
import type { StoredToolCall, StoredFunctionResponse } from "AIClasses/Schemas/AIToolTypes";
import { Exception } from "Helpers/Exception";
import { ApiError, ApiErrorType } from "Types/ApiError";
import type { AbortService } from "Services/AbortService";
import type { IAIFileService } from "./IAIFileService";
import { AgentType } from "Enums/AgentType";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import type { MimeType } from "Enums/MimeType";
import { parseToolCalls } from "Helpers/ResponseHelper";

export abstract class BaseAIClass implements IAIClass {

    protected apiKey: string;

    protected readonly provider: AIProvider;
    protected readonly abortService: AbortService;
    protected readonly aiFileService: IAIFileService;
    protected readonly settingsService: SettingsService;
    protected readonly streamingService: StreamingService;

    private _systemPrompt: string = "";
    private _userInstruction: string = "";
    private _agentType: AgentType = AgentType.Main;
    private _aiToolDefinitions: IAIToolDefinition[] = [];
    private _aiToolUsageMode: AIToolUsageMode = AIToolUsageMode.Auto;

    protected constructor(provider: AIProvider) {
        this.provider = provider;
        this.abortService = Resolve<AbortService>(Services.AbortService);
        this.aiFileService = Resolve<IAIFileService>(Services.IAIFileService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.streamingService = Resolve<StreamingService>(Services.StreamingService);

        this.apiKey = this.settingsService.getApiKeyForProvider(provider);
    }

    public get currentProvider(): AIProvider {
        return this.provider;
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

    public get aiToolDefinitions(): IAIToolDefinition[] {
        return this._aiToolDefinitions;
    }

    public set aiToolDefinitions(aiToolDefinitions: IAIToolDefinition[]) {
        this._aiToolDefinitions = aiToolDefinitions;
    }

    public get agentType() {
        return this._agentType;
    }

    public set agentType(agentType: AgentType) {
        this._agentType = agentType;
    }

    public get aiToolUsageMode(): AIToolUsageMode {
        return this._aiToolUsageMode;
    }

    public set aiToolUsageMode(mode: AIToolUsageMode) {
        this._aiToolUsageMode = mode;
    }

    public abstract streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown>;

    protected abstract formatBinaryFiles(attachments: Attachment[]): Promise<string>;

    protected abstract parseStreamChunk(chunk: string): IStreamChunk;
    protected abstract extractContents(conversationContent: ConversationContent[]): unknown;
    protected abstract mapFunctionDefinitions(aiToolDefinitions: IAIToolDefinition[]): object;

    /** The MIME types this provider can accept as attachments. */
    protected abstract get supportedMimeTypes(): MimeType[];

    protected isSupportedMimeType(mimeType: MimeType): boolean {
        return this.supportedMimeTypes.includes(mimeType);
    }

    /**
     * Maps the current AIToolUsageMode to a provider-specific tool-choice value.
     * The branching is identical across providers; only the returned shape differs
     * (a bare string for Chat Completions/Responses, an object for Claude/Gemini),
     * so callers supply the three concrete values.
     */
    protected buildToolChoice<T>(choices: { auto: T; enabled: T; disabled: T }): T {
        if (this.aiToolDefinitions.length === 0) {
            return choices.auto;
        }

        switch (this.aiToolUsageMode) {
            case AIToolUsageMode.Auto:
                return choices.auto;
            case AIToolUsageMode.Enabled:
                return choices.enabled;
            case AIToolUsageMode.Disabled:
                return choices.disabled;
        }
    }

    /**
     * Extracts a retry delay (in seconds) from a rate-limit error's HTTP response headers.
     * Shared by providers that surface rate limits via the standard `Retry-After` header
     * (Claude, OpenAI, Mistral). Providers that signal retry timing in the response body
     * (e.g. Gemini's RetryInfo) override this instead.
     */
    protected extractRetryDelay(error: ApiError): number | undefined {
        if (error.info.type !== ApiErrorType.RATE_LIMIT || !error.info.responseHeaders) {
            return undefined;
        }

        const headers = error.info.responseHeaders;

        // 1. Prefer the standard Retry-After header (seconds or HTTP-date)
        const retryAfter = headers.get('retry-after');
        if (retryAfter) {
            const seconds = Number(retryAfter);
            if (!Number.isNaN(seconds)) {
                return Math.max(0, seconds);
            }

            const date = new Date(retryAfter);
            if (!Number.isNaN(date.getTime())) {
                const delayMs = date.getTime() - Date.now();
                return Math.max(0, Math.ceil(delayMs / 1000));
            }
        }

        // 2. Fall back to provider-specific reset headers (e.g. OpenAI)
        const resetHeader =
            headers.get('x-ratelimit-reset-requests') ??
            headers.get('x-ratelimit-reset-tokens');

        if (resetHeader) {
            return this.parseDurationToSeconds(resetHeader);
        }

        return undefined;
    }

    /**
     * Parses duration strings (e.g. "15s", "600ms", "2m", "1h") into seconds.
     * Returns undefined if parsing fails.
     */
    protected parseDurationToSeconds(value: string): number | undefined {
        const trimmed = value.trim();
        const numericValue = parseFloat(trimmed);

        if (Number.isNaN(numericValue)) {
            return undefined;
        }

        if (trimmed.endsWith('ms')) {
            return Math.max(0, Math.ceil(numericValue / 1000));
        }
        if (trimmed.endsWith('s')) {
            return Math.max(0, numericValue);
        }
        if (trimmed.endsWith('m')) {
            return Math.max(0, numericValue * 60);
        }
        if (trimmed.endsWith('h')) {
            return Math.max(0, numericValue * 3600);
        }

        // Fallback: treat as raw seconds
        return Math.max(0, numericValue);
    }

    protected model(): string {
        switch (this._agentType) {
            case AgentType.Main:
                return this.settingsService.settings.model;
            case AgentType.Orchestration:
                return this.settingsService.settings.planningModel;
            case AgentType.Planning:
                return this.settingsService.settings.planningModel;
            case AgentType.Execution:
                return this.settingsService.settings.model;
            case AgentType.QuickAction:
                return this.settingsService.settings.quickActionModel;
        }
    }

    /** The provider-specific effort value for the current model, or undefined when the model has none. */
    protected effort(): string | undefined {
        const model = this.model();
        const effort = this._agentType === AgentType.QuickAction ? AIEffort.Fast : this.settingsService.settings.effort;
        return isValidProviderModel(model) ? EFFORT_BY_MODEL[model]?.[effort] : undefined;
    }

    protected filterConversationContents(conversationContent: ConversationContent[]): ConversationContent[] {
        const results: ConversationContent[] = [];
        let index = 0;

        while (index < conversationContent.length) {
            const content = conversationContent[index];

            if (!content.content && !content.toolCalls && !content.functionResponse && (!content.attachments || content.attachments.length === 0)) {
                index++;
                continue; // Filter out empty content
            }

            if (content.functionResponse) { // Filter out 'lone' function responses, valid ones are consumed with their calls below
                Exception.warn(`[Filter Debug] Filtered orphaned function response at index ${index}/${conversationContent.length}:\n` +
                    `  ToolId: ${content.toolId}\n` +
                    `  Response: ${content.functionResponse}`);
                index++;
                continue;
            }

            if (!content.toolCalls) {
                results.push(content); // Keep non-function-calls
                index++;
                continue;
            }

            // Every call made in a turn is answered by a contiguous run of responses
            let groupEnd = index + 1;
            while (groupEnd < conversationContent.length && conversationContent[groupEnd].functionResponse) {
                groupEnd++;
            }
            const responses = conversationContent.slice(index + 1, groupEnd);

            if (responses.length === 0 && groupEnd === conversationContent.length) {
                results.push(content); // Keep if it's the last item (most recent)
            } else if (this.isAnsweredToolCallGroup(content, responses)) {
                results.push(content, ...responses);
            } else {
                Exception.warn(`[Filter Debug] Filtered unanswered function calls at index ${index}/${conversationContent.length}:\n` +
                    `  Calls: ${content.toolCalls}\n` +
                    `  Response toolIds: ${responses.map(response => response.toolId).join(", ")}`);
            }
            index = groupEnd;
        }

        return results;
    }

    // Calls with ids are matched to responses by id, providers without ids (Gemini) answer in call order
    private isAnsweredToolCallGroup(content: ConversationContent, responses: ConversationContent[]): boolean {
        const toolCalls = parseToolCalls(content.toolCalls ?? "");
        if (!toolCalls || toolCalls.length !== responses.length) {
            return false;
        }

        const hasId = (id: string | undefined) => !!id && id.trim() !== "";

        if (toolCalls.every(toolCall => hasId(toolCall.toolCall.id))) {
            const responseIds = new Set(responses.map(response => response.toolId));
            return toolCalls.every(toolCall => responseIds.has(toolCall.toolCall.id));
        }

        return responses.every(response => !hasId(response.toolId));
    }

    /**
     * Merges consecutive messages with the same role, so every result for a turn's tool calls
     * (and any attachments they produced) is sent in a single message, as Claude and Gemini require.
     */
    protected mergeConsecutiveRoles<T extends { role: string }>(messages: T[], mergeInto: (target: T, source: T) => void): T[] {
        const merged: T[] = [];
        for (const message of messages) {
            const previous = merged[merged.length - 1];
            if (previous && previous.role === message.role) {
                mergeInto(previous, message);
                continue;
            }
            merged.push(message);
        }
        return merged;
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
        formatBinaryFiles: (attachments: Attachment[]) => Promise<string>
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

        const formattedContent = await formatBinaryFiles(attachments);
        const formattedParts = JSON.parse(formattedContent) as T[];

        return { formattedParts, uploadErrors };
    }

    /**
     * Converts a function call to legacy text format for cross-provider compatibility.
     * Used when a provider doesn't have the required ID field (e.g., Gemini → Claude/OpenAI).
     */
    protected convertToolCallToText(parsedContent: StoredToolCall): string {
        const formattedJson = JSON.stringify({
            name: parsedContent.toolCall.name,
            args: parsedContent.toolCall.args
        }, null, 2);

        return `<!-- Historical tool call. This action was ALREADY COMPLETED.
     Use your native function calling for any NEW operations. -->
${formattedJson}`;
    }

    protected convertToolCallsToText(toolCalls: StoredToolCall[]): string {
        return toolCalls.map(toolCall => this.convertToolCallToText(toolCall)).join("\n\n");
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

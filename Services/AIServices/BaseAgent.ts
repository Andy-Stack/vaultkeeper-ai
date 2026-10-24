import { AIToolCall } from "AIClasses/AIToolCall";
import type { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIPrompts/IPrompt";
import type { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { type Thought, thoughtsToConversationString } from "Conversations/Thought";
import { providerContentToConversationString } from "Conversations/ProviderContent";
import { AgentType } from "Enums/AgentType";
import { Copy } from "Enums/Copy";
import { Role } from "Enums/Role";
import { sanitizeToolCallContent } from "Helpers/ResponseHelper";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { Resolve, TryResolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { AIToolService } from "./AIToolService";
import type { DebugService } from "Services/DebugService";
import { DebugColor } from "Enums/DebugColor";
import { Exception } from "Helpers/Exception";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import type { SettingsService } from "Services/SettingsService";

export abstract class BaseAgent {
    
    protected ai: IAIClass | undefined;
    protected readonly aiPrompt: IPrompt;
    protected readonly aiToolService: AIToolService;
    protected readonly debugService: DebugService | undefined;

    private readonly settingsService: SettingsService;

    private onSaveConversation?: (conversation: Conversation) => Promise<void>;

    public constructor() {
        this.aiPrompt = Resolve<IPrompt>(Services.IPrompt);
        this.aiToolService = Resolve<AIToolService>(Services.AIToolService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.debugService = TryResolve<DebugService>(Services.DebugService);
        this.setDebugColor();
    }

    public resolveAIProvider() {
        this.ai = Resolve<IAIClass>(Services.IAIClass);
    }

    public setSaveCallback(callback: (conversation: Conversation) => Promise<void>) {
        this.onSaveConversation = callback;
    }

    protected webViewerAccessEnabled(): boolean {
        return this.settingsService.settings.enableWebViewer;
    }

    protected memoriesEnabled(): boolean {
        return this.settingsService.settings.enableMemories;
    }

    protected updateMemoriesEnabled(): boolean {
        return this.settingsService.settings.allowUpdatingMemories;
    }

    protected async runAgentLoop(agentType: AgentType, conversation: Conversation, callbacks: IChatServiceCallbacks,
        handleToolCalls: (toolCalls: AIToolCall[]) => Promise<{ shouldExit: boolean }>
    ): Promise<void> {
        this.debugService?.log("AgentLoop", `Starting ${agentType} agent loop`);
        let response = await this.streamRequestResponse(agentType, this.ensureCorrectConversationStructure(conversation), callbacks);

        await this.saveConversation(agentType, conversation);

        while (response.toolCalls.length > 0 || response.shouldContinue) {
            if (response.toolCalls.length > 0) {
                this.debugService?.log("ToolCall", `${agentType} received ${response.toolCalls.length} function call(s): ${response.toolCalls.map(toolCall => toolCall.name).join(", ")}`);
                const result = await handleToolCalls(response.toolCalls);
                if (result.shouldExit) {
                    this.debugService?.log("AgentLoop", `${agentType} exiting loop (shouldExit: true)`);
                    await this.saveConversation(agentType, conversation);
                    return;
                }
            }

            response = await this.streamRequestResponse(agentType, this.ensureCorrectConversationStructure(conversation), callbacks);

            await this.saveConversation(agentType, conversation);
        }
        this.debugService?.log("AgentLoop", `${agentType} agent loop completed`);
    }

    /**
     * Resolves every call made in a turn, returning a response for each in the order they were called.
     * Agent-specific tools are resolved by the agent, everything else is performed as a single batch so
     * that all edits are reviewed in one diff. The batch runs first so agent tools that end the turn
     * (e.g. completing a task) are answered after the work they summarise.
     */
    protected async resolveToolCalls(toolCalls: AIToolCall[], callbacks: IChatServiceCallbacks,
        isAgentTool: (toolCall: AIToolCall) => boolean,
        resolveAgentTool: (toolCall: AIToolCall) => Promise<AIToolResponse>
    ): Promise<AIToolResponse[]> {
        const responses = new Map<AIToolCall, AIToolResponse>();

        const batchToolCalls = toolCalls.filter(toolCall => !isAgentTool(toolCall));
        const batchResponses = await this.performAITools(batchToolCalls, callbacks);
        batchToolCalls.forEach((toolCall, index) => responses.set(toolCall, batchResponses[index]));

        for (const toolCall of toolCalls.filter(isAgentTool)) {
            responses.set(toolCall, await resolveAgentTool(toolCall));
        }

        return toolCalls.map(toolCall => responses.get(toolCall)!);
    }

    protected async requestAgentResponse(agentType: AgentType, conversation: Conversation, callbacks: IChatServiceCallbacks): Promise<string> {
        return await this.withToolCallingDisabled(async () => {
            await this.streamRequestResponse(agentType, this.ensureCorrectConversationStructure(conversation), callbacks);

            const lastContent = conversation.contents[conversation.contents.length - 1];
            const textResponse = lastContent?.content?.trim() ?? "";

            if (textResponse === "") {
                conversation.contents.push(new ConversationContent({
                    role: Role.User,
                    content: Copy.TextResponseRequired
                }));
                return await this.requestAgentResponse(agentType, conversation, callbacks);
            }
            return textResponse;
        });
    }

    protected setDebugColor() {
        this.debugService?.setDebugColor(DebugColor.WHITE);
    }

    private async saveConversation(agentType: AgentType, conversation: Conversation) {
        if (agentType === AgentType.Main) {
            await this.onSaveConversation?.(conversation);
        }
    }

    private ensureCorrectConversationStructure(conversation: Conversation): Conversation {
        // Check if the last message is from the assistant to prevent assistant-to-assistant structure
        // This can happen when the assistant's last message had no function call and the user sends a new request
        if (conversation.contents.length > 0) {
            const lastMessage = conversation.contents[conversation.contents.length - 1];
            if (lastMessage.role === Role.Assistant) {
                // Insert a hidden "Continue" message to maintain proper conversation structure
                conversation.contents.push(ConversationContent.safeContinue());
            }
        }
        return conversation;
    }

    private async streamRequestResponse(agentType: AgentType, conversation: Conversation, callbacks: IChatServiceCallbacks
    ): Promise<{ toolCalls: AIToolCall[], shouldContinue: boolean }> {
        if (!this.ai) { // this should never happen
            return { toolCalls: [], shouldContinue: false };
        }

        const conversationContent = new ConversationContent({ role: Role.Assistant });
        conversation.contents.push(conversationContent);

        let accumulatedContent = "";
        const capturedToolCalls: AIToolCall[] = [];
        const capturedThoughts: Thought[] = [];
        const capturedProviderBlocks: unknown[] = [];
        let capturedShouldContinue = false;

        for await (const chunk of this.ai.streamRequest(conversation)) {
            if (chunk.error && chunk.errorType) {
                this.debugService?.log("StreamError", `AI stream error for ${agentType}: ${chunk.errorType}`);
                conversationContent.content = chunk.error;
                conversationContent.errorType = chunk.errorType;
                callbacks.onStreamingUpdate();
                break;
            }

            if (chunk.toolCallStarted) {
                this.debugService?.log("ToolCallStarted", `Tool call started: ${chunk.toolCallStarted}`);
                callbacks.onToolCallStarted(chunk.toolCallStarted);
            }

            if (chunk.thought) {
                callbacks.onThought(chunk.thought);
            }

            if (chunk.completedThought) {
                capturedThoughts.push(chunk.completedThought);
            }

            if (chunk.providerBlocks) {
                capturedProviderBlocks.push(...chunk.providerBlocks);
            }

            if (chunk.toolCalls) {
                for (const toolCall of chunk.toolCalls) {
                    this.debugService?.log("ToolCall", `Function call captured: ${toolCall.name}`);
                }
                capturedToolCalls.push(...chunk.toolCalls);
            }

            if (chunk.shouldContinue) {
                capturedShouldContinue = true;
            }

            if (chunk.content) {
                accumulatedContent += chunk.content;
                conversationContent.content = accumulatedContent;
            }

            if (chunk.isComplete) {
                const sanitizedContent = sanitizeToolCallContent(accumulatedContent, capturedToolCalls);

                if (sanitizedContent.trim() === "" && capturedToolCalls.length === 0) {
                    conversation.contents.pop();
                } else {
                    conversationContent.content = sanitizedContent;
                    if (capturedThoughts.length > 0) {
                        conversationContent.thoughts = thoughtsToConversationString(capturedThoughts);
                    }
                    if (capturedProviderBlocks.length > 0) {
                        conversationContent.providerContent = providerContentToConversationString({
                            provider: this.ai.currentProvider,
                            blocks: capturedProviderBlocks
                        });
                    }
                    if (capturedToolCalls.length > 0) {
                        conversationContent.toolCalls = AIToolCall.toConversationString(capturedToolCalls);
                        conversationContent.shouldDisplayContent = sanitizedContent.trim() !== "";
                    }
                }
            }

            if (conversationContent.content?.trim() !== "") {
                callbacks.onStreamingUpdate();
            } else {
                conversationContent.shouldDisplayContent = false;
            }
        }

        callbacks.onStreamingUpdate();

        return { toolCalls: capturedToolCalls, shouldContinue: capturedShouldContinue };
    }

    // Returns a response for each call, in call order
    private async performAITools(toolCalls: AIToolCall[], callbacks: IChatServiceCallbacks): Promise<AIToolResponse[]> {
        if (toolCalls.length === 0) {
            return [];
        }

        const responses = new Map<AIToolCall, AIToolResponse>();

        // Provider-level tools (e.g. Mistral web search) are resolved before the tool service
        for (const toolCall of toolCalls) {
            const providerResult = await this.ai?.resolveToolCall?.(toolCall) ?? null;
            if (providerResult !== null) {
                responses.set(toolCall, providerResult);
            }
        }

        const serviceToolCalls = toolCalls.filter(toolCall => !responses.has(toolCall));
        if (serviceToolCalls.length > 0) {
            const serviceResponses = await this.aiToolService.performAITool(serviceToolCalls);
            serviceToolCalls.forEach((toolCall, index) => responses.set(toolCall, serviceResponses[index]));

            for (const response of serviceResponses) {
                for (const artifact of response.payload.artifacts) {
                    callbacks.onArtifactProduced(artifact);
                }
            }
        }

        return toolCalls.map(toolCall => responses.get(toolCall)!);
    }

    private async withToolCallingDisabled<T>(callback: () => Promise<T>): Promise<T> {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        
        const aiToolUsageMode = this.ai.aiToolUsageMode;
        this.ai.aiToolUsageMode = AIToolUsageMode.Disabled;

        const result = await callback();

        this.ai.aiToolUsageMode = aiToolUsageMode;
        return result;
    }
}
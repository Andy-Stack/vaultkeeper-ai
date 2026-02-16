import type { AIToolCall } from "AIClasses/AIToolCall";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIPrompts/IPrompt";
import type { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
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

export abstract class BaseAgent {
    
    protected ai: IAIClass | undefined;
    protected readonly aiPrompt: IPrompt;
    protected readonly aiToolService: AIToolService;
    protected readonly debugService: DebugService | undefined;

    private onSaveConversation?: (conversation: Conversation) => Promise<void>;

    public constructor() {
        this.aiPrompt = Resolve<IPrompt>(Services.IPrompt);
        this.aiToolService = Resolve<AIToolService>(Services.AIToolService);
        this.debugService = TryResolve<DebugService>(Services.DebugService);
        this.setDebugColor();
    }

    public resolveAIProvider() {
        this.ai = Resolve<IAIClass>(Services.IAIClass);
    }

    public setSaveCallback(callback: (conversation: Conversation) => Promise<void>) {
        this.onSaveConversation = callback;
    }

    protected async runAgentLoop(agentType: AgentType, conversation: Conversation, callbacks: IChatServiceCallbacks,
        handleToolCall: (toolCall: AIToolCall) => Promise<{ shouldExit: boolean }>
    ): Promise<void> {
        this.debugService?.log("AgentLoop", `Starting ${agentType} agent loop`);
        let response = await this.streamRequestResponse(agentType, this.ensureCorrectConversationStructure(conversation), callbacks);

        await this.saveConversation(agentType, conversation);

        while (response.toolCall || response.shouldContinue) {
            if (response.toolCall) {
                this.debugService?.log("ToolCall", `${agentType} received function call: ${response.toolCall.name}`);
                const result = await handleToolCall(response.toolCall);
                if (result.shouldExit) {
                    this.debugService?.log("AgentLoop", `${agentType} exiting loop (shouldExit: true)`);
                    await this.saveConversation(agentType, conversation);
                    return;
                }
            } else {
                callbacks.onThoughtUpdate(Copy.AIThoughtMessage);
            }

            response = await this.streamRequestResponse(agentType, this.ensureCorrectConversationStructure(conversation), callbacks);

            await this.saveConversation(agentType, conversation);
        }
        this.debugService?.log("AgentLoop", `${agentType} agent loop completed`);
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

    protected updateThought(toolCall: AIToolCall | null, callbacks: IChatServiceCallbacks) {
        const userMessage = toolCall?.arguments.user_message;
        if (userMessage && typeof userMessage === "string") {
            callbacks.onThoughtUpdate(userMessage);
        }
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
    ): Promise<{ toolCall: AIToolCall | null, shouldContinue: boolean }> {
        if (!this.ai) { // this should never happen
            return { toolCall: null, shouldContinue: false };
        }

        const conversationContent = new ConversationContent({ role: Role.Assistant });
        conversation.contents.push(conversationContent);

        let accumulatedContent = "";
        let capturedToolCall: AIToolCall | null = null;
        let capturedShouldContinue = false;

        for await (const chunk of this.ai.streamRequest(conversation)) {
            if (chunk.error && chunk.errorType) {
                this.debugService?.log("StreamError", `AI stream error for ${agentType}: ${chunk.errorType}`);
                conversationContent.content = chunk.error;
                conversationContent.errorType = chunk.errorType;
                callbacks.onStreamingUpdate(null);
                break;
            }

            if (chunk.toolCallStarted) {
                this.debugService?.log("ToolCallStarted", `Tool call started: ${chunk.toolCallStarted}`);
                callbacks.onToolCallStarted(chunk.toolCallStarted);
            }

            if (chunk.toolCall) {
                this.debugService?.log("ToolCall", `Function call captured: ${chunk.toolCall.name}`);
                capturedToolCall = chunk.toolCall;
            }

            if (chunk.shouldContinue) {
                capturedShouldContinue = true;
            }

            if (chunk.content) {
                accumulatedContent += chunk.content;

                conversationContent.content = accumulatedContent;
                if (accumulatedContent.trim() !== "" && agentType == AgentType.Main) {
                    callbacks.onThoughtUpdate(null);
                }
            }

            if (chunk.isComplete) {
                const sanitizedContent = sanitizeToolCallContent(accumulatedContent, capturedToolCall);

                if (sanitizedContent.trim() === "" && !capturedToolCall) {
                    conversation.contents.pop();
                } else {
                    conversationContent.content = sanitizedContent;
                    if (capturedToolCall) {
                        conversationContent.toolCall = capturedToolCall.toConversationString();
                        conversationContent.toolId = capturedToolCall.toolId;
                        conversationContent.shouldDisplayContent = sanitizedContent.trim() !== "";
                        if (capturedToolCall.thoughtSignature) {
                            conversationContent.thoughtSignature = capturedToolCall.thoughtSignature;
                        }
                    }
                }
            }

            if (conversationContent.content?.trim() !== "") {
                callbacks.onStreamingUpdate(conversationContent.timestamp.getTime().toString());
            } else {
                conversationContent.shouldDisplayContent = false;
            }
        }

        callbacks.onStreamingUpdate(null);

        return { toolCall: capturedToolCall, shouldContinue: capturedShouldContinue };
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
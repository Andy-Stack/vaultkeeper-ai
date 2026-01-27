import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIPrompts/IPrompt";
import type { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { AgentType } from "Enums/AgentType";
import { Copy } from "Enums/Copy";
import { Role } from "Enums/Role";
import { sanitizeFunctionCallContent } from "Helpers/ResponseHelper";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { AIFunctionService } from "./AIFunctionService";

export class AIController {
    
    protected ai: IAIClass | undefined;
    protected readonly aiPrompt: IPrompt;
    protected readonly aiFunctionService: AIFunctionService;

    private onSaveConversation?: (conversation: Conversation) => Promise<void>;

    public constructor() {
        this.aiPrompt = Resolve<IPrompt>(Services.IPrompt);
        this.aiFunctionService = Resolve<AIFunctionService>(Services.AIFunctionService);
    }

    public resolveAIProvider() {
        this.ai = Resolve<IAIClass>(Services.IAIClass);
    }

    public setSaveCallback(callback: (conversation: Conversation) => Promise<void>) {
        this.onSaveConversation = callback;
    }

    protected async runAgentLoop(agentType: AgentType, conversation: Conversation, callbacks: IChatServiceCallbacks,
        handleFunctionCall: (functionCall: AIFunctionCall) => Promise<{ shouldExit: boolean }>
    ): Promise<void> {
        let response = await this.streamRequestResponse(agentType, this.ensureCorrectConversationStructure(conversation), callbacks);

        this.saveConversation(agentType, conversation);

        while (response.functionCall || response.shouldContinue) {
            if (response.functionCall) {
                const result = await handleFunctionCall(response.functionCall);
                if (result.shouldExit) {
                    this.saveConversation(agentType, conversation);
                    return;
                }
            } else {
                callbacks.onThoughtUpdate(Copy.AIThoughtMessage);
            }

            response = await this.streamRequestResponse(agentType, this.ensureCorrectConversationStructure(conversation), callbacks);

            this.saveConversation(agentType, conversation);
        }
    }

    protected async requestAgentResponse(conversation: Conversation, callbacks: IChatServiceCallbacks): Promise<string> {
        const response = await this.streamRequestResponse(AgentType.Main, this.ensureCorrectConversationStructure(conversation), callbacks);

        if (response.functionCall) {
            conversation.addFunctionResponse(new AIFunctionResponse(
                response.functionCall.name,
                { error: Copy.TextResponseToolDenial },
                response.functionCall.toolId
            ));
            return await this.requestAgentResponse(conversation, callbacks);
        }

        const lastContent = conversation.contents[conversation.contents.length - 1];
        const textResponse = lastContent?.content?.trim() ?? "";

        if (textResponse === "") {
            conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: Copy.TextResponseRequired
            }));
            return await this.requestAgentResponse(conversation, callbacks);
        }

        return textResponse;
    }

    protected updateThought(functionCall: AIFunctionCall | null, callbacks: IChatServiceCallbacks) {
        const userMessage = functionCall?.arguments.user_message;
        if (userMessage && typeof userMessage === "string") {
            callbacks.onThoughtUpdate(userMessage);
        }
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
    ): Promise<{ functionCall: AIFunctionCall | null, shouldContinue: boolean }> {
        if (!this.ai) { // this should never happen
            return { functionCall: null, shouldContinue: false };
        }

        const conversationContent = new ConversationContent({ role: Role.Assistant });
        conversation.contents.push(conversationContent);

        let accumulatedContent = "";
        let capturedFunctionCall: AIFunctionCall | null = null;
        let capturedShouldContinue = false;

        for await (const chunk of this.ai.streamRequest(conversation)) {
            if (chunk.error && chunk.errorType) {
                conversationContent.content = chunk.error;
                conversationContent.errorType = chunk.errorType;
                callbacks.onStreamingUpdate(null);
                break;
            }

            if (chunk.functionCall) {
                capturedFunctionCall = chunk.functionCall;
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
                const sanitizedContent = sanitizeFunctionCallContent(accumulatedContent, capturedFunctionCall);

                if (sanitizedContent.trim() === "" && !capturedFunctionCall) {
                    conversation.contents.pop();
                } else {
                    conversationContent.content = sanitizedContent;
                    if (capturedFunctionCall) {
                        conversationContent.functionCall = capturedFunctionCall.toConversationString();
                        conversationContent.toolId = capturedFunctionCall.toolId;
                        conversationContent.shouldDisplayContent = sanitizedContent.trim() !== "";
                        if (capturedFunctionCall.thoughtSignature) {
                            conversationContent.thoughtSignature = capturedFunctionCall.thoughtSignature;
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

        return { functionCall: capturedFunctionCall, shouldContinue: capturedShouldContinue };
    }
}
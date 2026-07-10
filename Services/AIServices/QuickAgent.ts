import { AgentType } from "Enums/AgentType";
import { BaseAgent } from "./BaseAgent";
import { Conversation } from "Conversations/Conversation";
import { Exception } from "Helpers/Exception";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";

export class QuickAgent extends BaseAgent {

    public async quickAction(action: string, context: string): Promise<string | null> {
        
        this.setAgentPromptAndTools(action);

        const conversation = new Conversation();
        const conversationContent = new ConversationContent({
            role: Role.User,
            content: context,
        });
        conversation.contents.push(conversationContent);

        const result = await this.requestAgentResponse(AgentType.QuickAction, conversation, this.callbacks());
        if (conversation.contents.last()?.errorType) {
            return null;
        }
        return result;
    }

    private setAgentPromptAndTools(instruction: string): void {
        if (!this.ai) {
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.QuickAction;
        this.ai.aiToolUsageMode = AIToolUsageMode.Disabled;
        this.ai.systemPrompt = instruction;
        this.ai.userInstruction = ""; // do not include user instruction for quick agent
        this.ai.aiToolDefinitions = []; // no tools for quick agent
    }

    private callbacks(): IChatServiceCallbacks {
        return {
            onSubmit: () => {},
            onStreamingUpdate: () => {},
            onThoughtUpdate: () => {},
            onToolCallStarted: () => {},
            onArtifactProduced: () => {},
            onPlanningStarted: () => {},
            onPlanningFinished: () => {},
            onUserQuestion: async () => new Promise<string>(() => {}),
            onPlanApprovalRequest: async () => new Promise(() => {}),
            onPlanUpdate: () => {},
            onPlanStepUpdate: () => {},
            onPlanReset: () => {},
            onComplete: () => {},
        };
    }

}
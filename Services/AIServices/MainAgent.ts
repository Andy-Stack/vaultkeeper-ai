import type { Conversation } from "Conversations/Conversation";
import type { IChatServiceCallbacks } from "../ChatService";
import { AIToolDefinitions } from "AIClasses/ToolDefinitions/AIToolDefinitions";
import { Exception } from "Helpers/Exception";
import { AITool, isAITool } from "Enums/AITool";
import { AgentType } from "Enums/AgentType";
import { BaseAgent } from "./BaseAgent";
import { ExecuteWorkflowArgsSchema } from "AIClasses/Schemas/AIToolSchemas";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { OrchestrationAgent } from "./OrchestrationAgent";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { DebugColor } from "Enums/DebugColor";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import { AIToolResponsePayload } from "AIClasses/ToolDefinitions/AIToolResponsePayload";
import { ChatMode } from "Enums/ChatMode";

export class MainAgent extends BaseAgent {

    public async runMainAgent(conversation: Conversation, chatMode: ChatMode, callbacks: IChatServiceCallbacks) {
        await this.setAgentPromptAndTools(chatMode);
        this.debugService?.log("MainAgent", `Starting MainAgent (chatMode: ${chatMode})`);

        if (chatMode === ChatMode.Planning) {
            this.debugService?.log("MainAgent", "Planning mode enabled - workflow execution available");
            conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: "Planning mode is enabled, you should request planned execution when appropriate or if you do not have the required tools to complete the request",
                shouldDisplayContent: false
            }));
        }

        let workflowExecuted = false;

        await this.runAgentLoop(AgentType.Main, conversation, callbacks, async toolCalls => {
            const responses = await this.resolveToolCalls(toolCalls, callbacks,
                toolCall => isAITool(toolCall.name, AITool.ExecuteWorkflow),
                async toolCall => {
                    const parseResult = ExecuteWorkflowArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.ExecuteWorkflow}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    if (workflowExecuted) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `${AITool.ExecuteWorkflow} was already called this turn, only one workflow can run at a time. This call was ignored.` }),
                            toolCall.toolId
                        );
                    }
                    workflowExecuted = true;

                    // The workflow is answered alongside any other calls from this turn, so it runs inline
                    this.debugService?.log("MainAgent", "Spawning OrchestrationAgent for planned workflow");
                    const orchestrationAgent = new OrchestrationAgent();
                    orchestrationAgent.resolveAIProvider();
                    const workflowResult = await orchestrationAgent.runPlannedWorkflow(
                        parseResult.data, conversation.contents.map(c => c.attachments).flat(), callbacks);
                    this.debugService?.log("MainAgent", "OrchestrationAgent workflow completed");

                    // The orchestration agents share the AI provider, so restore the main agent's configuration
                    await this.setAgentPromptAndTools(chatMode);

                    return new AIToolResponse(toolCall.name, workflowResult, toolCall.toolId);
                });

            workflowExecuted = false;
            conversation.addFunctionResponses(responses);
            return { shouldExit: false };
        });
    }

    private async setAgentPromptAndTools(chatMode: ChatMode): Promise<void> {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Main;
        this.ai.aiToolUsageMode = AIToolUsageMode.Auto;
        this.ai.systemPrompt = await this.aiPrompt.systemInstruction();
        this.ai.userInstruction = await this.aiPrompt.userInstruction();
        this.ai.aiToolDefinitions = AIToolDefinitions.agentDefinitions(
            chatMode, this.memoriesEnabled(), this.updateMemoriesEnabled(), this.webViewerAccessEnabled());
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.BLUE);
    }
    
}
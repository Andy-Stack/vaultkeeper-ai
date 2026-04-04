import type { Conversation } from "Conversations/Conversation";
import type { IChatServiceCallbacks } from "../ChatService";
import { AIToolDefinitions } from "AIClasses/ToolDefinitions/AIToolDefinitions";
import { Exception } from "Helpers/Exception";
import { AITool, isAITool } from "Enums/AITool";
import { AgentType } from "Enums/AgentType";
import { BaseAgent } from "./BaseAgent";
import { ExecuteWorkflowArgsSchema, type ExecuteWorkflowArgs } from "AIClasses/Schemas/AIToolSchemas";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import type { AIToolCall } from "AIClasses/AIToolCall";
import { OrchestrationAgent } from "./OrchestrationAgent";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { DebugColor } from "Enums/DebugColor";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";

export class MainAgent extends BaseAgent {

    public async runMainAgent(conversation: Conversation, allowDestructiveActions: boolean, planningMode: boolean, callbacks: IChatServiceCallbacks) {
        await this.setAgentPromptAndTools(planningMode, allowDestructiveActions);
        this.debugService?.log("MainAgent", `Starting MainAgent (planningMode: ${planningMode}, destructive: ${allowDestructiveActions})`);

        if (planningMode) {
            this.debugService?.log("MainAgent", "Planning mode enabled - workflow execution available");
            conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: "Planning mode is enabled, you should request planned execution when appropriate or if you do not have the required tools to complete the request",
                shouldDisplayContent: false
            }));
        }

        let result = await this.runMainAgentLoop(conversation, callbacks);

        while (result.planRequest && result.toolCall) {
            this.debugService?.log("MainAgent", "Spawning OrchestrationAgent for planned workflow");
            const orchestrationAgent = new OrchestrationAgent();
            orchestrationAgent.resolveAIProvider();
            const workflowResult = await orchestrationAgent.runPlannedWorkflow(result.planRequest, callbacks);
            this.debugService?.log("MainAgent", "OrchestrationAgent workflow completed");

            conversation.addFunctionResponse(new AIToolResponse(
                result.toolCall.name,
                workflowResult,
                result.toolCall.toolId
            ));

            await this.setAgentPromptAndTools(planningMode, allowDestructiveActions);
            result = await this.runMainAgentLoop(conversation, callbacks);
        }
    }

    // the main agent loop - may return an execution plan if the agent has requested a planned workflow
    private async runMainAgentLoop(conversation: Conversation, callbacks: IChatServiceCallbacks
    ): Promise<{ planRequest: ExecuteWorkflowArgs | undefined, toolCall: AIToolCall | undefined }> {
        
        let planRequest: ExecuteWorkflowArgs | undefined;
        let planToolCall: AIToolCall | undefined;

        await this.runAgentLoop(AgentType.Main, conversation, callbacks, async toolCall => {
            const toolCallName = toolCall.name;
            if (isAITool(toolCallName, AITool.ExecuteWorkflow)) {
                this.debugService?.log("MainAgent", "ExecuteWorkflow function detected - transitioning to orchestration");
                const parseResult = ExecuteWorkflowArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        { error: `Invalid arguments for ${AITool.ExecuteWorkflow}: ${parseResult.error.message}` },
                        toolCall.toolId
                    ));
                    return { shouldExit: false };
                }
                planRequest = parseResult.data;
                planToolCall = toolCall;
                this.updateThought(toolCall, callbacks);
                return { shouldExit: true };
            }

            this.debugService?.log("MainAgent", `Executing function: ${toolCall.name}`);
            this.updateThought(toolCall, callbacks);
            const functionResponse = await this.aiToolService.performAITool(toolCall);
            conversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        });
        return { planRequest: planRequest, toolCall: planToolCall };
    }

    private async setAgentPromptAndTools(planningMode: boolean, allowDestructiveActions: boolean): Promise<void> {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Main;
        this.ai.aiToolUsageMode = AIToolUsageMode.Auto;
        this.ai.systemPrompt = await this.aiPrompt.systemInstruction();
        this.ai.userInstruction = await this.aiPrompt.userInstruction();
        this.ai.aiToolDefinitions = AIToolDefinitions.agentDefinitions(
            allowDestructiveActions, planningMode, this.memoriesEnabled(), this.updateMemoriesEnabled());
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.BLUE);
    }
    
}
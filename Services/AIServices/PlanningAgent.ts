import { Conversation } from "Conversations/Conversation";
import { BaseAgent } from "./BaseAgent";
import { AskUserQuestionPlanningArgsSchema, SubmitPlanArgsSchema } from "AIClasses/Schemas/AIToolSchemas";
import { Exception } from "Helpers/Exception";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { AgentType } from "Enums/AgentType";
import { AITool, isAITool } from "Enums/AITool";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { ExecutionPlan } from "Types/ExecutionPlan";
import { AIToolDefinitions } from "AIClasses/ToolDefinitions/AIToolDefinitions";
import { Copy } from "Enums/Copy";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { DebugColor } from "Enums/DebugColor";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import { AIToolResponsePayload } from "AIClasses/ToolDefinitions/AIToolResponsePayload";

export class PlanningAgent extends BaseAgent {
 
    private static readonly MAX_AGENT_DEPTH = 3;

    private planningDepth: number = 0;

    public async runPlanningAgent(conversation: Conversation, callbacks: IChatServiceCallbacks): Promise<ExecutionPlan | undefined> {
        this.setAgentPromptAndTools();

        let capturedPlan: ExecutionPlan | null = null;

        if (this.planningDepth >= PlanningAgent.MAX_AGENT_DEPTH) {
            this.debugService?.log("PlanningAgent", `Max planning depth reached (${PlanningAgent.MAX_AGENT_DEPTH})`);
            return;
        }
        this.planningDepth++;
        this.debugService?.log("PlanningAgent", `Starting PlanningAgent (depth: ${this.planningDepth}/${PlanningAgent.MAX_AGENT_DEPTH})`);

        await this.runAgentLoop(AgentType.Planning, conversation, callbacks, async (toolCall) => {
            const toolCallName = toolCall.name;

            if (!AIToolDefinitions.planningAgentDefinitions(this.memoriesEnabled()).some(definition => isAITool(toolCallName, definition.name))) {
                this.debugService?.log("PlanningAgent", `Invalid tool call denied: ${toolCallName}`);
                conversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: Copy.PlanningToolDenial }),
                    toolCall.toolId
                ));
                return { shouldExit: false };
            }

            if (isAITool(toolCallName, AITool.AskUserQuestionPlanning)) {
                const parseResult = AskUserQuestionPlanningArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.AskUserQuestionPlanning}: ${parseResult.error.message}` }),
                        toolCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.debugService?.log("PlanningAgent", `Asking user question: ${parseResult.data.question}`);
                this.updateThought(toolCall, callbacks);
                const answer = await callbacks.onUserQuestion(parseResult.data.question);
                this.debugService?.log("PlanningAgent", "User answer received");
                conversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ answer: answer }),
                    toolCall.toolId
                ));
                return { shouldExit: false };
            }

            if (isAITool(toolCallName, AITool.SubmitPlan)) {
                const parseResult = SubmitPlanArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.SubmitPlan}: ${parseResult.error.message}` }),
                        toolCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.debugService?.log("PlanningAgent", `Plan submitted successfully with ${parseResult.data.steps.length} steps`);
                capturedPlan = new ExecutionPlan(parseResult.data);
                conversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: Copy.PlanReceived }),
                    toolCall.toolId
                ));
                return { shouldExit: true };
            }

            this.updateThought(toolCall, callbacks);
            const functionResponse = await this.performAITool(toolCall);
            conversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        });

        if (!capturedPlan) {
            this.debugService?.log("PlanningAgent", "Plan submission failed - retrying");
            Exception.warn(`Failed to generate execution plan.\n${JSON.stringify(conversation, null, 2)}`);
            conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: Copy.PlanSubmissionRequired,
                shouldDisplayContent: false
            }));
            return await this.runPlanningAgent(conversation, callbacks);
        }
        return capturedPlan;
    }

    private setAgentPromptAndTools() {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Planning;
        this.ai.aiToolUsageMode = AIToolUsageMode.Enabled;
        this.ai.systemPrompt = this.aiPrompt.planningInstruction();
        this.ai.userInstruction = ""; // do not include user instruction for planning agent
        this.ai.aiToolDefinitions = AIToolDefinitions.planningAgentDefinitions(this.memoriesEnabled());
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.YELLOW);
    }

}
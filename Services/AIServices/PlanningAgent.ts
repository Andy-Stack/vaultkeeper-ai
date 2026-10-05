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
import type { IAIToolDefinition } from "AIClasses/ToolDefinitions/IAIToolDefinition";
import type { AIToolCall } from "AIClasses/AIToolCall";

export class PlanningAgent extends BaseAgent {
 
    private static readonly MAX_AGENT_DEPTH = 3;

    private planningDepth: number = 0;

    public async runPlanningAgent(conversation: Conversation, callbacks: IChatServiceCallbacks): Promise<ExecutionPlan | undefined> {
        await this.setAgentPromptAndTools();

        let capturedPlan: ExecutionPlan | null = null;

        if (this.planningDepth >= PlanningAgent.MAX_AGENT_DEPTH) {
            this.debugService?.log("PlanningAgent", `Max planning depth reached (${PlanningAgent.MAX_AGENT_DEPTH})`);
            return;
        }
        this.planningDepth++;
        this.debugService?.log("PlanningAgent", `Starting PlanningAgent (depth: ${this.planningDepth}/${PlanningAgent.MAX_AGENT_DEPTH})`);

        await this.runAgentLoop(AgentType.Planning, conversation, callbacks, async (toolCalls) => {
            const responses = await this.resolveToolCalls(toolCalls, callbacks,
                toolCall => !this.isPlanningTool(toolCall)
                    || isAITool(toolCall.name, AITool.AskUserQuestionPlanning)
                    || isAITool(toolCall.name, AITool.SubmitPlan),
                async toolCall => {
                    const toolCallName = toolCall.name;

                    if (!this.isPlanningTool(toolCall)) {
                        this.debugService?.log("PlanningAgent", `Invalid tool call denied: ${toolCallName}`);
                        return new AIToolResponse(
                            toolCallName,
                            new AIToolResponsePayload({ message: Copy.PlanningToolDenial }),
                            toolCall.toolId
                        );
                    }

                    if (isAITool(toolCallName, AITool.AskUserQuestionPlanning)) {
                        const parseResult = AskUserQuestionPlanningArgsSchema.safeParse(toolCall.arguments);
                        if (!parseResult.success) {
                            return new AIToolResponse(
                                toolCallName,
                                new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.AskUserQuestionPlanning}: ${parseResult.error.message}` }),
                                toolCall.toolId
                            );
                        }
                        this.debugService?.log("PlanningAgent", `Asking user question: ${parseResult.data.question}`);
                        const answer = await callbacks.onUserQuestion(parseResult.data.question);
                        this.debugService?.log("PlanningAgent", "User answer received");
                        return new AIToolResponse(
                            toolCallName,
                            new AIToolResponsePayload({ answer: answer }),
                            toolCall.toolId
                        );
                    }

                    // SubmitPlan
                    const parseResult = SubmitPlanArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCallName,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.SubmitPlan}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    if (capturedPlan) {
                        return new AIToolResponse(
                            toolCallName,
                            new AIToolResponsePayload({ error: `${AITool.SubmitPlan} was already called this turn, this plan was ignored.` }),
                            toolCall.toolId
                        );
                    }
                    this.debugService?.log("PlanningAgent", `Plan submitted successfully with ${parseResult.data.steps.length} steps`);
                    capturedPlan = new ExecutionPlan(parseResult.data);
                    return new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ message: Copy.PlanReceived }),
                        toolCall.toolId
                    );
                });

            conversation.addFunctionResponses(responses);
            return { shouldExit: capturedPlan !== null };
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

    private async setAgentPromptAndTools() {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Planning;
        this.ai.aiToolUsageMode = AIToolUsageMode.Enabled;
        this.ai.systemPrompt = await this.aiPrompt.planningInstruction();
        this.ai.userInstruction = ""; // do not include user instruction for planning agent
        this.ai.aiToolDefinitions = this.planningTools();
    }

    private isPlanningTool(toolCall: AIToolCall): boolean {
        return this.planningTools().some(definition => isAITool(toolCall.name, definition.name));
    }

    private planningTools(): IAIToolDefinition[] {
        return AIToolDefinitions.planningAgentDefinitions(this.memoriesEnabled(), this.webViewerAccessEnabled());
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.YELLOW);
    }

}
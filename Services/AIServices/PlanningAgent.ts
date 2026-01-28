import { Conversation } from "Conversations/Conversation";
import { AIController } from "./AIController";
import { AskUserQuestionPlanningArgsSchema, SubmitPlanArgsSchema } from "AIClasses/Schemas/AIFunctionSchemas";
import { Exception } from "Helpers/Exception";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { AgentType } from "Enums/AgentType";
import { AIFunction, isAIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import { ExecutionPlan } from "Types/ExecutionPlan";
import { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { Copy } from "Enums/Copy";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { DebugColor } from "Enums/DebugColor";

export class PlanningAgent extends AIController {
 
    private static readonly MAX_AGENT_DEPTH = 3;

    private planningDepth: number = 0;

    public async runPlanningAgent(conversation: Conversation, callbacks: IChatServiceCallbacks, isReplan: boolean): Promise<ExecutionPlan | undefined> {
        await this.setAgentPromptAndTools();

        let capturedPlan: ExecutionPlan | null = null;

        if (this.planningDepth >= PlanningAgent.MAX_AGENT_DEPTH) {
            this.debugService?.log("PlanningAgent", `Max planning depth reached (${PlanningAgent.MAX_AGENT_DEPTH})`);
            return;
        }
        this.planningDepth++;
        this.debugService?.log("PlanningAgent", `Starting PlanningAgent (isReplan: ${isReplan}, depth: ${this.planningDepth}/${PlanningAgent.MAX_AGENT_DEPTH})`);

        await this.runAgentLoop(AgentType.Planning, conversation, callbacks, async (functionCall) => {
            const functionCallName = functionCall.name;

            if (!AIFunctionDefinitions.planningAgentDefinitions().some(definition => isAIFunction(functionCallName, definition.name))) {
                this.debugService?.log("PlanningAgent", `Invalid tool call denied: ${functionCallName}`);
                conversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: Copy.PlanningToolDenial },
                    functionCall.toolId
                ));
                return { shouldExit: false };
            }

            if (isAIFunction(functionCallName, AIFunction.AskUserQuestionPlanning)) {
                const parseResult = AskUserQuestionPlanningArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.AskUserQuestionPlanning}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.debugService?.log("PlanningAgent", `Asking user question: ${parseResult.data.question}`);
                this.updateThought(functionCall, callbacks);
                const answer = await callbacks.onUserQuestion(parseResult.data.question);
                this.debugService?.log("PlanningAgent", "User answer received");
                conversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { answer: answer },
                    functionCall.toolId
                ));
                return { shouldExit: false };
            }

            if (isAIFunction(functionCallName, AIFunction.SubmitPlan)) {
                const parseResult = SubmitPlanArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.SubmitPlan}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.debugService?.log("PlanningAgent", `Plan submitted successfully with ${parseResult.data.steps.length} steps`);
                capturedPlan = new ExecutionPlan(parseResult.data, isReplan);
                conversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: Copy.PlanReceived },
                    functionCall.toolId
                ));
                return { shouldExit: true };
            }

            this.updateThought(functionCall, callbacks);
            const functionResponse = await this.aiFunctionService.performAIFunction(functionCall);
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
            return await this.runPlanningAgent(conversation, callbacks, isReplan);
        }
        return capturedPlan;
    }

    private async setAgentPromptAndTools() {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Planning;
        this.ai.systemPrompt = this.aiPrompt.planningInstruction();
        this.ai.userInstruction = await this.aiPrompt.userInstruction();
        this.ai.toolDefinitions = AIFunctionDefinitions.planningAgentDefinitions();
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.YELLOW);
    }

}
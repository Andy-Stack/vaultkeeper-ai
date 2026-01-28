import type { Conversation } from "Conversations/Conversation";
import type { IChatServiceCallbacks } from "../ChatService";
import { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { Exception } from "Helpers/Exception";
import { AIFunction, isAIFunction } from "Enums/AIFunction";
import { AgentType } from "Enums/AgentType";
import { AIController } from "./AIController";
import { ExecuteWorkflowArgsSchema, type ExecuteWorkflowArgs } from "AIClasses/Schemas/AIFunctionSchemas";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { OrchestrationAgent } from "./OrchestrationAgent";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { DebugColor } from "Enums/DebugColor";

export class MainAgent extends AIController {

    public async runMainAgent(conversation: Conversation, allowDestructiveActions: boolean, planningMode: boolean, callbacks: IChatServiceCallbacks) {
        await this.setAgentPromptAndTools(planningMode, allowDestructiveActions);

        if (planningMode) {
            conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: "Planning mode is enabled, you should request planned execution when appropriate or if you do not have the required tools to complete the request",
                shouldDisplayContent: false
            }));
        }

        let result = await this.runMainAgentLoop(conversation, callbacks);

        while (result.planRequest && result.functionCall) {
            const orchestrationAgent = new OrchestrationAgent();
            orchestrationAgent.resolveAIProvider();
            const workflowResult = await orchestrationAgent.runPlannedWorkflow(result.planRequest, callbacks);
            
            conversation.addFunctionResponse(new AIFunctionResponse(
                result.functionCall.name,
                workflowResult,
                result.functionCall.toolId
            ));

            await this.setAgentPromptAndTools(planningMode, allowDestructiveActions);
            result = await this.runMainAgentLoop(conversation, callbacks);
        }
    }

    // the main agent loop - may return an execution plan if the agent has requested a planned workflow
    private async runMainAgentLoop(conversation: Conversation, callbacks: IChatServiceCallbacks
    ): Promise<{ planRequest: ExecuteWorkflowArgs | undefined, functionCall: AIFunctionCall | undefined }> {
        
        let planRequest: ExecuteWorkflowArgs | undefined;
        let planFunctionCall: AIFunctionCall | undefined;

        await this.runAgentLoop(AgentType.Main, conversation, callbacks, async functionCall => {
            const functionCallName = functionCall.name;
            if (isAIFunction(functionCallName, AIFunction.ExecuteWorkflow)) {
                const parseResult = ExecuteWorkflowArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.ExecuteWorkflow}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                planRequest = parseResult.data;
                planFunctionCall = functionCall;
                this.updateThought(functionCall, callbacks);
                return { shouldExit: true };
            }

            this.updateThought(functionCall, callbacks);
            const functionResponse = await this.aiFunctionService.performAIFunction(functionCall);
            conversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        });
        return { planRequest: planRequest, functionCall: planFunctionCall };
    }

    private async setAgentPromptAndTools(planningMode: boolean, allowDestructiveActions: boolean): Promise<void> {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Main;
        this.ai.systemPrompt = this.aiPrompt.systemInstruction();
        this.ai.userInstruction = await this.aiPrompt.userInstruction();
        this.ai.toolDefinitions = AIFunctionDefinitions.agentDefinitions(allowDestructiveActions, planningMode);
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.BLUE);
    }
    
}
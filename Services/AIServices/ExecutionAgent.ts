import type { ExecutionStep } from "Types/ExecutionStep";
import { AIController } from "./AIController";
import { AgentType } from "Enums/AgentType";
import { Conversation } from "Conversations/Conversation";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { AIFunction, isAIFunction } from "Enums/AIFunction";
import { CompleteTaskArgsSchema, type CompleteTaskArgs } from "AIClasses/Schemas/AIFunctionSchemas";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import { Exception } from "Helpers/Exception";
import { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { Copy, replaceCopy } from "Enums/Copy";

export class ExecutionAgent extends AIController {

    private static readonly MAX_AGENT_DEPTH: number = 3;

    private readonly conversation: Conversation = new Conversation();

    private executionDepth: number = 0;

    public async runExecutionAgent(step: ExecutionStep, callbacks: IChatServiceCallbacks): Promise<CompleteTaskArgs | undefined> {
        this.setAgentPromptAndTools();

        if (this.executionDepth === 0) {
            this.conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: replaceCopy(Copy.ExecuteStep, [step.instruction, step.context ?? ""])
            }));
        }

        if (this.executionDepth >= ExecutionAgent.MAX_AGENT_DEPTH) {
            return;
        }
        this.executionDepth++;

        let executionResult: CompleteTaskArgs | undefined = undefined;

        await this.runAgentLoop(AgentType.Execution, this.conversation, callbacks, async functionCall => {
            const functionCallName = functionCall.name;

            if (isAIFunction(functionCallName, AIFunction.CompleteTask)) {
                const parseResult = CompleteTaskArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    this.conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.CompleteTask}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                executionResult = parseResult.data;
                return { shouldExit: true };
            }

            this.updateThought(functionCall, callbacks);
            const functionResponse = await this.aiFunctionService.performAIFunction(functionCall);
            this.conversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        });

        if (!executionResult) {
            this.conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: Copy.ExecuteSignal
            }));
            return await this.runExecutionAgent(step, callbacks);
        }
        return executionResult;
    }

    private setAgentPromptAndTools() {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Execution;
        this.ai.systemPrompt = this.aiPrompt.executionInstruction();
        this.ai.userInstruction = ""; // do not include user instruction for execution agent
        this.ai.toolDefinitions = AIFunctionDefinitions.executionAgentDefinitions();
    }

}
import type { ExecutionStep } from "Types/ExecutionStep";
import { BaseAgent } from "./BaseAgent";
import { AgentType } from "Enums/AgentType";
import { Conversation } from "Conversations/Conversation";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { AITool, isAITool } from "Enums/AITool";
import { CompleteTaskArgsSchema, type CompleteTaskArgs } from "AIClasses/Schemas/AIToolSchemas";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { Exception } from "Helpers/Exception";
import { AIToolDefinitions } from "AIClasses/ToolDefinitions/AIToolDefinitions";
import { Copy, replaceCopy } from "Enums/Copy";
import { DebugColor } from "Enums/DebugColor";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";

export class ExecutionAgent extends BaseAgent {

    private static readonly MAX_AGENT_DEPTH: number = 3;

    private readonly conversation: Conversation = new Conversation();

    private executionDepth: number = 0;

    public async runExecutionAgent(step: ExecutionStep, callbacks: IChatServiceCallbacks): Promise<CompleteTaskArgs | undefined> {
        this.setAgentPromptAndTools();
        this.debugService?.log("ExecutionAgent", `Starting ExecutionAgent (depth: ${this.executionDepth + 1}/${ExecutionAgent.MAX_AGENT_DEPTH})`);

        if (this.executionDepth === 0) {
            this.debugService?.log("ExecutionAgent", `Executing step: ${step.instruction}`);
            if (step.context) {
                this.debugService?.log("ExecutionAgent", `Step context: ${step.context.substring(0, 100)}...`);
            }
            this.conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: replaceCopy(Copy.ExecuteStep, [step.instruction, step.context ?? ""])
            }));
        }

        if (this.executionDepth >= ExecutionAgent.MAX_AGENT_DEPTH) {
            this.debugService?.log("ExecutionAgent", `Max execution depth reached (${ExecutionAgent.MAX_AGENT_DEPTH})`);
            return;
        }
        this.executionDepth++;

        let executionResult: CompleteTaskArgs | undefined = undefined;

        await this.runAgentLoop(AgentType.Execution, this.conversation, callbacks, async functionCall => {
            const functionCallName = functionCall.name;

            if (isAITool(functionCallName, AITool.CompleteTask)) {
                const parseResult = CompleteTaskArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    this.conversation.addFunctionResponse(new AIToolResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AITool.CompleteTask}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.debugService?.log("ExecutionAgent", `Task completed (success: ${parseResult.data.success}): ${parseResult.data.description}`);
                this.updateThought(functionCall, callbacks);
                executionResult = parseResult.data;
                return { shouldExit: true };
            }

            this.debugService?.log("ExecutionAgent", `Executing function: ${functionCall.name}`);
            this.updateThought(functionCall, callbacks);
            const functionResponse = await this.aiToolService.performAITool(functionCall);
            this.conversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        });

        if (!executionResult) {
            this.debugService?.log("ExecutionAgent", "Task not completed - retrying");
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
        this.ai.aiToolUsageMode = AIToolUsageMode.Enabled;
        this.ai.systemPrompt = this.aiPrompt.executionInstruction();
        this.ai.userInstruction = ""; // do not include user instruction for execution agent
        this.ai.aiToolDefinitions = AIToolDefinitions.executionAgentDefinitions();
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.GREEN);
    }

}
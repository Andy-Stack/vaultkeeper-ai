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
import { replaceCopy } from 'Helpers/Helpers';
import { Copy } from "Enums/Copy";
import { DebugColor } from "Enums/DebugColor";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import { AIToolResponsePayload } from "AIClasses/ToolDefinitions/AIToolResponsePayload";

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

        await this.runAgentLoop(AgentType.Execution, this.conversation, callbacks, async toolCalls => {
            const responses = await this.resolveToolCalls(toolCalls, callbacks,
                toolCall => isAITool(toolCall.name, AITool.CompleteTask),
                toolCall => {
                    const parseResult = CompleteTaskArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return Promise.resolve(new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.CompleteTask}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        ));
                    }
                    if (executionResult) {
                        return Promise.resolve(new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `${AITool.CompleteTask} was already called this turn, this call was ignored.` }),
                            toolCall.toolId
                        ));
                    }
                    this.debugService?.log("ExecutionAgent", `Task completed (success: ${parseResult.data.success}): ${parseResult.data.description}`);
                    executionResult = parseResult.data;
                    return Promise.resolve(new AIToolResponse(
                        toolCall.name,
                        new AIToolResponsePayload({ result: parseResult.data.success ? "Task completed successfully." : "Task failed, attempting recovery..." }),
                        toolCall.toolId
                    ));
                });

            this.conversation.addFunctionResponses(responses);
            return { shouldExit: executionResult !== undefined };
        });

        if (!executionResult) {
            this.debugService?.log("ExecutionAgent", "Task not completed - retrying");
            this.conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: Copy.ExecuteSignal
            }));
            return await this.runExecutionAgent(step, callbacks);
        }

        this.executionDepth = 0;
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
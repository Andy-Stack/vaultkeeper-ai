import { RevisePlanArgsSchema, CancelPlanArgsSchema, CompletePlanArgsSchema, CompleteStepArgsSchema, ReviseStepArgsSchema, SkipStepArgsSchema, type ExecuteWorkflowArgs } from "AIClasses/Schemas/AIToolSchemas";
import { BaseAgent } from "./BaseAgent";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { ExecutionAgent } from "./ExecutionAgent";
import { replaceCopy } from 'Helpers/Helpers';
import { Copy } from "Enums/Copy";
import { Conversation } from "Conversations/Conversation";
import { PlanningAgent } from "./PlanningAgent";
import { Exception } from "Helpers/Exception";
import { AIToolDefinitions } from "AIClasses/ToolDefinitions/AIToolDefinitions";
import { OrchestrationResult } from "Types/OrchestrationResult";
import { AgentType } from "Enums/AgentType";
import { AITool, isAITool } from "Enums/AITool";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { DebugColor } from "Enums/DebugColor";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import { AIToolResponsePayload } from "AIClasses/ToolDefinitions/AIToolResponsePayload";
import type { IAIToolDefinition } from "AIClasses/ToolDefinitions/IAIToolDefinition";
import type { ExecutionPlan } from "Types/ExecutionPlan";
import type { AIToolCall } from "AIClasses/AIToolCall";
import type { Attachment } from "Conversations/Attachment";

export class OrchestrationAgent extends BaseAgent {

    private static readonly MAX_AGENT_DEPTH: number = 3;

    private orchestrationDepth: number = 0;

    public async runPlannedWorkflow(planRequest: ExecuteWorkflowArgs, attachments: Attachment[], callbacks: IChatServiceCallbacks): Promise<AIToolResponsePayload> {
        this.debugService?.log("OrchestrationAgent", `Starting planned workflow: ${planRequest.goal}`);
        const planningConversation: Conversation = new Conversation();
        planningConversation.contents.push(new ConversationContent({
            role: Role.User,
            content: this.preparePlanRequest(planRequest)
        }));

        if (attachments.length > 0) {
            planningConversation.contents.push(new ConversationContent({
                role: Role.User,
                attachments: attachments,
                shouldDisplayContent: false
            }));
        }

        const planningAgent = new PlanningAgent();
        planningAgent.resolveAIProvider();

        callbacks.onPlanReset();
        callbacks.onPlanningStarted();
        this.debugService?.log("OrchestrationAgent", "Spawning PlanningAgent to generate execution plan");

        let approved = false;

        let executionPlan: ExecutionPlan | undefined;

        while (!approved) {
            executionPlan = await planningAgent.runPlanningAgent(planningConversation, callbacks);

            if (!executionPlan) {
                callbacks.onPlanningFinished();
                this.debugService?.log("OrchestrationAgent", "Planning failed - no execution plan generated");
                return new AIToolResponsePayload({ message: Copy.PlanningFailedNoSteps });
            }

            this.debugService?.log("OrchestrationAgent", "Plan awaiting user approval");
            let response = await callbacks.onPlanApprovalRequest(executionPlan);

            if (response.approved) {
                this.debugService?.log("OrchestrationAgent", "Execution plan approved");
                break;
            }

            if (response.suggestion.trim() === "") {
                callbacks.onPlanningFinished();
                this.debugService?.log("OrchestrationAgent", "Execution plan rejected");
                return new AIToolResponsePayload({ message: Copy.PlanRejected });
            }

            this.debugService?.log("OrchestrationAgent", "Execution plan rejected with user suggestion, commencing replanning");
            planningConversation.contents.push(new ConversationContent({
                role: Role.User,
                content: replaceCopy(Copy.PlanRejectedWithSuggestion, [response.suggestion]),
                shouldDisplayContent: false
            }));
        }

        if (!executionPlan) {
            callbacks.onPlanningFinished();
            this.debugService?.log("OrchestrationAgent", "Planning failed - no execution plan generated");
            return new AIToolResponsePayload({ message: Copy.PlanningFailedNoSteps });
        }
        callbacks.onPlanningFinished();

        this.debugService?.log("OrchestrationAgent", `Execution plan received with ${executionPlan.executionSteps.length} steps`);
        callbacks.onPlanUpdate(executionPlan);

        let stepIndex = 0;
        let planCompleted = false;

        const executionAgent = new ExecutionAgent();
        executionAgent.resolveAIProvider();

        while (stepIndex < executionPlan.executionSteps.length && !planCompleted) {
            const step = executionPlan.executionSteps[stepIndex];
            callbacks.onPlanStepUpdate(stepIndex);
            this.debugService?.log("OrchestrationAgent", `Executing step ${stepIndex + 1}/${executionPlan.executionSteps.length}: ${step.description}`);
            
            const executionResult = await executionAgent.runExecutionAgent(step, callbacks);

            if (!executionResult) {
                this.debugService?.log("OrchestrationAgent", `Step ${stepIndex + 1} failed to execute - workflow aborted`);
                return new AIToolResponsePayload({ message: replaceCopy(Copy.WorkflowFailedAtStep, [step.description]) });
            }

            if (executionResult.success) {
                this.debugService?.log("OrchestrationAgent", `Step ${stepIndex + 1} succeeded: ${executionResult.description}`);
                planningConversation.contents.push(new ConversationContent({
                    role: Role.User,
                    content: `Step ${stepIndex + 1} executed with the following result: ${executionResult.description}`
                }));
            } else {
                this.debugService?.log("OrchestrationAgent", `Step ${stepIndex + 1} failed: ${executionResult.description}`);
                planningConversation.contents.push(new ConversationContent({
                    role: Role.User,
                    content: `Step ${stepIndex + 1} failed to execute to completion. Result: ${executionResult.description}`
                }));
            }

            this.orchestrationDepth = 0;
            const orchestrationResult = await this.runOrchestrationAgentLoop(planningConversation, callbacks);

            if (orchestrationResult.continue) {
                this.debugService?.log("OrchestrationAgent", `Orchestration decision: CONTINUE${orchestrationResult.continueContext ? ' (with context)' : ''}`);
                if (orchestrationResult.continueContext && stepIndex + 1 < executionPlan.executionSteps.length) {
                    const nextStep = executionPlan.executionSteps[stepIndex + 1];
                    nextStep.context = nextStep.context
                        ? nextStep.context.concat("\n\n", orchestrationResult.continueContext)
                        : orchestrationResult.continueContext;
                }
                stepIndex++;
                callbacks.onPlanStepUpdate(stepIndex);
                continue;
            }

            if (orchestrationResult.reviseStep) {
                if (orchestrationResult.revisedDescription !== undefined) {
                    step.description = orchestrationResult.revisedDescription;
                }
                if (orchestrationResult.revisedInstruction !== undefined) {
                    step.instruction = orchestrationResult.revisedInstruction;
                }
                if (orchestrationResult.revisedContext !== undefined) {
                    step.context = orchestrationResult.revisedContext;
                }
                this.debugService?.log("OrchestrationAgent", `Orchestration decision: REVISE_STEP ${stepIndex + 1} - retrying: ${step.description}`);
                callbacks.onPlanStepUpdate(stepIndex);
                continue;
            }

            if (orchestrationResult.revisePlan) {
                this.debugService?.log("OrchestrationAgent", `Orchestration decision: REVISE_PLAN — replacing current + remaining ${executionPlan.executionSteps.length - stepIndex} step(s) with ${orchestrationResult.revisedSteps.length} new step(s)`);
                executionPlan.executionSteps.splice(stepIndex, executionPlan.executionSteps.length - stepIndex, ...orchestrationResult.revisedSteps);
                callbacks.onPlanUpdate(executionPlan);
                continue;
            }

            if (orchestrationResult.skipStep) {
                this.debugService?.log("OrchestrationAgent", `Orchestration decision: SKIP_STEP — ${orchestrationResult.skipReason}`);
                planningConversation.contents.push(new ConversationContent({
                    role: Role.User,
                    content: `Step ${stepIndex + 1} was skipped. Reason: ${orchestrationResult.skipReason}`
                }));
                stepIndex++;
                callbacks.onPlanStepUpdate(stepIndex);
                continue;
            }

            if (orchestrationResult.abort) {
                this.debugService?.log("OrchestrationAgent", `Orchestration decision: ABORT — ${orchestrationResult.abortContext}`);
                return new AIToolResponsePayload({ message: replaceCopy(Copy.WorkflowAborted, [orchestrationResult.abortContext]) });
            }

            if (orchestrationResult.complete) {
                this.debugService?.log("OrchestrationAgent", "Orchestration decision: COMPLETE_PLAN");
                callbacks.onPlanStepUpdate(executionPlan.executionSteps.length);
                planCompleted = true;
            }
        }

        this.debugService?.log("OrchestrationAgent", "Planned workflow completed - requesting summary");
        planningConversation.contents.push(new ConversationContent({
            role: Role.User,
            content: Copy.RequestPlanSummary
        }));
        const orchestrationSummary = await this.requestAgentResponse(AgentType.Orchestration, planningConversation, callbacks);

        return new AIToolResponsePayload({ planExecutionSummary: orchestrationSummary });
    }

    private async runOrchestrationAgentLoop(planningConversation: Conversation, callbacks: IChatServiceCallbacks): Promise<OrchestrationResult> {
        await this.setAgentPromptAndTools();

        if (this.orchestrationDepth >= OrchestrationAgent.MAX_AGENT_DEPTH) {
            this.debugService?.log("Orchestration", "Max orchestration depth reached - aborting");
            return new OrchestrationResult({ abort: true, abortContext: "Max orchestration depth reached" });
        }
        this.orchestrationDepth++;
        this.debugService?.log("Orchestration", `Starting orchestration loop (depth: ${this.orchestrationDepth}/${OrchestrationAgent.MAX_AGENT_DEPTH})`);

        let orchestrationResult: OrchestrationResult | undefined = undefined;

        await this.runAgentLoop(AgentType.Orchestration, planningConversation, callbacks, async toolCalls => {
            const responses = await this.resolveToolCalls(toolCalls, callbacks,
                // Decisions and denials are resolved here, other orchestration tools (e.g. recovery searches) are executed with the batch
                toolCall => !this.isOrchestrationTool(toolCall) || this.isDecisionTool(toolCall),
                toolCall => {
                    if (!this.isOrchestrationTool(toolCall)) {
                        this.debugService?.log("Orchestration", `Invalid tool call denied: ${toolCall.name}`);
                        return Promise.resolve(this.toolResponse(toolCall, { message: Copy.OrchestrationToolDenial }));
                    }

                    const decision = this.resolveDecision(toolCall);
                    if (decision.result && orchestrationResult) {
                        return Promise.resolve(this.toolResponse(toolCall, { error: "Only one orchestration decision can be made per turn, this call was ignored." }));
                    }
                    if (decision.result) {
                        this.debugService?.log("Orchestration", `${toolCall.name} called`);
                        orchestrationResult = decision.result;
                    }
                    return Promise.resolve(decision.response);
                });

            planningConversation.addFunctionResponses(responses);
            return { shouldExit: orchestrationResult !== undefined };
        });

        if (!orchestrationResult) {
            this.debugService?.log("Orchestration", "Orchestration signal required - retrying");
            planningConversation.contents.push(new ConversationContent({
                role: Role.User,
                content: Copy.OrchestrationSignalRequired
            }));
            return await this.runOrchestrationAgentLoop(planningConversation, callbacks);
        }
        return orchestrationResult;
    }

    private isOrchestrationTool(toolCall: AIToolCall): boolean {
        return this.orchestrationTools().some(definition => isAITool(toolCall.name, definition.name));
    }

    private isDecisionTool(toolCall: AIToolCall): boolean {
        return isAITool(toolCall.name, AITool.CompleteStep) ||
            isAITool(toolCall.name, AITool.ReviseStep) ||
            isAITool(toolCall.name, AITool.RevisePlan) ||
            isAITool(toolCall.name, AITool.SkipStep) ||
            isAITool(toolCall.name, AITool.CompletePlan) ||
            isAITool(toolCall.name, AITool.CancelPlan);
    }

    // Resolves an orchestration decision tool, the result is only present when the decision was accepted
    private resolveDecision(toolCall: AIToolCall): { response: AIToolResponse, result?: OrchestrationResult } {
        const toolCallName: string = toolCall.name;
        const invalidArguments = (message: string) => ({
            response: this.toolResponse(toolCall, { error: `Invalid arguments for ${toolCall.name}: ${message}` })
        });
        const unconfirmed = () => ({
            response: this.toolResponse(toolCall, { error: "Confirmation was false, no action taken" })
        });

        if (isAITool(toolCall.name, AITool.CompleteStep)) {
            const parseResult = CompleteStepArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return invalidArguments(parseResult.error.message);
            }
            if (!parseResult.data.confirm_completion) {
                return unconfirmed();
            }
            return {
                response: this.toolResponse(toolCall, { message: "Step completed" }),
                result: new OrchestrationResult({ continue: true, continueContext: parseResult.data.context_for_next_step })
            };
        }

        if (isAITool(toolCall.name, AITool.ReviseStep)) {
            const parseResult = ReviseStepArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return invalidArguments(parseResult.error.message);
            }
            return {
                response: this.toolResponse(toolCall, { message: "Step revision accepted — retrying" }),
                result: new OrchestrationResult({
                    reviseStep: true,
                    revisedDescription: parseResult.data.revised_description,
                    revisedInstruction: parseResult.data.revised_instruction,
                    revisedContext: parseResult.data.revised_context
                })
            };
        }

        if (isAITool(toolCall.name, AITool.RevisePlan)) {
            const parseResult = RevisePlanArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return invalidArguments(parseResult.error.message);
            }
            this.debugService?.log("Orchestration", `RevisePlan — ${parseResult.data.steps.length} new step(s)`);
            return {
                response: this.toolResponse(toolCall, { message: `Plan revised with ${parseResult.data.steps.length} remaining step(s)` }),
                result: new OrchestrationResult({ revisePlan: true, revisedSteps: parseResult.data.steps })
            };
        }

        if (isAITool(toolCall.name, AITool.SkipStep)) {
            const parseResult = SkipStepArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return invalidArguments(parseResult.error.message);
            }
            this.debugService?.log("Orchestration", `SkipStep — ${parseResult.data.reason}`);
            return {
                response: this.toolResponse(toolCall, { message: "Step skipped" }),
                result: new OrchestrationResult({ skipStep: true, skipReason: parseResult.data.reason })
            };
        }

        if (isAITool(toolCall.name, AITool.CompletePlan)) {
            const parseResult = CompletePlanArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return invalidArguments(parseResult.error.message);
            }
            if (!parseResult.data.confirm_completion) {
                return unconfirmed();
            }
            return {
                response: this.toolResponse(toolCall, { message: "Plan completed" }),
                result: new OrchestrationResult({ complete: true })
            };
        }

        if (isAITool(toolCall.name, AITool.CancelPlan)) {
            const parseResult = CancelPlanArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return invalidArguments(parseResult.error.message);
            }
            this.debugService?.log("Orchestration", `CancelPlan — ${parseResult.data.context}`);
            return {
                response: this.toolResponse(toolCall, { message: "Plan cancelled" }),
                result: new OrchestrationResult({ abort: true, abortContext: parseResult.data.context })
            };
        }

        Exception.log(`Function ${toolCallName} is not an orchestration decision`);
        return { response: this.toolResponse(toolCall, { error: `Failed to execute ${toolCallName}.` }) };
    }

    private toolResponse(toolCall: AIToolCall, response: object): AIToolResponse {
        return new AIToolResponse(toolCall.name, new AIToolResponsePayload(response), toolCall.toolId);
    }

    private preparePlanRequest(input: ExecuteWorkflowArgs): string {
        const context = input.context ? replaceCopy(Copy.ContextTags, [input.context]) : "";
        return input.goal + context;
    }

    private async setAgentPromptAndTools(): Promise<void> {
        if (!this.ai) {
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Orchestration;
        this.ai.aiToolUsageMode = AIToolUsageMode.Enabled;
        this.ai.systemPrompt = await this.aiPrompt.orchestrationInstruction();
        this.ai.userInstruction = ""; // do not include user instruction for orchestration agent
        this.ai.aiToolDefinitions = this.orchestrationTools();
    }

    private orchestrationTools(): IAIToolDefinition[] {
        return AIToolDefinitions.orchestrationAgentDefinitions(this.memoriesEnabled(), this.webViewerAccessEnabled());
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.ORANGE);
    }

}
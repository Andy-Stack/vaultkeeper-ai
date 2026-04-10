import { RevisePlanArgsSchema, CancelPlanArgsSchema, CompletePlanArgsSchema, CompleteStepArgsSchema, ReviseStepArgsSchema, SkipStepArgsSchema, type ExecuteWorkflowArgs } from "AIClasses/Schemas/AIToolSchemas";
import { BaseAgent } from "./BaseAgent";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { ExecutionAgent } from "./ExecutionAgent";
import { Copy, replaceCopy } from "Enums/Copy";
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

export class OrchestrationAgent extends BaseAgent {

    private static readonly MAX_AGENT_DEPTH: number = 3;

    private orchestrationDepth: number = 0;

    public async runPlannedWorkflow(planRequest: ExecuteWorkflowArgs, callbacks: IChatServiceCallbacks): Promise<AIToolResponsePayload> {
        this.debugService?.log("OrchestrationAgent", `Starting planned workflow: ${planRequest.goal}`);
        const planningConversation: Conversation = new Conversation();
        planningConversation.contents.push(new ConversationContent({
            role: Role.User,
            content: this.preparePlanRequest(planRequest)
        }));

        const planningAgent = new PlanningAgent();
        planningAgent.resolveAIProvider();

        callbacks.onPlanReset();
        callbacks.onPlanningStarted();
        this.debugService?.log("OrchestrationAgent", "Spawning PlanningAgent to generate execution plan");
        const executionPlan = await planningAgent.runPlanningAgent(planningConversation, callbacks);
        callbacks.onPlanningFinished();

        if (!executionPlan) {
            this.debugService?.log("OrchestrationAgent", "Planning failed - no execution plan generated");
            return new AIToolResponsePayload({ message: Copy.PlanningFailedNoSteps });
        }
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

        await this.runAgentLoop(AgentType.Orchestration, planningConversation, callbacks, async toolCall => {
            const toolCallName = toolCall.name;

            if (!this.orchestrationTools().some(definition => isAITool(toolCallName, definition.name))) {
                this.debugService?.log("Orchestration", `Invalid tool call denied: ${toolCallName}`);
                planningConversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: Copy.OrchestrationToolDenial }),
                    toolCall.toolId
                ));
                return Promise.resolve({ shouldExit: false });
            }

            // Vault tools — execute and continue (for recovery searches)
            if (isAITool(toolCallName, AITool.SearchVaultFiles) ||
                isAITool(toolCallName, AITool.ReadVaultFiles) ||
                isAITool(toolCallName, AITool.ListVaultFiles)) {
                this.debugService?.log("Orchestration", `Vault tool called for recovery: ${toolCallName}`);
                this.updateThought(toolCall, callbacks);
                const toolResponse = await this.performAITool(toolCall);
                planningConversation.addFunctionResponse(toolResponse);
                return Promise.resolve({ shouldExit: false });
            }

            if (isAITool(toolCallName, AITool.CompleteStep)) {
                const parseResult = CompleteStepArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.CompleteStep}: ${parseResult.error.message}` }),
                        toolCall.toolId
                    ));
                    return Promise.resolve({ shouldExit: false });
                }
                if (!parseResult.data.confirm_completion) {
                    planningConversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: "Confirmation was false, no action taken" }),
                        toolCall.toolId
                    ));
                    return Promise.resolve({ shouldExit: false });
                }
                this.debugService?.log("Orchestration", "CompleteStep called");
                this.updateThought(toolCall, callbacks);
                planningConversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: "Step completed" }),
                    toolCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({ continue: true, continueContext: parseResult.data.context_for_next_step });
                return Promise.resolve({ shouldExit: true });
            }

            if (isAITool(toolCallName, AITool.ReviseStep)) {
                const parseResult = ReviseStepArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.ReviseStep}: ${parseResult.error.message}` }),
                        toolCall.toolId
                    ));
                    return Promise.resolve({ shouldExit: false });
                }
                this.debugService?.log("Orchestration", "ReviseStep called");
                this.updateThought(toolCall, callbacks);
                planningConversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: "Step revision accepted — retrying" }),
                    toolCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({
                    reviseStep: true,
                    revisedDescription: parseResult.data.revised_description,
                    revisedInstruction: parseResult.data.revised_instruction,
                    revisedContext: parseResult.data.revised_context
                });
                return Promise.resolve({ shouldExit: true });
            }

            if (isAITool(toolCallName, AITool.RevisePlan)) {
                const parseResult = RevisePlanArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.RevisePlan}: ${parseResult.error.message}` }),
                        toolCall.toolId
                    ));
                    return Promise.resolve({ shouldExit: false });
                }
                this.debugService?.log("Orchestration", `RevisePlan called — ${parseResult.data.steps.length} new step(s)`);
                this.updateThought(toolCall, callbacks);
                planningConversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: `Plan revised with ${parseResult.data.steps.length} remaining step(s)` }),
                    toolCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({
                    revisePlan: true,
                    revisedSteps: parseResult.data.steps
                });
                return Promise.resolve({ shouldExit: true });
            }

            if (isAITool(toolCallName, AITool.SkipStep)) {
                const parseResult = SkipStepArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.SkipStep}: ${parseResult.error.message}` }),
                        toolCall.toolId
                    ));
                    return Promise.resolve({ shouldExit: false });
                }
                this.debugService?.log("Orchestration", `SkipStep called — ${parseResult.data.reason}`);
                this.updateThought(toolCall, callbacks);
                planningConversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: "Step skipped" }),
                    toolCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({
                    skipStep: true,
                    skipReason: parseResult.data.reason
                });
                return Promise.resolve({ shouldExit: true });
            }

            if (isAITool(toolCallName, AITool.CompletePlan)) {
                const parseResult = CompletePlanArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.CompletePlan}: ${parseResult.error.message}` }),
                        toolCall.toolId
                    ));
                    return Promise.resolve({ shouldExit: false });
                }
                if (!parseResult.data.confirm_completion) {
                    planningConversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: "Confirmation was false, no action taken" }),
                        toolCall.toolId
                    ));
                    return Promise.resolve({ shouldExit: false });
                }
                this.debugService?.log("Orchestration", "CompletePlan called");
                this.updateThought(toolCall, callbacks);
                planningConversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: "Plan completed" }),
                    toolCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({ complete: true });
                return Promise.resolve({ shouldExit: true });
            }

            if (isAITool(toolCallName, AITool.CancelPlan)) {
                const parseResult = CancelPlanArgsSchema.safeParse(toolCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.CancelPlan}: ${parseResult.error.message}` }),
                        toolCall.toolId
                    ));
                    return Promise.resolve({ shouldExit: false });
                }
                this.debugService?.log("Orchestration", `CancelPlan called — ${parseResult.data.context}`);
                this.updateThought(toolCall, callbacks);
                planningConversation.addFunctionResponse(new AIToolResponse(
                    toolCallName,
                    new AIToolResponsePayload({ message: "Plan cancelled" }),
                    toolCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({ abort: true, abortContext: parseResult.data.context });
                return Promise.resolve({ shouldExit: true });
            }

            return Promise.resolve({ shouldExit: false });
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
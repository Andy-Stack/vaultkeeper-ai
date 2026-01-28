import { CancelPlanArgsSchema, CompleteStepArgsSchema, ReplanArgsSchema, type ExecuteWorkflowArgs } from "AIClasses/Schemas/AIFunctionSchemas";
import { AIController } from "./AIController";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { IChatServiceCallbacks } from "Services/ChatService";
import { ExecutionAgent } from "./ExecutionAgent";
import { Copy, replaceCopy } from "Enums/Copy";
import { Conversation } from "Conversations/Conversation";
import { PlanningAgent } from "./PlanningAgent";
import { Exception } from "Helpers/Exception";
import { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { OrchestrationResult } from "Types/OrchestrationResult";
import { AgentType } from "Enums/AgentType";
import { AIFunction, isAIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import { DebugColor } from "Enums/DebugColor";

export class OrchestrationAgent extends AIController {
    
    private static readonly MAX_AGENT_DEPTH: number = 3;

    private orchestrationDepth: number = 0;

    public async runPlannedWorkflow(planRequest: ExecuteWorkflowArgs, callbacks: IChatServiceCallbacks): Promise<object> {
        this.debugService?.log("OrchestrationAgent", `Starting planned workflow: ${planRequest.goal}`);
        const planningConversation: Conversation = new Conversation();
        planningConversation.contents.push(new ConversationContent({
            role: Role.User,
            content: this.preparePlanRequest(planRequest)
        }));

        const planningAgent = new PlanningAgent();
        planningAgent.resolveAIProvider();
        let planCompleted = false;

        while (!planCompleted) {
            callbacks.onPlanReset();
            callbacks.onPlanningStarted();
            this.debugService?.log("OrchestrationAgent", "Spawning PlanningAgent to generate execution plan");
            const executionPlan = await planningAgent.runPlanningAgent(planningConversation, callbacks, false);
            callbacks.onPlanningFinished();

            if (!executionPlan) {
                this.debugService?.log("OrchestrationAgent", "Planning failed - no execution plan generated");
                return { message: Copy.PlanningFailedNoSteps };
            }
            this.debugService?.log("OrchestrationAgent", `Execution plan received with ${executionPlan.executionSteps.length} steps`);
            callbacks.onPlanUpdate(executionPlan);

            let currentStepIndex = 0;
            let replanRequested = false;
            for (const [index, step] of executionPlan.executionSteps.entries()) {
                currentStepIndex = index;
                callbacks.onPlanStepUpdate(currentStepIndex);
                this.debugService?.log("OrchestrationAgent", `Executing step ${index + 1}/${executionPlan.executionSteps.length}: ${step.description}`);

                this.debugService?.log("OrchestrationAgent", "Spawning ExecutionAgent for step");
                const executionAgent = new ExecutionAgent();
                executionAgent.resolveAIProvider();
                const executionResult = await executionAgent.runExecutionAgent(step, callbacks);

                if (!executionResult) {
                    this.debugService?.log("OrchestrationAgent", `Step ${index + 1} failed to execute - workflow aborted`);
                    return { message: replaceCopy(Copy.WorkflowFailedAtStep, [step.description]) };
                }

                if (executionResult.success) {
                    this.debugService?.log("OrchestrationAgent", `Step ${index + 1} succeeded: ${executionResult.description}`);
                    planningConversation.contents.push(new ConversationContent({
                        role: Role.User,
                        content: `Step ${index + 1} executed with the following result: ${executionResult.description}`
                    }));
                } else {
                    this.debugService?.log("OrchestrationAgent", `Step ${index + 1} failed: ${executionResult.description}`);
                    planningConversation.contents.push(new ConversationContent({
                        role: Role.User,
                        content: `Step ${index + 1} failed to execute to completion. Result: ${executionResult.description}`
                    }));
                }

                this.orchestrationDepth = 0;
                const orchestrationResult = await this.runOrchestrationAgentLoop(planningConversation, callbacks);

                if (orchestrationResult.continue) {
                    this.debugService?.log("OrchestrationAgent", `Orchestration decision: CONTINUE${orchestrationResult.continueContext ? ' (with context)' : ''}`);
                    if (orchestrationResult.continueContext && index + 1 < executionPlan.executionSteps.length) {
                        const nextStep = executionPlan.executionSteps[index + 1];
                        nextStep.context = nextStep.context
                            ? nextStep.context.concat("\n\n", orchestrationResult.continueContext)
                            : orchestrationResult.continueContext;
                    }
                    continue;
                }
                if (orchestrationResult.abort) {
                    this.debugService?.log("OrchestrationAgent", `Orchestration decision: ABORT - ${orchestrationResult.abortContext}`);
                    return {
                        message: replaceCopy(Copy.WorkflowAborted, [orchestrationResult.abortContext]),
                    };
                }
                if (orchestrationResult.replan) {
                    this.debugService?.log("OrchestrationAgent", `Orchestration decision: REPLAN - ${orchestrationResult.replanContext}`);
                    planningConversation.contents.push(new ConversationContent({
                        role: Role.User,
                        content: `A replan was requested when attempting to execute Step ${index + 1}. Replan context: ${orchestrationResult.replanContext}`
                    }));
                    replanRequested = true;
                    break;
                }
            }

            planCompleted = !replanRequested && currentStepIndex >= executionPlan.executionSteps.length - 1;

            if (planCompleted) {
                callbacks.onPlanStepUpdate(executionPlan.executionSteps.length);
            }
        }

        this.debugService?.log("OrchestrationAgent", "Planned workflow completed - requesting summary");
        planningConversation.contents.push(new ConversationContent({
            role: Role.User,
            content: Copy.RequestPlanSummary
        }));
        const orchestrationSummary = await this.requestAgentResponse(planningConversation, callbacks);

        return { planExecutionSummary: orchestrationSummary };
    }

    private async runOrchestrationAgentLoop(planningConversation: Conversation, callbacks: IChatServiceCallbacks): Promise<OrchestrationResult> {
        this.setAgentPromptAndTools();

        if (this.orchestrationDepth >= OrchestrationAgent.MAX_AGENT_DEPTH) {
            this.debugService?.log("Orchestration", "Max orchestration depth reached - aborting");
            return new OrchestrationResult({ abort: true, abortContext: "Max orchestration depth reached" });
        }
        this.orchestrationDepth++;
        this.debugService?.log("Orchestration", `Starting orchestration loop (depth: ${this.orchestrationDepth}/${OrchestrationAgent.MAX_AGENT_DEPTH})`);

        let orchestrationResult: OrchestrationResult | undefined = undefined;

        await this.runAgentLoop(AgentType.Orchestration, planningConversation, callbacks, async functionCall => {
            const functionCallName = functionCall.name;

            if (!AIFunctionDefinitions.orchestrationAgentDefinitions().some(definition => isAIFunction(functionCallName, definition.name))) {
                this.debugService?.log("Orchestration", `Invalid tool call denied: ${functionCallName}`);
                planningConversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: Copy.OrchestrationToolDenial },
                    functionCall.toolId
                ));
                return { shouldExit: false };
            }

            if (isAIFunction(functionCallName, AIFunction.CompleteStep)) {
                const parseResult = CompleteStepArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.CompleteStep}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                if (!parseResult.data.confirm_completion) {
                    planningConversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: "Confirmation was false, no action taken" },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.debugService?.log("Orchestration", `CompleteStep called (confirmed: ${parseResult.data.confirm_completion})`);
                planningConversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: "Step Completed" },
                    functionCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({ continue: true, continueContext: parseResult.data.context_for_next_step });
                return { shouldExit: true }
            }

            if (isAIFunction(functionCallName, AIFunction.Replan)) {
                const parseResult = ReplanArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.Replan}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.debugService?.log("Orchestration", `Replan requested: ${parseResult.data.context}`);
                planningConversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: "Replan Requested" },
                    functionCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({ replan: true, replanContext: parseResult.data.context });
                return { shouldExit: true }
            }

            if (isAIFunction(functionCallName, AIFunction.CancelPlan)) {
                const parseResult = CancelPlanArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.CancelPlan}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.debugService?.log("Orchestration", `Plan cancellation requested: ${parseResult.data.context}`);
                planningConversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: "Plan Cancelled" },
                    functionCall.toolId
                ));
                orchestrationResult = new OrchestrationResult({ abort: true, abortContext: parseResult.data.context });
                return { shouldExit: true }
            }

            return { shouldExit: false };
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
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }
        this.ai.agentType = AgentType.Orchestration;
        this.ai.systemPrompt = this.aiPrompt.orchestrationInstruction();
        this.ai.userInstruction = ""; // do not include user instruction for orchestration agent
        this.ai.toolDefinitions = AIFunctionDefinitions.orchestrationAgentDefinitions();
    }

    protected override setDebugColor(): void {
        this.debugService?.setDebugColor(DebugColor.ORANGE);
    }
    
}
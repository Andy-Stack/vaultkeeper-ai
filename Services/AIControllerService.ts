import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { IAIClass } from "AIClasses/IAIClass";
import { Services } from "./Services";
import { Resolve } from "./DependencyService";
import { Conversation } from "Conversations/Conversation";
import type { IChatServiceCallbacks } from "./ChatService";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { AIFunctionService } from "./AIFunctionService";
import { Copy, replaceCopy } from "Enums/Copy";
import { sanitizeFunctionCallContent } from "Helpers/ResponseHelper";
import type { IPrompt } from "AIPrompts/IPrompt";
import { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { AIFunction, isAIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import { Exception } from "Helpers/Exception";
import { CancelPlanArgsSchema, CompleteStepArgsSchema, CreatePlanArgsSchema, ReplanArgsSchema, SubmitPlanArgsSchema, type CreatePlanArgs, type ReplanArgs } from "AIClasses/Schemas/AIFunctionSchemas";
import { ExecutionPlan } from "Types/ExecutionPlan";

export class AIControllerService {

    private static readonly MAX_PLANNING_ITERATIONS = 3;

    private ai: IAIClass | undefined;
    private readonly aiPrompt: IPrompt;
    private readonly aiFunctionService: AIFunctionService;

    private planningConversation: Conversation;

    public constructor() {
        this.aiPrompt = Resolve<IPrompt>(Services.IPrompt);
        this.aiFunctionService = Resolve<AIFunctionService>(Services.AIFunctionService);
    }

    public resolveAIProvider() {
        this.ai = Resolve<IAIClass>(Services.IAIClass);
    }

    public async runMainAgent(conversation: Conversation, allowDestructiveActions: boolean, callbacks: IChatServiceCallbacks) {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }

        // Setup initial prompts & tools
        this.ai.systemPrompt = this.aiPrompt.systemInstruction();
        this.ai.userInstruction = await this.aiPrompt.userInstruction();
        this.ai.toolDefinitions = AIFunctionDefinitions.agentDefinitions(allowDestructiveActions);

        await this.runAgentLoop(conversation, callbacks, async (functionCall) => {
            const functionCallName = functionCall.name;
            if (isAIFunction(functionCallName, AIFunction.CreatePlan)) {
                const completedSuccessfully = await this.handlePlanningWorkflow(conversation, functionCall, callbacks);
                return { shouldExit: completedSuccessfully };
            }

            this.updateThought({ functionCall, shouldContinue: false }, callbacks);
            const functionResponse = await this.aiFunctionService.performAIFunction(functionCall);
            conversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        });
    }

    private async handlePlanningWorkflow(conversation: Conversation, functionCall: AIFunctionCall, callbacks: IChatServiceCallbacks): Promise<boolean> {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }

        const parseResult = CreatePlanArgsSchema.safeParse(functionCall.arguments);
        if (!parseResult.success) {
            conversation.addFunctionResponse(new AIFunctionResponse(
                functionCall.name,
                { error: `Invalid arguments for ${AIFunction.CreatePlan}: ${parseResult.error.message}` },
                functionCall.toolId
            ));
            return false; // Return to main agent loop to handle the error
        }
        callbacks.onThoughtUpdate(parseResult.data.user_message);

        // Orchestrate planning and execution loop (handles replanning)

        let planningIteration = 0;
        let continueExecution = true;

        this.planningConversation = new Conversation();
        this.planningConversation.contents.push(new ConversationContent({
            role: Role.User,
            content: this.preparePlanRequest(parseResult.data)
        }));

        while (continueExecution && planningIteration < AIControllerService.MAX_PLANNING_ITERATIONS) {
            planningIteration++;

            // Run planning agent to get execution plan
            this.ai.systemPrompt = this.aiPrompt.planningInstruction();
            this.ai.userInstruction = ""; // do not include user instruction
            this.ai.toolDefinitions = AIFunctionDefinitions.planningAgentDefinitions();

            const executionPlan = await this.runPlanningAgent(this.planningConversation, callbacks);

            // Run execution agent with the plan
            this.ai.systemPrompt = this.aiPrompt.systemInstruction();
            this.ai.userInstruction = await this.aiPrompt.userInstruction();
            this.ai.toolDefinitions = AIFunctionDefinitions.agentExecutionDefinitions();

            const executionResult = await this.runExecutionAgent(conversation, executionPlan, callbacks);

            // Stop if cancelled, otherwise continue if replanning was requested OR execution was incomplete
            if (executionResult.planExecutionCancelled) {
                continueExecution = false;
            } else {
                continueExecution = executionResult.shouldReplan || executionResult.isIncomplete;
            }

            if (continueExecution && executionResult.replanData) {
                // Agent explicitly requested replan with context
                this.planningConversation.contents.push(new ConversationContent({
                    role: Role.User,
                    content: this.prepareReplanRequest(executionResult.replanData)
                }));
            } else if (continueExecution && executionResult.isIncomplete) {
                // Execution stopped prematurely - ask planner to revise
                this.planningConversation.contents.push(new ConversationContent({
                    role: Role.User,
                    content: this.prepareIncompleteExecutionRequest(executionPlan)
                }));
            }
        }

        // Handle max iterations reached
        if (planningIteration >= AIControllerService.MAX_PLANNING_ITERATIONS && continueExecution) {
            conversation.contents.push(new ConversationContent({
                role: Role.Assistant,
                content: Copy.MaxPlanningIterationsReached
            }));
        }

        return true; // Planning and execution completed - terminate main agent
    }

    private async runPlanningAgent(planningConversation: Conversation, callbacks: IChatServiceCallbacks): Promise<ExecutionPlan> {
        let capturedPlan: ExecutionPlan | null = null;

        await this.runAgentLoop(planningConversation, callbacks, async (functionCall) => {
            const functionCallName = functionCall.name;

            if (isAIFunction(functionCallName, AIFunction.SubmitPlan)) {
                const parseResult = SubmitPlanArgsSchema.safeParse(functionCall.arguments);
                capturedPlan = parseResult.success
                    ? new ExecutionPlan(parseResult.data)
                    : new ExecutionPlan({ steps: [] });
                return { shouldExit: true }; // Exit once plan is submitted
            }

            this.updateThought({ functionCall, shouldContinue: false }, callbacks);
            const functionResponse = await this.aiFunctionService.performAIFunction(functionCall);
            planningConversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        }, false);

        return capturedPlan ?? new ExecutionPlan({ steps: [] });
    }

    // The 'execution agent' is still the main agent but given specific tools related to plan execution
    private async runExecutionAgent(conversation: Conversation, executionPlan: ExecutionPlan, callbacks: IChatServiceCallbacks
    ): Promise<{ shouldReplan: boolean, isIncomplete: boolean, planExecutionCancelled: boolean, replanData?: ReplanArgs }> {

        // callback to ui with execution plan - gets reference to plan so auto updates when updated

        const lastCall = conversation.contents[conversation.contents.length - 1];
        if (lastCall && lastCall.functionCall) {
            const planningResponse = this.createPlanningResponse(lastCall, executionPlan);
            if (planningResponse) {
                conversation.addFunctionResponse(planningResponse);
            }
        }

        let replanData: ReplanArgs | undefined;
        let planExecutionCancelled = false;

        await this.runAgentLoop(conversation, callbacks, async (functionCall) => {
            const functionCallName = functionCall.name;

            if (isAIFunction(functionCallName, AIFunction.CancelPlan)) {
                const parseResult = CancelPlanArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.CancelPlan}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                planExecutionCancelled = parseResult.data.confirm_cancellation;
                conversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: planExecutionCancelled ? Copy.PlanExecutionCancelled : Copy.PlanExecutionNotCancelled },
                    functionCall.toolId
                ));
                return { shouldExit: planExecutionCancelled };
            }

            if (isAIFunction(functionCallName, AIFunction.Replan)) {
                const parseResult = ReplanArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.Replan}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                // Capture replan data and exit execution loop to trigger replanning
                replanData = parseResult.data;
                return { shouldExit: true };
            }

            if (isAIFunction(functionCallName, AIFunction.CompleteStep)) {
                const parseResult = CompleteStepArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.CompleteStep}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                const functionResponse = new AIFunctionResponse(
                    functionCallName,
                    executionPlan.completeExecutionStep(parseResult.data.step_number),
                    functionCall.toolId
                );
                conversation.addFunctionResponse(functionResponse);
                return { shouldExit: false };
            }

            this.updateThought({ functionCall, shouldContinue: false }, callbacks);
            const functionResponse = await this.aiFunctionService.performAIFunction(functionCall);
            conversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        });

        const isIncomplete = !executionPlan.completed();
        return { shouldReplan: replanData !== undefined, isIncomplete, planExecutionCancelled: planExecutionCancelled, replanData };
    }

    private async runAgentLoop(conversation: Conversation, callbacks: IChatServiceCallbacks,
        handleFunctionCall: (functionCall: AIFunctionCall) => Promise<{ shouldExit: boolean }>, clearThoughtOnContent: boolean = true
    ): Promise<void> {
        let response = await this.streamRequestResponse(this.ensureCorrectConversationStructure(conversation), callbacks, clearThoughtOnContent);

        while (response.functionCall || response.shouldContinue) {
            if (response.functionCall) {
                const result = await handleFunctionCall(response.functionCall);
                if (result.shouldExit) {
                    return;
                }
            } else {
                callbacks.onThoughtUpdate(Copy.AIThoughtMessage);
            }

            response = await this.streamRequestResponse(this.ensureCorrectConversationStructure(conversation), callbacks, clearThoughtOnContent);
        }
    }

    private updateThought(response: { functionCall: AIFunctionCall | null, shouldContinue: boolean }, callbacks: IChatServiceCallbacks) {
        const userMessage = response.functionCall?.arguments.user_message;
        if (userMessage && typeof userMessage === "string") {
            callbacks.onThoughtUpdate(userMessage);
        }
    }

    private ensureCorrectConversationStructure(conversation: Conversation): Conversation {
		// Check if the last message is from the assistant to prevent assistant-to-assistant structure
		// This can happen when the assistant's last message had no function call and the user sends a new request
		if (conversation.contents.length > 0) {
			const lastMessage = conversation.contents[conversation.contents.length - 1];
			if (lastMessage.role === Role.Assistant) {
				// Insert a hidden "Continue" message to maintain proper conversation structure
				conversation.contents.push(ConversationContent.safeContinue());
			}
		}
		return conversation;
	}

    private async streamRequestResponse(conversation: Conversation, callbacks: IChatServiceCallbacks, clearThoughtOnContent: boolean = true
    ): Promise<{ functionCall: AIFunctionCall | null, shouldContinue: boolean }> {
        if (!this.ai) { // this should never happen
            return { functionCall: null, shouldContinue: false };
        }

        const conversationContent = new ConversationContent({ role: Role.Assistant });
        conversation.contents.push(conversationContent);

        let accumulatedContent = "";
        let capturedFunctionCall: AIFunctionCall | null = null;
        let capturedShouldContinue = false;

        for await (const chunk of this.ai.streamRequest(conversation)) {
            if (chunk.error && chunk.errorType) {
                conversationContent.content = chunk.error;
                conversationContent.errorType = chunk.errorType;
                callbacks.onStreamingUpdate(null);
                break;
            }

            if (chunk.functionCall) {
                capturedFunctionCall = chunk.functionCall;
            }

            if (chunk.shouldContinue) {
                capturedShouldContinue = true;
            }

            if (chunk.content) {
                accumulatedContent += chunk.content;

                conversationContent.content = accumulatedContent;
                if (accumulatedContent.trim() !== "" && clearThoughtOnContent) {
                    callbacks.onThoughtUpdate(null);
                }
            }

            if (chunk.isComplete) {
                const sanitizedContent = sanitizeFunctionCallContent(accumulatedContent, capturedFunctionCall);

                if (sanitizedContent.trim() === "" && !capturedFunctionCall) {
                    conversation.contents.pop();
                } else {
                    conversationContent.content = sanitizedContent;
                    if (capturedFunctionCall) {
                        conversationContent.functionCall = capturedFunctionCall.toConversationString();
                        if (capturedFunctionCall.thoughtSignature) {
                            conversationContent.thoughtSignature = capturedFunctionCall.thoughtSignature;
                        }
                    }
                }
            }

            if (conversationContent.content?.trim() !== "") {
                callbacks.onStreamingUpdate(conversationContent.timestamp.getTime().toString());
            }
        }

        callbacks.onStreamingUpdate(null);

        return { functionCall: capturedFunctionCall, shouldContinue: capturedShouldContinue };
    }

    private preparePlanRequest(input: CreatePlanArgs): string {
        const context = input.context ? replaceCopy(Copy.ContextTags, [input.context]) : "";
        return input.goal + context;
    }
    
    private prepareReplanRequest(input: ReplanArgs): string {
        return replaceCopy(Copy.ReplanRequestTemplate, [
            input.original_goal,
            input.completed_steps,
            input.issue_encountered,
            input.context
        ]);
    }

    private prepareIncompleteExecutionRequest(executionPlan: ExecutionPlan): string {
        const { completed, remaining } = executionPlan.getStatusSummary();
        const completedSection = completed.length > 0
            ? `${Copy.CompletedStepsHeader}\n${completed.join("\n")}`
            : `${Copy.CompletedStepsHeader}\n${Copy.NoSteps}`;
        const remainingSection = remaining.length > 0
            ? `${Copy.RemainingStepsHeader}\n${remaining.join("\n")}`
            : `${Copy.RemainingStepsHeader}\n${Copy.NoSteps}`;

        return replaceCopy(Copy.IncompleteExecutionRequestTemplate, [
            completedSection,
            remainingSection
        ]);
    }

    private createPlanningResponse(conversationContent: ConversationContent, executionPlan: ExecutionPlan): AIFunctionResponse | undefined {
        const createParseResult = CreatePlanArgsSchema.safeParse(conversationContent.functionCall);
        if (createParseResult.success) {
            return new AIFunctionResponse(
                AIFunction.CreatePlan,
                executionPlan.toFunctionResponse(),
                conversationContent.toolId
            );
        }
        const replanParseResult = ReplanArgsSchema.safeParse(conversationContent.functionCall);
        if (replanParseResult.success) {
            return new AIFunctionResponse(
                AIFunction.Replan,
                executionPlan.toFunctionResponse(),
                conversationContent.toolId
            );
        }
    }
}
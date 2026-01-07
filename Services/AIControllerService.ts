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
import { parseFunctionCall, sanitizeFunctionCallContent } from "Helpers/ResponseHelper";
import type { IPrompt } from "AIPrompts/IPrompt";
import { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { AIFunction, isAIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import { Exception } from "Helpers/Exception";
import { AskUserQuestionExecutionArgsSchema, AskUserQuestionPlanningArgsSchema, CancelPlanArgsSchema, CompletePlanArgsSchema, CompleteStepArgsSchema, CreatePlanArgsSchema, ReplanArgsSchema, SubmitPlanArgsSchema, type CreatePlanArgs, type ReplanArgs } from "AIClasses/Schemas/AIFunctionSchemas";
import { ExecutionPlan } from "Types/ExecutionPlan";

export class AIControllerService {

    private static readonly MAX_AGENT_DEPTH = 3;

    private ai: IAIClass | undefined;
    private readonly aiPrompt: IPrompt;
    private readonly aiFunctionService: AIFunctionService;

    private planningConversation: Conversation;
    private onSaveConversation?: (conversation: Conversation) => Promise<void>;

    private executionDepth: number = 1;
    private planningDepth: number = 1;

    public constructor() {
        this.aiPrompt = Resolve<IPrompt>(Services.IPrompt);
        this.aiFunctionService = Resolve<AIFunctionService>(Services.AIFunctionService);
    }

    public resolveAIProvider() {
        this.ai = Resolve<IAIClass>(Services.IAIClass);
    }

    public setSaveCallback(callback: (conversation: Conversation) => Promise<void>) {
        this.onSaveConversation = callback;
    }

    public async runMainAgent(conversation: Conversation, allowDestructiveActions: boolean, planningMode: boolean, callbacks: IChatServiceCallbacks) {
        if (!this.ai) { // this shouldn't ever happen
            Exception.throw("Error: No AI provider has been set!");
        }

        // Setup initial prompts & tools
        this.ai.systemPrompt = this.aiPrompt.systemInstruction(planningMode);
        this.ai.userInstruction = await this.aiPrompt.userInstruction();
        this.ai.toolDefinitions = AIFunctionDefinitions.agentDefinitions(allowDestructiveActions, planningMode);

        let planRequested = false;
        await this.runAgentLoop(conversation, callbacks, async (functionCall) => {
            const functionCallName = functionCall.name;
            if (isAIFunction(functionCallName, AIFunction.CreatePlan)) {
                try {
                    planRequested = true;
                    const completedSuccessfully = await this.handlePlanningWorkflow(conversation, functionCall, callbacks);
                    return { shouldExit: completedSuccessfully };
                } finally {
                    callbacks.onPlanReset();
                }
            }

            if (planningMode && !planRequested) {
                conversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { error: Copy.PlanningModeError },
                    functionCall.toolId
                ));
                return { shouldExit: false };
            }

            this.updateThought(functionCall, callbacks);
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

        let planExecutionCancelled = false;

        this.planningConversation = new Conversation();
        this.planningConversation.contents.push(new ConversationContent({
            role: Role.User,
            content: this.preparePlanRequest(parseResult.data)
        }));

        while (true) {
            // Run planning agent to get execution plan
            this.ai.systemPrompt = this.aiPrompt.planningInstruction();
            this.ai.userInstruction = ""; // do not include user instruction
            this.ai.toolDefinitions = AIFunctionDefinitions.planningAgentDefinitions();

            this.planningDepth = 1;
            callbacks.onPlanReset();
            callbacks.onPlanningStarted();
            const executionPlan = await this.runPlanningAgent(this.planningConversation, callbacks);
            callbacks.onPlanningFinished();

            // Run execution agent with the plan
            this.ai.systemPrompt = this.aiPrompt.systemInstruction();
            this.ai.userInstruction = await this.aiPrompt.userInstruction();
            this.ai.toolDefinitions = AIFunctionDefinitions.agentExecutionDefinitions();

            this.executionDepth = 1;
            const executionResult = await this.runExecutionAgent(conversation, executionPlan, callbacks);

            if (executionResult.planExecutionCancelled) {
                planExecutionCancelled = true;
                break;
            }
            
            if (executionResult.replanData) {
                // Agent explicitly requested replan with context
                this.planningConversation.contents.push(new ConversationContent({
                    role: Role.User,
                    content: this.prepareReplanRequest(executionResult.replanData)
                }));
                continue;
            }

            break;
        }

        // If plan was cancelled, return false to give control back to main agent for summary
        // Otherwise return true to terminate the main agent loop
        return !planExecutionCancelled;
    }

    private async runPlanningAgent(planningConversation: Conversation, callbacks: IChatServiceCallbacks): Promise<ExecutionPlan> {
        const isReplan = planningConversation.contents.length > 0;
        let capturedPlan: ExecutionPlan | null = null;
        
        if (this.planningDepth >= AIControllerService.MAX_AGENT_DEPTH) {
            return new ExecutionPlan({ steps: [] }, isReplan);
        }
        this.planningDepth++;

        await this.runAgentLoop(planningConversation, callbacks, async (functionCall) => {
            const functionCallName = functionCall.name;

            if (!AIFunctionDefinitions.planningAgentDefinitions().some(definition => isAIFunction(functionCallName, definition.name))) {
                planningConversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: Copy.PlanningToolDenial },
                    functionCall.toolId
                ));
                return { shouldExit: false };
            }

            if (isAIFunction(functionCallName, AIFunction.AskUserQuestionPlanning)) {
                const parseResult = AskUserQuestionPlanningArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.AskUserQuestionPlanning}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.updateThought(functionCall, callbacks);
                const answer = await callbacks.onUserQuestion(parseResult.data.question);
                planningConversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { answer: answer },
                    functionCall.toolId
                ));
                return { shouldExit: false };
            }

            if (isAIFunction(functionCallName, AIFunction.SubmitPlan)) {
                const parseResult = SubmitPlanArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    planningConversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.SubmitPlan}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                capturedPlan = new ExecutionPlan(parseResult.data, isReplan);
                planningConversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { message: "Plan received" },
                    functionCall.toolId
                ));
                return { shouldExit: true }; // Exit once plan is submitted
            }

            this.updateThought(functionCall, callbacks);
            const functionResponse = await this.aiFunctionService.performAIFunction(functionCall);
            planningConversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        }, true);

        if (!capturedPlan) {
            Exception.warn(`Failed to generate execution plan.\n${JSON.stringify(planningConversation, null, 2)}`);
            planningConversation.contents.push(new ConversationContent({
                role: Role.User,
                content: Copy.PlanSubmissionRequired,
                shouldDisplayContent: false
            }));
            return await this.runPlanningAgent(planningConversation, callbacks);
        }
        return capturedPlan || new ExecutionPlan({ steps: [] }, isReplan);
    }

    // The 'execution agent' is still the main agent but given specific tools related to plan execution
    private async runExecutionAgent(conversation: Conversation, executionPlan: ExecutionPlan, callbacks: IChatServiceCallbacks
    ): Promise<{ planExecutionCancelled: boolean, replanData?: ReplanArgs }> {
        
        const lastCall = conversation.contents[conversation.contents.length - 1];
        
        if (this.executionDepth >= AIControllerService.MAX_AGENT_DEPTH) {
            if (lastCall && lastCall.functionCall) {
                conversation.contents.pop(); // remove function call (likely a replan call)
                conversation.contents.push(new ConversationContent({
                    role: Role.User,
                    content: Copy.MaxExecutionDepthReached,
                    shouldDisplayContent: false
                }));
                return { planExecutionCancelled: true };
            }
        }
        this.executionDepth++;

        if (executionPlan.isReplan && lastCall && lastCall.functionCall) {
            const planningResponse = this.createPlanningResponse(lastCall, executionPlan);
            if (planningResponse) {
                conversation.addFunctionResponse(planningResponse);
            }
        }
        
        if (executionPlan.executionSteps.length > 0) {
            callbacks.onPlanUpdate(executionPlan); // plan is being executed so inform UI
        }

        let replanData: ReplanArgs | undefined;
        let planExecutionCancelled = false;

        await this.runAgentLoop(conversation, callbacks, async (functionCall) => {
            const functionCallName = functionCall.name;

            if (isAIFunction(functionCallName, AIFunction.AskUserQuestionExecution)) {
                const parseResult = AskUserQuestionExecutionArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.AskUserQuestionExecution}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                this.updateThought(functionCall, callbacks);
                const answer = await callbacks.onUserQuestion(parseResult.data.question);
                conversation.addFunctionResponse(new AIFunctionResponse(
                    functionCallName,
                    { answer: answer, completion_reminder: Copy.CompletionReminder },
                    functionCall.toolId
                ));
                return { shouldExit: false };
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
                callbacks.onPlanStepUpdate();
                return { shouldExit: false };
            }

            if (isAIFunction(functionCallName, AIFunction.CompletePlan)) {
                const parseResult = CompletePlanArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    conversation.addFunctionResponse(new AIFunctionResponse(
                        functionCallName,
                        { error: `Invalid arguments for ${AIFunction.CompletePlan}: ${parseResult.error.message}` },
                        functionCall.toolId
                    ));
                    return { shouldExit: false };
                }
                const functionResponse = new AIFunctionResponse(
                    functionCallName,
                    executionPlan.completeExecutionPlan(parseResult.data.confirm_completion),
                    functionCall.toolId
                );
                conversation.addFunctionResponse(functionResponse);
                return { shouldExit: false };
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
                    { message: planExecutionCancelled ? Copy.PlanExecutionCancelled : Copy.ConfirmationFalse },
                    functionCall.toolId
                ));
                return { shouldExit: planExecutionCancelled };
            }

            this.updateThought(functionCall, callbacks);
            const functionResponse = await this.aiFunctionService.performAIFunction(functionCall);
            conversation.addFunctionResponse(functionResponse);
            return { shouldExit: false };
        });

        if (!executionPlan.completed() && !replanData && !planExecutionCancelled) {
            conversation.contents.push(new ConversationContent({
                role: Role.User,
                content: replaceCopy(Copy.IncompleteExecutionAttempt, 
                    [executionPlan.incompleteSteps().join(", ")]),
                shouldDisplayContent: false
            }));
            return await this.runExecutionAgent(conversation, executionPlan, callbacks);
        }

        return { planExecutionCancelled: planExecutionCancelled, replanData: replanData };
    }

    private async runAgentLoop(conversation: Conversation, callbacks: IChatServiceCallbacks,
        handleFunctionCall: (functionCall: AIFunctionCall) => Promise<{ shouldExit: boolean }>, isPlanningAgent: boolean = false
    ): Promise<void> {
        let response = await this.streamRequestResponse(this.ensureCorrectConversationStructure(conversation), callbacks, isPlanningAgent);

        if (!isPlanningAgent) {
            await this.onSaveConversation?.(conversation);
        }

        while (response.functionCall || response.shouldContinue) {
            if (response.functionCall) {
                const result = await handleFunctionCall(response.functionCall);
                if (result.shouldExit) {
                    if (!isPlanningAgent) {
                        await this.onSaveConversation?.(conversation);
                    }
                    return;
                }
            } else {
                callbacks.onThoughtUpdate(Copy.AIThoughtMessage);
            }

            response = await this.streamRequestResponse(this.ensureCorrectConversationStructure(conversation), callbacks, isPlanningAgent);

            if (!isPlanningAgent) {
                await this.onSaveConversation?.(conversation);
            }
        }
    }

    private updateThought(functionCall: AIFunctionCall | null, callbacks: IChatServiceCallbacks) {
        const userMessage = functionCall?.arguments.user_message;
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

    private async streamRequestResponse(conversation: Conversation, callbacks: IChatServiceCallbacks, isPlanningAgent: boolean
    ): Promise<{ functionCall: AIFunctionCall | null, shouldContinue: boolean }> {
        if (!this.ai) { // this should never happen
            return { functionCall: null, shouldContinue: false };
        }

        const conversationContent = new ConversationContent({ role: Role.Assistant });
        conversation.contents.push(conversationContent);

        let accumulatedContent = "";
        let capturedFunctionCall: AIFunctionCall | null = null;
        let capturedShouldContinue = false;

        for await (const chunk of this.ai.streamRequest(conversation, isPlanningAgent)) {
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
                if (accumulatedContent.trim() !== "" && !isPlanningAgent) {
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
                        conversationContent.toolId = capturedFunctionCall.toolId;
                        conversationContent.shouldDisplayContent = sanitizedContent.trim() !== "";
                        if (capturedFunctionCall.thoughtSignature) {
                            conversationContent.thoughtSignature = capturedFunctionCall.thoughtSignature;
                        }
                    }
                }
            }

            if (conversationContent.content?.trim() !== "") {
                callbacks.onStreamingUpdate(conversationContent.timestamp.getTime().toString());
            } else {
                conversationContent.shouldDisplayContent = false;
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

    private createPlanningResponse(conversationContent: ConversationContent, executionPlan: ExecutionPlan): AIFunctionResponse | undefined {
        if (!conversationContent.functionCall) {
            return undefined;
        }
        const parsedFunctionCall = parseFunctionCall(conversationContent.functionCall);
        if (!parsedFunctionCall) {
            return undefined;
        }

        const createParseResult = CreatePlanArgsSchema.safeParse(parsedFunctionCall.functionCall.args);
        if (createParseResult.success) {
            return new AIFunctionResponse(
                AIFunction.CreatePlan,
                executionPlan.toFunctionResponse(),
                conversationContent.toolId
            );
        }
        const replanParseResult = ReplanArgsSchema.safeParse(parsedFunctionCall.functionCall.args);
        if (replanParseResult.success) {
            return new AIFunctionResponse(
                AIFunction.Replan,
                executionPlan.toFunctionResponse(),
                conversationContent.toolId
            );
        }

        return undefined;
    }
}
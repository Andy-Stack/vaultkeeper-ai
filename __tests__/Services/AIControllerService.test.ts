import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIController } from '../../Services/AIServices/AIController';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { AIFunction } from '../../Enums/AIFunction';
import { AIFunctionCall } from '../../AIClasses/AIFunctionCall';
import { AIFunctionResponse } from '../../AIClasses/FunctionDefinitions/AIFunctionResponse';

/**
 * INTEGRATION TESTS - AIControllerService
 *
 * Tests the multi-agent controller service that orchestrates:
 * - Main agent execution
 * - Planning agent workflow
 * - Execution agent workflow
 * - Agent loop management
 */

describe('AIControllerService - Integration Tests', () => {
	let service: AIController;
	let mockAI: any;
	let mockPrompt: any;
	let mockAIFunctionService: any;

	beforeEach(() => {
		// Mock IPrompt
		mockPrompt = {
			systemInstruction: vi.fn().mockReturnValue('System instruction'),
			userInstruction: vi.fn().mockResolvedValue('User instruction'),
			planningInstruction: vi.fn().mockReturnValue('Planning instruction')
		};
		RegisterSingleton(Services.IPrompt, mockPrompt);

		// Mock AIFunctionService
		mockAIFunctionService = {
			performAIFunction: vi.fn().mockResolvedValue(
				new AIFunctionResponse(AIFunction.SearchVaultFiles, { results: [] }, 'test-tool-id')
			)
		};
		RegisterSingleton(Services.AIFunctionService, mockAIFunctionService);

		// Mock IAIClass
		mockAI = {
			systemPrompt: '',
			userInstruction: '',
			toolDefinitions: [],
			streamRequest: vi.fn()
		};
		RegisterSingleton(Services.IAIClass, mockAI);

		// Create service
		service = new AIController();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with all required services', () => {
			const testService = new AIController();

			expect(testService).toBeDefined();
		});
	});

	describe('resolveAIProvider', () => {
		it('should resolve AI provider', () => {
			service.resolveAIProvider();

			// Should not throw
			expect(service).toBeDefined();
		});
	});

	describe('runMainAgent', () => {
		it('should set system prompt and user instruction', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test request' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			// Mock streamRequest to return immediately without function calls
			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: 'Response', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, false, callbacks);

			// Verify system prompt and user instruction were set
			expect(mockPrompt.systemInstruction).toHaveBeenCalled();
			expect(mockPrompt.userInstruction).toHaveBeenCalled();
		});

		it('should handle streaming response without function calls', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test request' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: 'Part 1', isComplete: false };
				yield { content: ' Part 2', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, false, callbacks);

			// Should have added assistant message to conversation
			expect(conversation.contents.length).toBeGreaterThan(1);
			const lastMessage = conversation.contents[conversation.contents.length - 1];
			expect(lastMessage.role).toBe(Role.Assistant);
			expect(lastMessage.content).toContain('Part 1');
		});

		it('should throw error if AI provider not resolved', async () => {
			const conversation = new Conversation();
			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			// Don't call resolveAIProvider()
			await expect(service.runMainAgent(conversation, true, false, callbacks))
				.rejects.toThrow('Error: No AI provider has been set!');
		});
	});

	describe('ensureCorrectConversationStructure', () => {
		it('should insert Continue message when last message is from assistant', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'First' }));
			conversation.contents.push(new ConversationContent({ role: Role.Assistant, content: 'Response' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: 'New response', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, false, callbacks);

			// Should have inserted Continue message between last assistant and new assistant
			const continueMessage = conversation.contents.find(c =>
				c.role === Role.User && c.content === 'Continue' && c.shouldDisplayContent === false
			);
			expect(continueMessage).toBeDefined();
		});
	});

	describe('Agent Loop with Function Calls', () => {
		it('should handle function calls and continue the loop', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Search for notes' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				callCount++;
				if (callCount === 1) {
					// First call returns a function call
					yield {
						content: 'Let me search',
						functionCall: new AIFunctionCall(
							AIFunction.SearchVaultFiles,
							{ search_terms: ['test'], user_message: 'Searching' },
							'tool-1'
						),
						isComplete: true
					};
				} else {
					// Second call returns final response
					yield { content: 'Found results', isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, false, callbacks);

			// Verify function was called
			expect(mockAIFunctionService.performAIFunction).toHaveBeenCalledTimes(1);
			expect(callCount).toBe(2);
		});

		it('should update thought callback with user_message from function call', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Search' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				callCount++;
				if (callCount === 1) {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.SearchVaultFiles,
							{ search_terms: ['notes'], user_message: 'Searching for notes' },
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield { content: 'Done', isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, false, callbacks);

			expect(callbacks.onThoughtUpdate).toHaveBeenCalledWith('Searching for notes');
		});
	});

	describe('Planning Mode', () => {
		it('should reject function calls in planning mode when no plan created', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Search files' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				callCount++;
				if (callCount === 1) {
					// Attempt to call a function without creating a plan first
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.SearchVaultFiles,
							{ search_terms: ['test'], user_message: 'Search' },
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield { content: 'OK', isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks); // planningMode = true

			// Should NOT have called the actual function service
			expect(mockAIFunctionService.performAIFunction).not.toHaveBeenCalled();
		});

		it('should trigger planning workflow when CreatePlan is called', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Organize my notes' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let mainAgentCalls = 0;
			let planningAgentCalls = 0;
			let executionAgentCalls = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				// Track which agent is calling based on tool definitions
				const toolDefs = mockAI.toolDefinitions;
				const isPlanningAgent = toolDefs.some((t: any) => t.name === AIFunction.SubmitPlan);
				const isExecutionAgent = toolDefs.some((t: any) => t.name === AIFunction.CompleteStep);

				if (isPlanningAgent) {
					planningAgentCalls++;
					// Planning agent submits a plan
					yield {
						content: 'Here is my plan',
						functionCall: new AIFunctionCall(
							AIFunction.SubmitPlan,
							{
								steps: [
									{ description: 'Step 1', instruction: 'Do step 1' }
								]
							},
							'plan-tool-1'
						),
						isComplete: true
					};
				} else if (isExecutionAgent) {
					executionAgentCalls++;
					if (executionAgentCalls === 1) {
						// First execution call: complete the step
						yield {
							content: 'Completing step',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 1 },
								'exec-tool-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 2) {
						// Second execution call: complete the plan
						yield {
							content: 'Plan done',
							functionCall: new AIFunctionCall(
								AIFunction.CompletePlan,
								{ confirm_completion: true },
								'exec-tool-2'
							),
							isComplete: true
						};
					} else {
						yield { content: 'All done!', isComplete: true };
					}
				} else {
					mainAgentCalls++;
					// Main agent creates a plan
					yield {
						content: 'I will create a plan',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{
								goal: 'Organize notes',
								user_message: 'Creating a plan to organize notes'
							},
							'main-tool-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			expect(callbacks.onPlanningStarted).toHaveBeenCalled();
			expect(callbacks.onPlanningFinished).toHaveBeenCalled();
			expect(callbacks.onPlanReset).toHaveBeenCalled();
			expect(mainAgentCalls).toBeGreaterThanOrEqual(1);
			expect(planningAgentCalls).toBeGreaterThanOrEqual(1);
		});
	});

	describe('Execution Agent', () => {
		it('should handle CompleteStep function call', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Execute plan' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let mainAgentCalls = 0;
			let planningAgentCalls = 0;
			let executionAgentCalls = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				const toolDefs = mockAI.toolDefinitions;
				const isPlanningAgent = toolDefs.some((t: any) => t.name === AIFunction.SubmitPlan);
				const isExecutionAgent = toolDefs.some((t: any) => t.name === AIFunction.CompleteStep);

				if (isPlanningAgent) {
					planningAgentCalls++;
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.SubmitPlan,
							{
								steps: [
									{ description: 'First step', instruction: 'Execute first' },
									{ description: 'Second step', instruction: 'Execute second' }
								]
							},
							'plan-1'
						),
						isComplete: true
					};
				} else if (isExecutionAgent) {
					executionAgentCalls++;
					if (executionAgentCalls === 1) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 1 },
								'exec-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 2) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 2 },
								'exec-2'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 3) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompletePlan,
								{ confirm_completion: true },
								'exec-3'
							),
							isComplete: true
						};
					} else {
						yield { content: 'Execution complete', isComplete: true };
					}
				} else {
					mainAgentCalls++;
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{ goal: 'Test goal', user_message: 'Planning' },
							'main-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			// onPlanStepUpdate should be called when steps are completed
			expect(callbacks.onPlanStepUpdate).toHaveBeenCalled();
		});

		it('should handle CancelPlan function call', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Do something' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let planningAgentCalls = 0;
			let executionAgentCalls = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				const toolDefs = mockAI.toolDefinitions;
				const isPlanningAgent = toolDefs.some((t: any) => t.name === AIFunction.SubmitPlan);
				const isExecutionAgent = toolDefs.some((t: any) => t.name === AIFunction.CompleteStep);

				if (isPlanningAgent) {
					planningAgentCalls++;
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.SubmitPlan,
							{
								steps: [{ description: 'Step 1', instruction: 'Do it' }]
							},
							'plan-1'
						),
						isComplete: true
					};
				} else if (isExecutionAgent) {
					executionAgentCalls++;
					if (executionAgentCalls === 1) {
						// Cancel the plan
						yield {
							content: 'Cancelling',
							functionCall: new AIFunctionCall(
								AIFunction.CancelPlan,
								{ confirm_cancellation: true },
								'cancel-1'
							),
							isComplete: true
						};
					} else {
						yield { content: 'Cancelled summary', isComplete: true };
					}
				} else {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{ goal: 'Goal', user_message: 'Planning' },
							'main-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			// Plan was cancelled, so planning should have finished
			expect(callbacks.onPlanningFinished).toHaveBeenCalled();
		});

		it('should handle AskUserQuestionExecution function call', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Help me' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn().mockResolvedValue('User answer'),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let planningAgentCalls = 0;
			let executionAgentCalls = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				const toolDefs = mockAI.toolDefinitions;
				const isPlanningAgent = toolDefs.some((t: any) => t.name === AIFunction.SubmitPlan);
				const isExecutionAgent = toolDefs.some((t: any) => t.name === AIFunction.CompleteStep);

				if (isPlanningAgent) {
					planningAgentCalls++;
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.SubmitPlan,
							{
								steps: [{ description: 'Ask user', instruction: 'Ask question' }]
							},
							'plan-1'
						),
						isComplete: true
					};
				} else if (isExecutionAgent) {
					executionAgentCalls++;
					if (executionAgentCalls === 1) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.AskUserQuestionExecution,
								{ question: 'What do you prefer?', user_message: 'Asking user' },
								'ask-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 2) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 1 },
								'step-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 3) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompletePlan,
								{ confirm_completion: true },
								'complete-1'
							),
							isComplete: true
						};
					} else {
						yield { content: 'Done', isComplete: true };
					}
				} else {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{ goal: 'Goal', user_message: 'Planning' },
							'main-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			expect(callbacks.onUserQuestion).toHaveBeenCalledWith('What do you prefer?');
		});
	});

	describe('Replan Workflow', () => {
		it('should handle Replan function call and restart planning', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Complex task' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let planningAgentCalls = 0;
			let executionAgentCalls = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				const toolDefs = mockAI.toolDefinitions;
				const isPlanningAgent = toolDefs.some((t: any) => t.name === AIFunction.SubmitPlan);
				const isExecutionAgent = toolDefs.some((t: any) => t.name === AIFunction.CompleteStep);

				if (isPlanningAgent) {
					planningAgentCalls++;
					if (planningAgentCalls === 1) {
						// First plan
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.SubmitPlan,
								{
									steps: [
										{ description: 'Step 1', instruction: 'Do step 1' },
										{ description: 'Step 2', instruction: 'Do step 2' }
									]
								},
								'plan-1'
							),
							isComplete: true
						};
					} else {
						// Replan - simpler plan
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.SubmitPlan,
								{
									steps: [
										{ description: 'New step', instruction: 'Do new step' }
									]
								},
								'plan-2'
							),
							isComplete: true
						};
					}
				} else if (isExecutionAgent) {
					executionAgentCalls++;
					if (executionAgentCalls === 1) {
						// Request replan
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.Replan,
								{
									original_goal: 'Complex task',
									completed_steps: 'None',
									issue_encountered: 'Need different approach',
									context: 'Additional context',
									user_message: 'Requesting replan'
								},
								'replan-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 2) {
						// Complete new step
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 1 },
								'step-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 3) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompletePlan,
								{ confirm_completion: true },
								'complete-1'
							),
							isComplete: true
						};
					} else {
						yield { content: 'Done', isComplete: true };
					}
				} else {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{ goal: 'Complex task', user_message: 'Starting' },
							'main-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			// Planning should have been called twice (original + replan)
			expect(planningAgentCalls).toBe(2);
			// onPlanReset should be called for each planning cycle
			expect(callbacks.onPlanReset).toHaveBeenCalled();
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid CreatePlan arguments', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Do something' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				callCount++;
				if (callCount === 1) {
					// Invalid CreatePlan - missing required fields
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{ invalid: 'args' }, // Missing goal and user_message
							'main-1'
						),
						isComplete: true
					};
				} else {
					yield { content: 'Recovered', isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			// Should NOT have started planning workflow due to invalid args
			expect(callbacks.onPlanningStarted).not.toHaveBeenCalled();
		});

		it('should handle invalid CompleteStep arguments', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Execute' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let executionAgentCalls = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				const toolDefs = mockAI.toolDefinitions;
				const isPlanningAgent = toolDefs.some((t: any) => t.name === AIFunction.SubmitPlan);
				const isExecutionAgent = toolDefs.some((t: any) => t.name === AIFunction.CompleteStep);

				if (isPlanningAgent) {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.SubmitPlan,
							{ steps: [{ description: 'Step', instruction: 'Do' }] },
							'plan-1'
						),
						isComplete: true
					};
				} else if (isExecutionAgent) {
					executionAgentCalls++;
					if (executionAgentCalls === 1) {
						// Invalid CompleteStep - missing step_number
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ invalid: 'args' },
								'step-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 2) {
						// Valid completion
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 1 },
								'step-2'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 3) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompletePlan,
								{ confirm_completion: true },
								'complete-1'
							),
							isComplete: true
						};
					} else {
						yield { content: 'Done', isComplete: true };
					}
				} else {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{ goal: 'Goal', user_message: 'Planning' },
							'main-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			// Should have recovered from invalid args and continued
			expect(executionAgentCalls).toBeGreaterThan(1);
		});

		it('should handle streaming errors gracefully', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { error: 'API Error', errorType: 'rate_limit', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, false, callbacks);

			// Should have added error to conversation
			const lastMessage = conversation.contents[conversation.contents.length - 1];
			expect(lastMessage.content).toBe('API Error');
			expect(lastMessage.errorType).toBe('rate_limit');
		});
	});

	describe('Save Callback', () => {
		it('should call save callback after each agent loop iteration', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

			const saveCallback = vi.fn().mockResolvedValue(undefined);
			service.setSaveCallback(saveCallback);

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				callCount++;
				if (callCount === 1) {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.SearchVaultFiles,
							{ search_terms: ['test'], user_message: 'Searching' },
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield { content: 'Done', isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, false, callbacks);

			// Save should be called after each response
			expect(saveCallback).toHaveBeenCalledWith(conversation);
			expect(saveCallback.mock.calls.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('Planning Agent', () => {
		it('should handle AskUserQuestionPlanning function call', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Plan task' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn().mockResolvedValue('User preference'),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let planningAgentCalls = 0;
			let executionAgentCalls = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				const toolDefs = mockAI.toolDefinitions;
				const isPlanningAgent = toolDefs.some((t: any) => t.name === AIFunction.SubmitPlan);
				const isExecutionAgent = toolDefs.some((t: any) => t.name === AIFunction.CompleteStep);

				if (isPlanningAgent) {
					planningAgentCalls++;
					if (planningAgentCalls === 1) {
						// Ask user question during planning
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.AskUserQuestionPlanning,
								{ question: 'What approach?', user_message: 'Asking' },
								'ask-1'
							),
							isComplete: true
						};
					} else {
						// Submit plan after getting answer
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.SubmitPlan,
								{ steps: [{ description: 'Step', instruction: 'Do' }] },
								'plan-1'
							),
							isComplete: true
						};
					}
				} else if (isExecutionAgent) {
					executionAgentCalls++;
					if (executionAgentCalls === 1) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 1 },
								'step-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 2) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompletePlan,
								{ confirm_completion: true },
								'complete-1'
							),
							isComplete: true
						};
					} else {
						yield { content: 'Done', isComplete: true };
					}
				} else {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{ goal: 'Task', user_message: 'Starting' },
							'main-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			expect(callbacks.onUserQuestion).toHaveBeenCalledWith('What approach?');
		});

		it('should reject non-planning tools during planning phase', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Plan' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let planningAgentCalls = 0;
			let executionAgentCalls = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				const toolDefs = mockAI.toolDefinitions;
				const isPlanningAgent = toolDefs.some((t: any) => t.name === AIFunction.SubmitPlan);
				const isExecutionAgent = toolDefs.some((t: any) => t.name === AIFunction.CompleteStep);

				if (isPlanningAgent) {
					planningAgentCalls++;
					if (planningAgentCalls === 1) {
						// Try to use execution tool during planning (should be rejected)
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 1 },
								'invalid-1'
							),
							isComplete: true
						};
					} else {
						// Submit valid plan
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.SubmitPlan,
								{ steps: [{ description: 'Step', instruction: 'Do' }] },
								'plan-1'
							),
							isComplete: true
						};
					}
				} else if (isExecutionAgent) {
					executionAgentCalls++;
					if (executionAgentCalls === 1) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompleteStep,
								{ step_number: 1 },
								'step-1'
							),
							isComplete: true
						};
					} else if (executionAgentCalls === 2) {
						yield {
							content: '',
							functionCall: new AIFunctionCall(
								AIFunction.CompletePlan,
								{ confirm_completion: true },
								'complete-1'
							),
							isComplete: true
						};
					} else {
						yield { content: 'Done', isComplete: true };
					}
				} else {
					yield {
						content: '',
						functionCall: new AIFunctionCall(
							AIFunction.CreatePlan,
							{ goal: 'Task', user_message: 'Start' },
							'main-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, true, callbacks);

			// Planning agent should have been called twice (first with invalid tool, then with valid plan)
			expect(planningAgentCalls).toBe(2);
		});
	});

	describe('shouldContinue flag handling', () => {
		it('should continue agent loop when shouldContinue is true', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test continue' }));

			const callbacks = {
				onSubmit: vi.fn(),
				onStreamingUpdate: vi.fn(),
				onThoughtUpdate: vi.fn(),
				onPlanningStarted: vi.fn(),
				onPlanningFinished: vi.fn(),
				onUserQuestion: vi.fn(),
				onPlanUpdate: vi.fn(),
				onPlanStepUpdate: vi.fn(),
				onPlanReset: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn()
			};

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				callCount++;
				if (callCount === 1) {
					// Response with shouldContinue flag
					yield { content: 'Partial response', shouldContinue: true, isComplete: true };
				} else {
					yield { content: ' completed', isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, true, false, callbacks);

			// Should have made 2 calls due to shouldContinue
			expect(callCount).toBe(2);
		});
	});
});

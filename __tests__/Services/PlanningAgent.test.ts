import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlanningAgent } from '../../Services/AIServices/PlanningAgent';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { AITool } from '../../Enums/AITool';
import { AIToolCall } from '../../AIClasses/AIToolCall';
import { AIToolResponse } from '../../AIClasses/ToolDefinitions/AIToolResponse';

/**
 * UNIT TESTS - PlanningAgent
 *
 * Tests the planning agent that:
 * - Creates execution plans via SubmitPlan
 * - Asks user questions during planning
 * - Enforces tool restrictions (only planning tools allowed)
 * - Handles replan vs initial plan scenarios
 * - Respects max depth limits
 */

describe('PlanningAgent - Unit Tests', () => {
	let service: PlanningAgent;
	let mockAI: any;
	let mockPrompt: any;
	let mockAIToolService: any;

	const createMockCallbacks = () => ({
		onSubmit: vi.fn(),
		onStreamingUpdate: vi.fn(),
		onThoughtUpdate: vi.fn(),
		onToolCallStarted: vi.fn(),
		onPlanningStarted: vi.fn(),
		onPlanningFinished: vi.fn(),
		onUserQuestion: vi.fn().mockResolvedValue('User answer'),
		onPlanUpdate: vi.fn(),
		onPlanStepUpdate: vi.fn(),
		onPlanReset: vi.fn(),
		onComplete: vi.fn(),
		onCancel: vi.fn()
	});

	beforeEach(() => {
		// Mock IPrompt
		mockPrompt = {
			systemInstruction: vi.fn().mockReturnValue('System instruction'),
			userInstruction: vi.fn().mockResolvedValue('User instruction'),
			planningInstruction: vi.fn().mockReturnValue('Planning instruction')
		};
		RegisterSingleton(Services.IPrompt, mockPrompt);

		// Mock AIToolService
		mockAIToolService = {
			performAITool: vi.fn().mockResolvedValue(
				new AIToolResponse(AITool.SearchVaultFiles, { results: [] }, 'test-tool-id')
			)
		};
		RegisterSingleton(Services.AIToolService, mockAIToolService);

		// Mock IAIClass
		mockAI = {
			systemPrompt: '',
			userInstruction: '',
			toolDefinitions: [],
			agentType: undefined,
			streamRequest: vi.fn()
		};
		RegisterSingleton(Services.IAIClass, mockAI);

		// Create service
		service = new PlanningAgent();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('SubmitPlan - Valid plan submission', () => {
		it('should submit a valid plan with multiple steps', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create a plan to organize notes'
			}));

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Creating plan',
					toolCall: new AIToolCall(
						AITool.SubmitPlan,
						{
							steps: [
								{
									description: 'Search for notes',
									instruction: 'Search the vault for all notes'
								},
								{
									description: 'Categorize notes',
									instruction: 'Organize notes by topic'
								},
								{
									description: 'Create index',
									instruction: 'Create an index file'
								}
							],
							user_message: 'Plan created'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(result).toBeDefined();
			expect(result?.executionSteps).toHaveLength(3);
			expect(result?.isReplan).toBe(false);
			expect(result?.executionSteps[0].description).toBe('Search for notes');
			expect(result?.executionSteps[1].description).toBe('Categorize notes');
			expect(result?.executionSteps[2].description).toBe('Create index');
		});

		it('should submit a plan with single step', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Simple task'
			}));

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Plan',
					toolCall: new AIToolCall(
						AITool.SubmitPlan,
						{
							steps: [
								{
									description: 'Complete task',
									instruction: 'Do the single task'
								}
							]
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(result).toBeDefined();
			expect(result?.executionSteps).toHaveLength(1);
		});

		it('should mark plan as replan when isReplan is true', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Previous plan failed, create new plan'
			}));

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Replan',
					toolCall: new AIToolCall(
						AITool.SubmitPlan,
						{
							steps: [
								{
									description: 'Revised approach',
									instruction: 'New strategy'
								}
							]
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, true);

			expect(result).toBeDefined();
			expect(result?.isReplan).toBe(true);
		});
	});

	describe('SubmitPlan validation', () => {
		it('should reject invalid plan structure', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// Invalid: missing required fields
					yield {
						content: 'Invalid plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										// Missing instruction
										description: 'Incomplete step'
									}
								]
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					// Valid plan
					yield {
						content: 'Valid plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Complete step',
										instruction: 'Full instruction'
									}
								]
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(result).toBeDefined();
			expect(attemptCount).toBeGreaterThan(1);
		});

		it('should retry when no plan is submitted', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// No plan submitted
					yield {
						content: 'Thinking about the plan...',
						isComplete: true
					};
				} else {
					// Submit plan on retry
					yield {
						content: 'Plan ready',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Step 1',
										instruction: 'Instruction 1'
									}
								]
							},
							'tool-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(result).toBeDefined();
			expect(attemptCount).toBe(2);
		});
	});

	describe('AskUserQuestionPlanning', () => {
		it('should ask user question during planning', async () => {
			const callbacks = createMockCallbacks();
			callbacks.onUserQuestion.mockResolvedValue('Notes about AI');

			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Search for relevant notes'
			}));

			let toolCallCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				toolCallCount++;
				if (toolCallCount === 1) {
					// Ask user question
					yield {
						content: 'Question',
						toolCall: new AIToolCall(
							AITool.AskUserQuestionPlanning,
							{
								question: 'What topic should I search for?',
								user_message: 'Asking user for clarification'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					// Submit plan with user's answer incorporated
					yield {
						content: 'Plan with answer',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Search for AI notes',
										instruction: 'Search for notes about AI'
									}
								]
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(callbacks.onUserQuestion).toHaveBeenCalledWith('What topic should I search for?');
			expect(result).toBeDefined();
			expect(toolCallCount).toBe(2);
		});

		it('should handle multiple user questions in planning', async () => {
			const callbacks = createMockCallbacks();
			callbacks.onUserQuestion
				.mockResolvedValueOnce('markdown')
				.mockResolvedValueOnce('daily notes');

			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Organize files'
			}));

			let toolCallCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				toolCallCount++;
				if (toolCallCount === 1) {
					yield {
						content: 'Q1',
						toolCall: new AIToolCall(
							AITool.AskUserQuestionPlanning,
							{
								question: 'What file type?',
								user_message: 'Asking about file type'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else if (toolCallCount === 2) {
					yield {
						content: 'Q2',
						toolCall: new AIToolCall(
							AITool.AskUserQuestionPlanning,
							{
								question: 'Which folder?',
								user_message: 'Asking about folder'
							},
							'tool-2'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Organize markdown files in daily notes',
										instruction: 'Process files'
									}
								]
							},
							'tool-3'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(callbacks.onUserQuestion).toHaveBeenCalledTimes(2);
			expect(result).toBeDefined();
		});

		it('should reject invalid AskUserQuestionPlanning arguments', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// Invalid: missing question
					yield {
						content: 'Invalid',
						toolCall: new AIToolCall(
							AITool.AskUserQuestionPlanning,
							{
								// Missing question field
								user_message: 'Message'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					// Valid plan
					yield {
						content: 'Plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Step',
										instruction: 'Instruction'
									}
								]
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runPlanningAgent(conversation, callbacks, false);

			expect(attemptCount).toBeGreaterThan(1);
		});
	});

	describe('Tool restrictions', () => {
		it('should allow planning tools (SearchVaultFiles)', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Plan to find files'
			}));

			let searchCalled = false;

			mockAI.streamRequest.mockImplementation(async function* () {
				if (!searchCalled) {
					searchCalled = true;
					yield {
						content: 'Searching',
						toolCall: new AIToolCall(
							AITool.SearchVaultFiles,
							{
								search_terms: ['test'],
								user_message: 'Searching'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Process files',
										instruction: 'Process found files'
									}
								]
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(mockAIToolService.performAITool).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it('should allow planning tools (ReadVaultFiles)', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Plan based on file content'
			}));

			let readCalled = false;

			mockAI.streamRequest.mockImplementation(async function* () {
				if (!readCalled) {
					readCalled = true;
					yield {
						content: 'Reading',
						toolCall: new AIToolCall(
							AITool.ReadVaultFiles,
							{
								file_paths: ['test.md'],
								user_message: 'Reading'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Update file',
										instruction: 'Update based on content'
									}
								]
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(mockAIToolService.performAITool).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it('should deny destructive tools (WriteVaultFile)', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// Try to write file (not allowed in planning)
					yield {
						content: 'Writing',
						toolCall: new AIToolCall(
							AITool.WriteVaultFile,
							{
								file_path: 'test.md',
								content: 'content'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					// Submit valid plan
					yield {
						content: 'Plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Write file',
										instruction: 'Write file in execution'
									}
								]
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			// WriteVaultFile should be denied, not executed
			expect(mockAIToolService.performAITool).not.toHaveBeenCalledWith(
				expect.objectContaining({ name: AITool.WriteVaultFile })
			);
			expect(result).toBeDefined();
			expect(attemptCount).toBeGreaterThan(1);
		});

		it('should deny execution tools (CompleteTask)', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// Try to complete task (execution agent tool)
					yield {
						content: 'Completing',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Done'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Step',
										instruction: 'Instruction'
									}
								]
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runPlanningAgent(conversation, callbacks, false);

			expect(attemptCount).toBeGreaterThan(1);
		});

		it('should deny orchestration tools (CompleteStep)', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// Try to complete step (orchestration agent tool)
					yield {
						content: 'Completing',
						toolCall: new AIToolCall(
							AITool.CompleteStep,
							{
								confirm_completion: true
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Step',
										instruction: 'Instruction'
									}
								]
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runPlanningAgent(conversation, callbacks, false);

			expect(attemptCount).toBeGreaterThan(1);
		});
	});

	describe('Max depth protection', () => {
		it('should return undefined when max planning depth is exceeded', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				// Never submit a plan, forcing retries
				yield {
					content: 'Still thinking...',
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(result).toBeUndefined();
			expect(attemptCount).toBe(3); // MAX_AGENT_DEPTH
		});

		it('should track depth across retries', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount < 3) {
					// No plan on first two attempts
					yield {
						content: 'Working on it',
						isComplete: true
					};
				} else {
					// Submit plan on third attempt (just before max depth)
					yield {
						content: 'Plan',
						toolCall: new AIToolCall(
							AITool.SubmitPlan,
							{
								steps: [
									{
										description: 'Final step',
										instruction: 'Final instruction'
									}
								]
							},
							'tool-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(result).toBeDefined();
			expect(attemptCount).toBe(3);
		});
	});

	describe('Empty plan handling', () => {
		it('should accept empty steps array as valid plan', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));

			mockAI.streamRequest.mockImplementation(async function* () {
				// Empty plan is valid according to schema
				yield {
					content: 'Empty plan',
					toolCall: new AIToolCall(
						AITool.SubmitPlan,
						{
							steps: []
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			// Empty plan should be accepted
			expect(result).toBeDefined();
			expect(result?.executionSteps).toEqual([]);
		});
	});

	describe('Conversation structure', () => {
		it('should maintain conversation across retries', async () => {
			const callbacks = createMockCallbacks();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Initial request'
			}));

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// No plan
					yield {
						content: 'Need more info',
						isComplete: true
					};
				} else {
					// Check that retry message was added
					const lastUserMessage = conversation.contents
						.filter(c => c.role === Role.User)
						.pop();
					const hasRetryMessage = lastUserMessage?.content?.includes('submit');

					if (hasRetryMessage) {
						yield {
							content: 'Plan',
							toolCall: new AIToolCall(
								AITool.SubmitPlan,
								{
									steps: [
										{
											description: 'Step',
											instruction: 'Instruction'
										}
									]
								},
								'tool-1'
							),
							isComplete: true
						};
					}
				}
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks, false);

			expect(result).toBeDefined();
			expect(conversation.contents.length).toBeGreaterThan(1);
		});
	});
});

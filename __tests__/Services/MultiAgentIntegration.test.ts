import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MainAgent } from '../../Services/AIServices/MainAgent';
import { PlanningAgent } from '../../Services/AIServices/PlanningAgent';
import { ExecutionAgent } from '../../Services/AIServices/ExecutionAgent';
import { OrchestrationAgent } from '../../Services/AIServices/OrchestrationAgent';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { AITool } from '../../Enums/AITool';
import { AIToolCall } from '../../AIClasses/AIToolCall';
import { AIToolResponse } from '../../AIClasses/ToolDefinitions/AIToolResponse';
import { AIToolResponsePayload } from '../../AIClasses/ToolDefinitions/AIToolResponsePayload';
import type { ExecutionStep } from '../../Types/ExecutionStep';
import { ChatMode } from '../../Enums/ChatMode';

/**
 * INTEGRATION TESTS - Multi-Agent Architecture
 *
 * Tests the multi-agent components independently:
 * - MainAgent initialization and setup
 * - PlanningAgent plan creation
 * - ExecutionAgent step execution
 * - OrchestrationAgent setup
 *
 * Note: Full end-to-end workflow tests would require extensive mocking of nested
 * agent instantiation, which is not practical given the current architecture.
 * These tests verify that each agent can be initialized and has the correct interface.
 */

describe('Multi-Agent Integration Tests', () => {
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
		onPlanApprovalRequest: vi.fn(),
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
			planningInstruction: vi.fn().mockResolvedValue('Planning instruction'),
			orchestrationInstruction: vi.fn().mockResolvedValue('Orchestration instruction'),
			executionInstruction: vi.fn().mockReturnValue('Execution instruction')
		};
		RegisterSingleton(Services.IPrompt, mockPrompt);

		// Mock AIToolService
		mockAIToolService = {
			performAITool: vi.fn().mockResolvedValue(
				new AIToolResponse(AITool.SearchVaultFiles, new AIToolResponsePayload({ results: ['file1.md', 'file2.md'] }), 'test-tool-id')
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

		// Mock SettingsService
		RegisterSingleton(Services.SettingsService, {
			settings: { enableMemories: false, allowUpdatingMemories: false }
		});
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('MainAgent Integration', () => {
		it('should initialize MainAgent with all services', () => {
			const service = new MainAgent();
			expect(service).toBeDefined();
			expect(service.runMainAgent).toBeDefined();
		});

		it('should resolve AI provider', () => {
			const service = new MainAgent();
			service.resolveAIProvider();
			expect(service).toBeDefined();
		});

		it('should throw error if running without resolved provider', async () => {
			const service = new MainAgent();
			const conversation = new Conversation();
			const callbacks = createMockCallbacks();

			await expect(service.runMainAgent(conversation, ChatMode.Edit, callbacks))
				.rejects.toThrow('Error: No AI provider has been set!');
		});
	});

	describe('PlanningAgent Integration', () => {
		it('should initialize PlanningAgent', () => {
			const service = new PlanningAgent();
			expect(service).toBeDefined();
			expect(service.runPlanningAgent).toBeDefined();
		});

		it('should create a simple plan', async () => {
			const service = new PlanningAgent();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create a plan'
			}));
			const callbacks = createMockCallbacks();

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Plan',
					toolCall: new AIToolCall(
						AITool.SubmitPlan,
						{
							steps: [
								{
									description: 'Test step',
									instruction: 'Test instruction'
								}
							]
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks);

			expect(result).toBeDefined();
			expect(result?.executionSteps).toHaveLength(1);
		});
	});

	describe('ExecutionAgent Integration', () => {
		it('should initialize ExecutionAgent', () => {
			const service = new ExecutionAgent();
			expect(service).toBeDefined();
			expect(service.runExecutionAgent).toBeDefined();
		});

		it('should execute a step successfully', async () => {
			const service = new ExecutionAgent();
			const step: ExecutionStep = {
				description: 'Test step',
				instruction: 'Do something'
			};
			const callbacks = createMockCallbacks();

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Done',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: true,
							description: 'Task completed'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(true);
			expect(result?.description).toBe('Task completed');
		});

		it('should handle step failure', async () => {
			const service = new ExecutionAgent();
			const step: ExecutionStep = {
				description: 'Test step',
				instruction: 'Do something'
			};
			const callbacks = createMockCallbacks();

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Failed',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: false,
							description: 'Task failed'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(false);
			expect(result?.description).toBe('Task failed');
		});

		it('should include context in execution', async () => {
			const service = new ExecutionAgent();
			const step: ExecutionStep = {
				description: 'Test step',
				instruction: 'Process data',
				context: 'Previous result: 42'
			};
			const callbacks = createMockCallbacks();

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Done',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: true,
							description: 'Processed with context',
							context: 'Used previous result'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(true);
			expect(result?.context).toContain('Used previous result');
		});
	});

	describe('OrchestrationAgent Integration', () => {
		it('should initialize OrchestrationAgent', () => {
			const service = new OrchestrationAgent();
			expect(service).toBeDefined();
			expect(service.runPlannedWorkflow).toBeDefined();
		});

		it('should have correct method interface', () => {
			const service = new OrchestrationAgent();
			expect(typeof service.runPlannedWorkflow).toBe('function');
		});
	});

	describe('Agent Depth Limits', () => {
		it('PlanningAgent should respect max depth', async () => {
			const service = new PlanningAgent();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Create plan'
			}));
			const callbacks = createMockCallbacks();

			let attemptCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				// Never submit plan, force retries
				yield {
					content: 'Still thinking...',
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runPlanningAgent(conversation, callbacks);

			// Should return undefined after max depth
			expect(result).toBeUndefined();
			expect(attemptCount).toBe(3); // MAX_AGENT_DEPTH
		});

		it('ExecutionAgent should respect max depth', async () => {
			const service = new ExecutionAgent();
			const step: ExecutionStep = {
				description: 'Test step',
				instruction: 'Do something'
			};
			const callbacks = createMockCallbacks();

			let attemptCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				// Never complete task, force retries
				yield {
					content: 'Still working...',
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			// Should return undefined after max depth
			expect(result).toBeUndefined();
			expect(attemptCount).toBe(3); // MAX_AGENT_DEPTH
		});
	});

	describe('Agent Interoperability', () => {
		it('should allow PlanningAgent and ExecutionAgent to run independently', async () => {
			const planningAgent = new PlanningAgent();
			const executionAgent = new ExecutionAgent();

			expect(planningAgent).toBeDefined();
			expect(executionAgent).toBeDefined();
			expect(planningAgent).not.toBe(executionAgent);
		});

		it('should create independent conversation contexts', () => {
			const conversation1 = new Conversation();
			const conversation2 = new Conversation();

			conversation1.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Request 1'
			}));

			conversation2.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Request 2'
			}));

			expect(conversation1.contents).toHaveLength(1);
			expect(conversation2.contents).toHaveLength(1);
			expect(conversation1.contents[0].content).not.toBe(conversation2.contents[0].content);
		});
	});

	describe('Agent Tool Restrictions', () => {
		it('should allow PlanningAgent to use read-only tools', async () => {
			const service = new PlanningAgent();
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({
				role: Role.User,
				content: 'Plan based on vault content'
			}));
			const callbacks = createMockCallbacks();

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
			const result = await service.runPlanningAgent(conversation, callbacks);

			expect(mockAIToolService.performAITool).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it('should allow ExecutionAgent to use all vault tools', async () => {
			const service = new ExecutionAgent();
			const step: ExecutionStep = {
				description: 'Search and process',
				instruction: 'Find and read files'
			};
			const callbacks = createMockCallbacks();

			let toolCallCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				toolCallCount++;
				if (toolCallCount === 1) {
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
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Found and processed files'
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(mockAIToolService.performAITool).toHaveBeenCalled();
			expect(result?.success).toBe(true);
		});
	});
});

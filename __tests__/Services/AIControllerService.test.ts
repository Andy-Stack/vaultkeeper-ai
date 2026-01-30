import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MainAgent } from '../../Services/AIServices/MainAgent';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { AITool } from '../../Enums/AITool';
import { AIToolCall } from '../../AIClasses/AIToolCall';
import { AIToolResponse } from '../../AIClasses/FunctionDefinitions/AIToolResponse';

/**
 * INTEGRATION TESTS - AIControllerService
 *
 * Tests the multi-agent controller service that orchestrates:
 * - Main agent execution
 * - Orchestration agent workflow
 * - Planning agent workflow
 * - Execution agent workflow
 * - Agent loop management
 */

describe('AIControllerService - Integration Tests', () => {
	let service: MainAgent;
	let mockAI: any;
	let mockPrompt: any;
	let mockAIToolService: any;

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
		service = new MainAgent();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with all required services', () => {
			const testService = new MainAgent();

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
						functionCall: new AIToolCall(
							AITool.SearchVaultFiles,
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
			expect(mockAIToolService.performAITool).toHaveBeenCalledTimes(1);
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
						functionCall: new AIToolCall(
							AITool.SearchVaultFiles,
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
						functionCall: new AIToolCall(
							AITool.SearchVaultFiles,
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
});

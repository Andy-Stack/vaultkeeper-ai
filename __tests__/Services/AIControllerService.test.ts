import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIControllerService } from '../../Services/AIControllerService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { AIFunction } from '../../Enums/AIFunction';

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
	let service: AIControllerService;
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
			performAIFunction: vi.fn().mockResolvedValue({
				name: AIFunction.SearchVaultFiles,
				response: [],
				toolId: 'test-tool-id'
			})
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
		service = new AIControllerService();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with all required services', () => {
			const testService = new AIControllerService();

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
				onPlanComplete: vi.fn(),
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
				onPlanComplete: vi.fn(),
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
				onPlanComplete: vi.fn(),
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
				onPlanComplete: vi.fn(),
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
});

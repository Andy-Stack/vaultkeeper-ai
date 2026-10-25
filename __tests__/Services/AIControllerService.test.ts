import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MainAgent } from '../../Services/AIServices/MainAgent';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { AITool } from '../../Enums/AITool';
import { AIToolCall } from '../../AIClasses/AIToolCall';
import { AIToolResponse } from '../../AIClasses/ToolDefinitions/AIToolResponse';
import { AIToolResponsePayload } from '../../AIClasses/ToolDefinitions/AIToolResponsePayload';
import { ChatMode } from '../../Enums/ChatMode';
import { AIProvider } from '../../Enums/ApiProvider';

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

	const callbacks = {
		onSubmit: vi.fn(),
		onStreamingUpdate: vi.fn(),
		onToolCallStarted: vi.fn(),
		onThought: vi.fn(),
		onArtifactProduced: vi.fn(),
		onPlanningStarted: vi.fn(),
		onPlanningFinished: vi.fn(),
		onUserQuestion: vi.fn(),
		onPlanApprovalRequest: vi.fn(),
		onPlanUpdate: vi.fn(),
		onPlanStepUpdate: vi.fn(),
		onPlanReset: vi.fn(),
		onComplete: vi.fn()
	};

	beforeEach(() => {
		// Mock IPrompt
		mockPrompt = {
			systemInstruction: vi.fn().mockReturnValue('System instruction'),
			userInstruction: vi.fn().mockResolvedValue('User instruction'),
			planningInstruction: vi.fn().mockResolvedValue('Planning instruction')
		};
		RegisterSingleton(Services.IPrompt, mockPrompt);

		// Mock AIToolService
		mockAIToolService = {
			performAITool: vi.fn().mockResolvedValue([
				new AIToolResponse(AITool.SearchVaultFiles, new AIToolResponsePayload({ results: [] }), 'test-tool-id')
			])
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

			// Mock streamRequest to return immediately without function calls
			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: 'Response', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			// Verify system prompt and user instruction were set
			expect(mockPrompt.systemInstruction).toHaveBeenCalled();
			expect(mockPrompt.userInstruction).toHaveBeenCalled();
		});

		it('should handle streaming response without function calls', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test request' }));

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: 'Part 1', isComplete: false };
				yield { content: ' Part 2', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			// Should have added assistant message to conversation
			expect(conversation.contents.length).toBeGreaterThan(1);
			const lastMessage = conversation.contents[conversation.contents.length - 1];
			expect(lastMessage.role).toBe(Role.Assistant);
			expect(lastMessage.content).toContain('Part 1');
		});

		it('should throw error if AI provider not resolved', async () => {
			const conversation = new Conversation();
			// Don't call resolveAIProvider()
			await expect(service.runMainAgent(conversation, ChatMode.Edit, callbacks))
				.rejects.toThrow('Error: No AI provider has been set!');
		});

		it('should handle function calls and continue the loop', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Search for notes' }));

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				callCount++;
				if (callCount === 1) {
					// First call returns a function call
					yield {
						content: 'Let me search',
						toolCalls: [new AIToolCall(
							AITool.SearchVaultFiles,
							{ search_terms: ['test'], user_message: 'Searching' },
							'tool-1'
						)],
						isComplete: true
					};
				} else {
					// Second call returns final response
					yield { content: 'Found results', isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			// Verify function was called
			expect(mockAIToolService.performAITool).toHaveBeenCalledTimes(1);
			expect(callCount).toBe(2);
		});

		it('should notify the tool call started callback when a tool call begins streaming', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Search' }));

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: '', toolCallStarted: AITool.SearchVaultFiles, isComplete: false };
				yield { content: 'Done', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			expect(callbacks.onToolCallStarted).toHaveBeenCalledWith(AITool.SearchVaultFiles);
		});

		it('should report thought deltas and store completed thoughts apart from the content', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Think first' }));
			const completedThought = { provider: AIProvider.Claude, text: 'Considering' };

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: '', thought: 'Considering', isComplete: false };
				yield { content: '', completedThought, isComplete: false };
				yield { content: 'Answer', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			const assistantContent = conversation.contents.find(content => content.role === Role.Assistant)!;
			expect(callbacks.onThought).toHaveBeenCalledWith('Considering');
			expect(assistantContent.content).toBe('Answer');
			expect(JSON.parse(assistantContent.thoughts!)).toEqual([completedThought]);
		});

		it('should store the provider\'s blocks only for a turn that completes', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Hello' }));
			mockAI.currentProvider = AIProvider.Claude;

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: 'Hi', providerBlocks: [{ type: 'text', text: 'Hi' }], isComplete: false };
				yield { content: '', providerBlocks: [{ type: 'thinking', thinking: '', signature: 'sig' }], isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			const assistantContent = conversation.contents.find(content => content.role === Role.Assistant)!;
			expect(JSON.parse(assistantContent.providerContent!)).toEqual({
				provider: AIProvider.Claude,
				blocks: [{ type: 'text', text: 'Hi' }, { type: 'thinking', thinking: '', signature: 'sig' }]
			});
		});

		it('should not store provider blocks for a turn that never completes', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Hello' }));

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: 'Partial', providerBlocks: [{ type: 'text', text: 'Partial' }], isComplete: false };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			const assistantContent = conversation.contents.find(content => content.role === Role.Assistant)!;
			expect(assistantContent.content).toBe('Partial');
			expect(assistantContent.providerContent).toBeUndefined();
		});

		it('should resume a paused turn by sending it back without a continue message', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Latest news?' }));
			mockAI.currentProvider = AIProvider.Claude;
			const sentContents: ConversationContent[][] = [];

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* (sentConversation: Conversation) {
				sentContents.push([...sentConversation.contents]);
				callCount++;
				if (callCount === 1) {
					yield { content: '', providerBlocks: [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} }], isPaused: true, isComplete: true };
				} else {
					yield { content: 'Here is the news', providerBlocks: [{ type: 'text', text: 'Here is the news' }], isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			expect(callCount).toBe(2);
			const [, pausedTurn, continuation] = conversation.contents;
			expect(conversation.contents).toHaveLength(3);
			expect(pausedTurn.providerContent).toBeDefined();
			expect(pausedTurn.shouldDisplayContent).toBe(false);
			expect(continuation.content).toBe('Here is the news');
			// The paused turn was the last message the resume request was built from
			expect(sentContents[1].slice(0, -1).at(-1)).toBe(pausedTurn);
		});

		it('should stop resuming a turn that keeps pausing', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Latest news?' }));
			mockAI.currentProvider = AIProvider.Claude;

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: '', providerBlocks: [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} }], isPaused: true, isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			// The first request plus five resumes
			expect(mockAI.streamRequest).toHaveBeenCalledTimes(6);
		});

		it('should only remove an empty turn once when completion is signalled twice', async () => {
			const conversation = new Conversation();
			const userMessage = new ConversationContent({ role: Role.User, content: 'Hello' });
			conversation.contents.push(userMessage);

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { content: '', isComplete: true };
				yield { content: '', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			expect(conversation.contents).toEqual([userMessage]);
		});

		it('should handle streaming errors gracefully', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

			mockAI.streamRequest.mockImplementation(async function* () {
				yield { error: 'API Error', errorType: 'rate_limit', isComplete: true };
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			// Should have added error to conversation
			const lastMessage = conversation.contents[conversation.contents.length - 1];
			expect(lastMessage.content).toBe('API Error');
			expect(lastMessage.errorType).toBe('rate_limit');
		});

		it('should continue agent loop when shouldContinue is true', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test continue' }));

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
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

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

			let callCount = 0;
			mockAI.streamRequest.mockImplementation(async function* () {
				callCount++;
				if (callCount === 1) {
					yield {
						content: '',
						toolCalls: [new AIToolCall(
							AITool.SearchVaultFiles,
							{ search_terms: ['test'], user_message: 'Searching' },
							'tool-1'
						)],
						isComplete: true
					};
				} else {
					yield { content: 'Done', isComplete: true };
				}
			});

			service.resolveAIProvider();
			await service.runMainAgent(conversation, ChatMode.Edit, callbacks);

			// Save should be called after each response
			expect(saveCallback).toHaveBeenCalledWith(conversation);
			expect(saveCallback.mock.calls.length).toBeGreaterThanOrEqual(2);
		});
	});
});

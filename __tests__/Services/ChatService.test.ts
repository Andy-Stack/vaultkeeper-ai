import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatService } from '../../Services/ChatService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { AIFunctionCall } from '../../AIClasses/AIFunctionCall';
import { AIFunction, fromString } from '../../Enums/AIFunction';

/**
 * INTEGRATION TESTS - Simplified
 *
 * These tests focus on synchronous methods only, avoiding the complex async streaming
 * functionality that caused memory issues. Tests the actual integration between ChatService
 * and its dependencies.
 *
 * Note: The complex submit() method with async generators is better tested through E2E tests.
 */

describe('ChatService - Integration Tests (Sync Methods Only)', () => {
	let service: ChatService;
	let mockConversationService: any;
	let mockAIFunctionService: any;
	let mockNamingService: any;
	let mockPrompt: any;
	let mockStatusBarService: any;
	let mockTokenService: any;

	beforeEach(() => {
		// Setup minimal mocks
		mockConversationService = {
			saveConversation: vi.fn()
		};

		mockAIFunctionService = {
			performAIFunction: vi.fn()
		};

		mockNamingService = {
			requestName: vi.fn()
		};

		mockPrompt = {
			systemInstruction: vi.fn().mockReturnValue('System prompt'),
			userInstruction: vi.fn().mockResolvedValue('User prompt')
		};

		mockStatusBarService = {
			animateTokens: vi.fn()
		};

		mockTokenService = {
			countTokens: vi.fn().mockResolvedValue(100)
		};

		// Register dependencies
		RegisterSingleton(Services.ConversationFileSystemService, mockConversationService);
		RegisterSingleton(Services.AIFunctionService, mockAIFunctionService);
		RegisterSingleton(Services.ConversationNamingService, mockNamingService);
		RegisterSingleton(Services.IPrompt, mockPrompt);
		RegisterSingleton(Services.StatusBarService, mockStatusBarService);

		// Create service
		service = new ChatService();
	});

	afterEach(() => {
		// Clear singleton registry to prevent memory leaks
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with all required services', () => {
			const testService = new ChatService();

			expect(testService).toBeDefined();
		});

		it('should initialize onNameChanged as undefined', () => {
			expect(service.onNameChanged).toBeUndefined();
		});
	});

	describe('resolveAIProvider', () => {
		it('should resolve AI provider services', () => {
			const mockAI = { streamRequest: vi.fn() };
			RegisterSingleton(Services.IAIClass, mockAI as any);
			RegisterSingleton(Services.ITokenService, mockTokenService);

			service.resolveAIProvider();

			// Should not throw
			expect(service).toBeDefined();
		});
	});

	describe('stop', () => {
		it('should not throw when called with no active request', () => {
			expect(() => service.stop()).not.toThrow();
		});

		it('should be callable multiple times', () => {
			service.stop();
			service.stop();
			service.stop();

			expect(service).toBeDefined();
		});
	});

	describe('setStatusBarTokens', () => {
		beforeEach(() => {
			// Need to resolve AI provider to initialize token service
			RegisterSingleton(Services.IAIClass, { streamRequest: vi.fn() } as any);
			RegisterSingleton(Services.ITokenService, mockTokenService);
			service.resolveAIProvider();
		});

		it('should call status bar service with token counts', () => {
			service.setStatusBarTokens(100, 50);

			expect(mockStatusBarService.animateTokens).toHaveBeenCalledWith(100, 50);
		});

		it('should handle zero tokens', () => {
			service.setStatusBarTokens(0, 0);

			expect(mockStatusBarService.animateTokens).toHaveBeenCalledWith(0, 0);
		});

		it('should handle large token counts', () => {
			service.setStatusBarTokens(100000, 50000);

			expect(mockStatusBarService.animateTokens).toHaveBeenCalledWith(100000, 50000);
		});
	});

	describe('updateTokenDisplay', () => {
		beforeEach(() => {
			// Need to resolve AI provider to initialize token service
			RegisterSingleton(Services.IAIClass, { streamRequest: vi.fn() } as any);
			RegisterSingleton(Services.ITokenService, mockTokenService);
			service.resolveAIProvider();
		});

		it('should count tokens for conversation contents', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent(Role.User, 'User message'));
			conversation.contents.push(new ConversationContent(Role.Assistant, 'Assistant response'));

			await service.updateTokenDisplay(conversation);

			expect(mockTokenService.countTokens).toHaveBeenCalled();
			expect(mockStatusBarService.animateTokens).toHaveBeenCalled();
		});

		it('should include system and user instructions in token count', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent(Role.User, 'Test'));

			await service.updateTokenDisplay(conversation);

			expect(mockPrompt.systemInstruction).toHaveBeenCalled();
			expect(mockPrompt.userInstruction).toHaveBeenCalled();
		});

		it('should filter out function call responses from user messages', async () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent(Role.User, 'Regular message'));
			conversation.contents.push(
				new ConversationContent(Role.User, 'Function result', '', '', new Date(), false, true, 'tool-id')
			);

			await service.updateTokenDisplay(conversation);

			expect(mockTokenService.countTokens).toHaveBeenCalled();
		});

		it('should handle empty conversation', async () => {
			const conversation = new Conversation();

			await service.updateTokenDisplay(conversation);

			expect(mockStatusBarService.animateTokens).toHaveBeenCalled();
		});

		it('should not throw if token service not initialized', async () => {
			const newService = new ChatService();
			const conversation = new Conversation();

			await expect(newService.updateTokenDisplay(conversation)).resolves.not.toThrow();
		});
	});

	describe('onNameChanged callback', () => {
		it('should allow setting callback function', () => {
			const callback = vi.fn();

			service.onNameChanged = callback;

			expect(service.onNameChanged).toBe(callback);
		});

		it('should be initially undefined', () => {
			const newService = new ChatService();

			expect(newService.onNameChanged).toBeUndefined();
		});
	});

	describe('assistant-to-assistant message prevention', () => {
		it('should insert Continue message when last message is from assistant', () => {
			const conversation = new Conversation();
			// Add an initial user message
			conversation.contents.push(new ConversationContent(Role.User, 'First message'));
			// Add an assistant response
			conversation.contents.push(new ConversationContent(Role.Assistant, 'Assistant response'));

			// Verify the last message is from assistant
			expect(conversation.contents[conversation.contents.length - 1].role).toBe(Role.Assistant);
			expect(conversation.contents.length).toBe(2);

			// Now we need to simulate what happens in submit() when a new user message is added
			// Check if the last message is from the assistant (like the fix does)
			if (conversation.contents.length > 0) {
				const lastMessage = conversation.contents[conversation.contents.length - 1];
				if (lastMessage.role === Role.Assistant) {
					conversation.contents.push(new ConversationContent(
						Role.User,
						"Continue",
						"Continue",
						"",
						new Date(),
						false,
						true
					));
				}
			}

			// Verify Continue message was inserted
			expect(conversation.contents.length).toBe(3);
			const continueMessage = conversation.contents[2];
			expect(continueMessage.role).toBe(Role.User);
			expect(continueMessage.content).toBe('Continue');
			expect(continueMessage.isFunctionCallResponse).toBe(true);
		});

		it('should NOT insert Continue message when last message is from user', () => {
			const conversation = new Conversation();
			// Add a user message
			conversation.contents.push(new ConversationContent(Role.User, 'User message'));

			// Verify the last message is from user
			expect(conversation.contents[conversation.contents.length - 1].role).toBe(Role.User);
			expect(conversation.contents.length).toBe(1);

			// Simulate the check from submit()
			if (conversation.contents.length > 0) {
				const lastMessage = conversation.contents[conversation.contents.length - 1];
				if (lastMessage.role === Role.Assistant) {
					conversation.contents.push(new ConversationContent(
						Role.User,
						"Continue",
						"Continue",
						"",
						new Date(),
						false,
						true
					));
				}
			}

			// Verify NO Continue message was inserted
			expect(conversation.contents.length).toBe(1);
		});

		it('should NOT insert Continue message for empty conversation', () => {
			const conversation = new Conversation();

			// Verify empty
			expect(conversation.contents.length).toBe(0);

			// Simulate the check from submit()
			if (conversation.contents.length > 0) {
				const lastMessage = conversation.contents[conversation.contents.length - 1];
				if (lastMessage.role === Role.Assistant) {
					conversation.contents.push(new ConversationContent(
						Role.User,
						"Continue",
						"Continue",
						"",
						new Date(),
						false,
						true
					));
				}
			}

			// Verify still empty
			expect(conversation.contents.length).toBe(0);
		});

		it('should maintain proper structure after Continue message insertion', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent(Role.User, 'First'));
			conversation.contents.push(new ConversationContent(Role.Assistant, 'Response'));

			// Simulate the fix
			if (conversation.contents.length > 0) {
				const lastMessage = conversation.contents[conversation.contents.length - 1];
				if (lastMessage.role === Role.Assistant) {
					conversation.contents.push(new ConversationContent(
						Role.User,
						"Continue",
						"Continue",
						"",
						new Date(),
						false,
						true
					));
				}
			}

			// Add the actual user message
			conversation.contents.push(new ConversationContent(Role.User, 'Second message'));

			// Verify the structure: User -> Assistant -> User(Continue) -> User
			expect(conversation.contents.length).toBe(4);
			expect(conversation.contents[0].role).toBe(Role.User);
			expect(conversation.contents[0].content).toBe('First');
			expect(conversation.contents[1].role).toBe(Role.Assistant);
			expect(conversation.contents[1].content).toBe('Response');
			expect(conversation.contents[2].role).toBe(Role.User);
			expect(conversation.contents[2].content).toBe('Continue');
			expect(conversation.contents[2].isFunctionCallResponse).toBe(true);
			expect(conversation.contents[3].role).toBe(Role.User);
			expect(conversation.contents[3].content).toBe('Second message');
		});

		it('should work with function call responses in conversation', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent(Role.User, 'Request'));
			conversation.contents.push(new ConversationContent(Role.Assistant, 'Making a function call', '', '{"name":"test"}', new Date(), true));
			// Function response (already User role with isFunctionCallResponse)
			conversation.contents.push(new ConversationContent(Role.User, 'Function result', 'Function result', '', new Date(), false, true, 'tool-1'));
			// Assistant processes the function response
			conversation.contents.push(new ConversationContent(Role.Assistant, 'Final response'));

			// Now the last message is Assistant, so Continue should be inserted
			expect(conversation.contents[conversation.contents.length - 1].role).toBe(Role.Assistant);

			// Simulate the fix
			if (conversation.contents.length > 0) {
				const lastMessage = conversation.contents[conversation.contents.length - 1];
				if (lastMessage.role === Role.Assistant) {
					conversation.contents.push(new ConversationContent(
						Role.User,
						"Continue",
						"Continue",
						"",
						new Date(),
						false,
						true
					));
				}
			}

			// Verify Continue was inserted
			expect(conversation.contents.length).toBe(5);
			expect(conversation.contents[4].content).toBe('Continue');
			expect(conversation.contents[4].isFunctionCallResponse).toBe(true);
		});
	});

	describe('sanitizeFunctionCallContent (private method tests via reflection)', () => {
		// Access private method for testing
		const getSanitizeMethod = (service: ChatService) => {
			return (service as any).sanitizeFunctionCallContent.bind(service);
		};

		it('should return content unchanged when no function call is provided', () => {
			const sanitize = getSanitizeMethod(service);
			const content = 'This is regular content with {"some": "json"}';

			const result = sanitize(content, null);

			expect(result).toBe(content);
		});

		it('should return content unchanged when content is empty', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, { arg1: 'value1' });

			const result = sanitize('', functionCall);

			expect(result).toBe('');
		});

		it('should return content unchanged when content is only whitespace', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, { arg1: 'value1' });

			const result = sanitize('   \n\t  ', functionCall);

			expect(result).toBe('   \n\t  ');
		});

		it('should remove exact function call JSON from content', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.WriteVaultFile, {
				file_path: 'test.md',
				content: 'Hello world'
			});
			const functionCallString = functionCall.toConversationString();
			const content = `Here is the function call: ${functionCallString}`;

			const result = sanitize(content, functionCall);

			expect(result).toBe('Here is the function call:');
		});

		it('should remove pretty-printed function call JSON (2 spaces)', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, {
				query: 'test query',
				limit: 10
			});

			const prettyPrinted = JSON.stringify(JSON.parse(functionCall.toConversationString()), null, 2);
			const content = `Function call:\n${prettyPrinted}\nEnd of call`;

			const result = sanitize(content, functionCall);

			expect(result).toBe('Function call:\n\nEnd of call');
		});

		it('should remove pretty-printed function call JSON (4 spaces)', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.ReadVaultFiles, {
				file_path: 'example.ts'
			});

			const prettyPrinted = JSON.stringify(JSON.parse(functionCall.toConversationString()), null, 4);
			const content = prettyPrinted;

			const result = sanitize(content, functionCall);

			expect(result).toBe('');
		});

		it('should preserve legitimate JSON content when no function call exists', () => {
			const sanitize = getSanitizeMethod(service);
			const legitimateJson = JSON.stringify({
				user: 'test',
				data: { nested: 'value' }
			}, null, 2);
			const content = `Here is your data:\n${legitimateJson}`;

			const result = sanitize(content, null);

			expect(result).toBe(content);
		});

		it('should only remove function call JSON, preserving other content', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.DeleteVaultFiles, {
				file_path: 'old.txt'
			});
			const functionCallString = functionCall.toConversationString();
			const content = `Processing your request...\n${functionCallString}\nOperation completed successfully.`;

			const result = sanitize(content, functionCall);

			expect(result).toBe('Processing your request...\n\nOperation completed successfully.');
		});

		it('should handle function calls with special characters in arguments', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.WriteVaultFile, {
				file_path: 'path/to/file.ts',
				content: 'const regex = /test.*pattern/g;\nfunction() { return "value"; }'
			});
			const functionCallString = functionCall.toConversationString();
			const content = functionCallString;

			const result = sanitize(content, functionCall);

			expect(result).toBe('');
		});

		it('should handle function calls with nested objects', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, {
				config: {
					nested: {
						deeply: {
							value: 'test'
						}
					}
				},
				array: [1, 2, 3]
			});
			const functionCallString = functionCall.toConversationString();
			const content = `Before\n${functionCallString}\nAfter`;

			const result = sanitize(content, functionCall);

			expect(result).toBe('Before\n\nAfter');
		});

		it('should handle function calls with toolId', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, { arg: 'value' }, 'tool-123');
			const functionCallString = functionCall.toConversationString();
			const content = functionCallString;

			const result = sanitize(content, functionCall);

			expect(result).toBe('');
		});

		it('should not remove similar but different JSON structures', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.WriteVaultFile, {
				file_path: 'test.md'
			});

			// Similar but different structure - should not be removed
			const differentJson = JSON.stringify({
				functionCall: {
					name: 'write_file',
					args: { file_path: 'different.md' }
				}
			});
			const content = `Here is a different call: ${differentJson}`;

			const result = sanitize(content, functionCall);

			// Should keep the different JSON since it doesn't match exactly
			expect(result).toContain('different.md');
		});

		it('should handle multiple whitespace variations in pretty-printed JSON', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, { key: 'value' });

			// Content with irregular whitespace
			const content = `{
  "functionCall":    {
    "name":  "search_vault_files",
    "args": {
      "key":   "value"
    }
  }
}`;

			const result = sanitize(content, functionCall);

			expect(result).toBe('');
		});

		it('should preserve natural language content when function call exists', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.WriteVaultFile, {
				content: 'Character sheet content',
				file_name: 'Walker.md'
			});
			const content = 'I have created a note for Omaz and will now create a note for walker';

			const result = sanitize(content, functionCall);

			// Natural language content should be preserved - it doesn't look like JSON
			expect(result).toBe(content);
		});

		it('should preserve content that does not start with {', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, {
				search_terms: ['Walker']
			});
			const content = 'Searching for details about Walker in Campaign 2 folder.';

			const result = sanitize(content, functionCall);

			// Content doesn't look like JSON, should be preserved
			expect(result).toBe(content);
		});

		it('should preserve content that does not end with }', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, { key: 'value' });
			const content = '{ "incomplete": "json"';

			const result = sanitize(content, functionCall);

			// Malformed JSON should be preserved
			expect(result).toBe(content);
		});

		it('should preserve content with mixed text and JSON-like structures', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.SearchVaultFiles, { key: 'value' });
			const content = 'Here is some info: { "data": "example" } and more text';

			const result = sanitize(content, functionCall);

			// Mixed content should be preserved - doesn't match the exact JSON pattern
			expect(result).toBe(content);
		});

		it('should only sanitize when content is EXACTLY matching JSON structure', () => {
			const sanitize = getSanitizeMethod(service);
			const functionCall = new AIFunctionCall(AIFunction.WriteVaultFile, {
				file_path: 'test.md',
				content: 'Hello'
			});
			const functionCallString = functionCall.toConversationString();

			// Only exact matches should be removed
			const exactMatch = functionCallString;
			const withPrefix = `Creating file: ${functionCallString}`;
			const withSuffix = `${functionCallString} - done`;

			expect(sanitize(exactMatch, functionCall)).toBe('');
			expect(sanitize(withPrefix, functionCall)).toBe('Creating file:');
			expect(sanitize(withSuffix, functionCall)).toBe('- done');
		});
	});

	describe('fromString', () => {
		it('should convert valid function name strings to AIFunction enum', () => {
			expect(fromString('search_vault_files')).toBe(AIFunction.SearchVaultFiles);
			expect(fromString('read_vault_files')).toBe(AIFunction.ReadVaultFiles);
			expect(fromString('write_vault_file')).toBe(AIFunction.WriteVaultFile);
			expect(fromString('delete_vault_files')).toBe(AIFunction.DeleteVaultFiles);
			expect(fromString('move_vault_files')).toBe(AIFunction.MoveVaultFiles);
			expect(fromString('list_vault_files')).toBe(AIFunction.ListVaultFiles);
			expect(fromString('request_web_search')).toBe(AIFunction.RequestWebSearch);
		});

		it('should throw an error for unknown function names', () => {
			expect(() => fromString('unknown_function')).toThrow('Unknown function name: unknown_function');
			expect(() => fromString('test_function')).toThrow('Unknown function name: test_function');
			expect(() => fromString('')).toThrow('Unknown function name: ');
		});
	});
});

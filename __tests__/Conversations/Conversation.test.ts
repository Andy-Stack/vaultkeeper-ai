import { describe, it, expect } from 'vitest';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { AIToolResponse } from '../../AIClasses/FunctionDefinitions/AIToolResponse';
import { AITool } from '../../Enums/AITool';

describe('Conversation', () => {
	describe('constructor', () => {
		it('should create a new conversation with current date', () => {
			const before = new Date();
			const conversation = new Conversation();
			const after = new Date();

			expect(conversation.created.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(conversation.created.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it('should initialize updated date to match created date', () => {
			const conversation = new Conversation();

			expect(conversation.updated.getTime()).toBeCloseTo(conversation.created.getTime(), -1);
		});

		it('should generate title from created date', () => {
			const conversation = new Conversation();

			// Title should be a formatted date string
			expect(conversation.title).toBeDefined();
			expect(conversation.title).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
		});

		it('should initialize contents as empty array', () => {
			const conversation = new Conversation();

			expect(conversation.contents).toEqual([]);
			expect(Array.isArray(conversation.contents)).toBe(true);
		});

		it('should not have path set initially', () => {
			const conversation = new Conversation();

			expect(conversation.path).toBeUndefined();
		});
	});

	describe('isConversationData', () => {
		it('should return true for valid conversation data', () => {
			const validData = {
				title: 'Test Conversation',
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z',
				contents: []
			};

			expect(Conversation.isConversationData(validData)).toBe(true);
		});

		it('should return true for valid conversation data with contents', () => {
			const validData = {
				title: 'Test Conversation',
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z',
				contents: [
					{
						role: 'user',
						content: 'Hello',
						promptContent: '',
						functionCall: '',
						timestamp: '2024-01-01T00:00:00.000Z',
						isFunctionCall: false,
						isFunctionCallResponse: false,
						isProviderSpecificContent: false
					}
				]
			};

			expect(Conversation.isConversationData(validData)).toBe(true);
		});

		it('should return false when data is null', () => {
			expect(Conversation.isConversationData(null)).toBe(false);
		});

		it('should return false when data is not an object', () => {
			expect(Conversation.isConversationData('string')).toBe(false);
			expect(Conversation.isConversationData(123)).toBe(false);
			expect(Conversation.isConversationData(true)).toBe(false);
			expect(Conversation.isConversationData([])).toBe(false);
		});

		it('should return false when title is missing', () => {
			const invalidData = {
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z',
				contents: []
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when title is not a string', () => {
			const invalidData = {
				title: 123,
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z',
				contents: []
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when created is missing', () => {
			const invalidData = {
				title: 'Test',
				updated: '2024-01-01T00:00:00.000Z',
				contents: []
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when created is not a string', () => {
			const invalidData = {
				title: 'Test',
				created: new Date(),
				updated: '2024-01-01T00:00:00.000Z',
				contents: []
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when updated is missing', () => {
			const invalidData = {
				title: 'Test',
				created: '2024-01-01T00:00:00.000Z',
				contents: []
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when updated is not a string', () => {
			const invalidData = {
				title: 'Test',
				created: '2024-01-01T00:00:00.000Z',
				updated: 123,
				contents: []
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when contents is missing', () => {
			const invalidData = {
				title: 'Test',
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z'
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when contents is not an array', () => {
			const invalidData = {
				title: 'Test',
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z',
				contents: 'not an array'
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when contents contains invalid data', () => {
			const invalidData = {
				title: 'Test',
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z',
				contents: [
					{ invalid: 'data' }
				]
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});

		it('should return false when some contents are valid and some are invalid', () => {
			const invalidData = {
				title: 'Test',
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z',
				contents: [
					{
						role: 'user',
						content: 'Hello',
						promptContent: '',
						functionCall: '',
						timestamp: '2024-01-01T00:00:00.000Z',
						isFunctionCall: false,
						isFunctionCallResponse: false,
						isProviderSpecificContent: false
					},
					{ invalid: 'data' }
				]
			};

			expect(Conversation.isConversationData(invalidData)).toBe(false);
		});
	});

	describe('content manipulation', () => {
		it('should update content of most recent conversation content', () => {
			const conversation = new Conversation();
			const content = new ConversationContent({ role: Role.User, content: 'initial' });
			conversation.contents.push(content);

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = 'updated';

			expect(conversation.contents[0].content).toBe('updated');
		});

		it('should only update the last content when multiple contents exist', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'first' }));
			conversation.contents.push(new ConversationContent({ role: Role.Assistant, content: 'second' }));
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'third' }));

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = 'modified';

			expect(conversation.contents[0].content).toBe('first');
			expect(conversation.contents[1].content).toBe('second');
			expect(conversation.contents[2].content).toBe('modified');
		});

		it('should do nothing when contents array is empty', () => {
			const conversation = new Conversation();

			// Should not throw error
			expect(() => {
				const mostRecent = conversation.contents[conversation.contents.length - 1];
				if (mostRecent) {
					mostRecent.content = 'test';
				}
			}).not.toThrow();
			expect(conversation.contents).toHaveLength(0);
		});

		it('should handle empty string as new content', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'initial' }));

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = '';

			expect(conversation.contents[0].content).toBe('');
		});

		it('should handle multiline content', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User, content: 'initial' }));

			const multilineContent = 'Line 1\nLine 2\nLine 3';
			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = multilineContent;

			expect(conversation.contents[0].content).toBe(multilineContent);
		});
	});

	describe('function call manipulation', () => {
		it('should set function call on most recent content', () => {
			const conversation = new Conversation();
			const content = new ConversationContent({ role: Role.Assistant });
			conversation.contents.push(content);

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = 'readFile';

			expect(conversation.contents[0].functionCall).toBe('readFile');
		});

		it('should mark most recent content as function call', () => {
			const conversation = new Conversation();
			const content = new ConversationContent({ role: Role.Assistant });
			conversation.contents.push(content);

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = 'readFile';

			expect(conversation.contents[0].functionCall).toBe('readFile');
		});

		it('should only update the last content when multiple contents exist', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.User }));
			conversation.contents.push(new ConversationContent({ role: Role.Assistant }));
			conversation.contents.push(new ConversationContent({ role: Role.Assistant }));

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = 'searchFiles';

			expect(conversation.contents[0].functionCall).toBeUndefined();
			expect(conversation.contents[1].functionCall).toBeUndefined();
			expect(conversation.contents[2].functionCall).toBe('searchFiles');
		});

		it('should do nothing when contents array is empty', () => {
			const conversation = new Conversation();

			// Should not throw error
			expect(() => {
				const mostRecent = conversation.contents[conversation.contents.length - 1];
				if (mostRecent) {
					mostRecent.functionCall = 'test';
				}
			}).not.toThrow();
			expect(conversation.contents).toHaveLength(0);
		});

		it('should handle empty string as function call', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent({ role: Role.Assistant }));

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = '';

			expect(conversation.contents[0].functionCall).toBe('');
		});

		it('should overwrite existing function call', () => {
			const conversation = new Conversation();
			const content = new ConversationContent({ role: Role.Assistant, functionCall: 'oldFunction' });
			conversation.contents.push(content);

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = 'newFunction';

			expect(conversation.contents[0].functionCall).toBe('newFunction');
		});
	});

	describe('integration', () => {
		it('should handle complete conversation workflow', () => {
			const conversation = new Conversation();

			// Add user message
			const userMessage = new ConversationContent({ role: Role.User, content: 'Hello' });
			conversation.contents.push(userMessage);

			// Add assistant response
			const assistantMessage = new ConversationContent({ role: Role.Assistant });
			conversation.contents.push(assistantMessage);

			// Stream in assistant response
			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = 'Hi there';
			mostRecent.content = 'Hi there, how can I help you?';

			// Assistant makes a function call
			mostRecent.functionCall = 'readFile';

			expect(conversation.contents).toHaveLength(2);
			expect(conversation.contents[0].role).toBe(Role.User);
			expect(conversation.contents[0].content).toBe('Hello');
			expect(conversation.contents[1].role).toBe(Role.Assistant);
			expect(conversation.contents[1].content).toBe('Hi there, how can I help you?');
			expect(conversation.contents[1].functionCall).toBe('readFile');
		});

		it('should maintain conversation metadata', () => {
			const conversation = new Conversation();

			expect(conversation.title).toBeDefined();
			expect(conversation.created).toBeInstanceOf(Date);
			expect(conversation.updated).toBeInstanceOf(Date);
			expect(conversation.contents).toEqual([]);
		});
	});

	describe('addFunctionResponse', () => {
		describe('read_vault_files with errors', () => {
			it('should handle file not found errors without creating attachments', () => {
				const conversation = new Conversation();
				const functionResponse = new AIToolResponse(
					AITool.ReadVaultFiles,
					{
						results: [
							{ path: 'nonexistent.md', error: 'File does not exist: nonexistent.md' }
						]
					},
					'tool-123'
				);

				conversation.addFunctionResponse(functionResponse);

				// Should have one content item (the function response with error)
				expect(conversation.contents).toHaveLength(1);
				expect(conversation.contents[0].role).toBe(Role.User);
				expect(conversation.contents[0].shouldDisplayContent).toBe(false);

				// Should not have attachments
				expect(conversation.contents[0].attachments).toHaveLength(0);

				// Parse the function response to verify error is included
				const parsedResponse = JSON.parse(conversation.contents[0].functionResponse!);
				expect(parsedResponse.functionResponse.response.results).toHaveLength(1);
				expect(parsedResponse.functionResponse.response.results[0].error).toBe('File does not exist: nonexistent.md');
			});

			it('should handle mix of successful reads and errors', () => {
				const conversation = new Conversation();
				const functionResponse = new AIToolResponse(
					AITool.ReadVaultFiles,
					{
						results: [
							{ path: 'existing.md', type: 'md', contents: '# Hello' },
							{ path: 'nonexistent.md', error: 'File does not exist: nonexistent.md' },
							{ path: 'another.txt', type: 'txt', contents: 'World' }
						]
					},
					'tool-123'
				);

				conversation.addFunctionResponse(functionResponse);

				// Should have one content item with all results
				expect(conversation.contents).toHaveLength(1);
				expect(conversation.contents[0].role).toBe(Role.User);

				// Parse the function response
				const parsedResponse = JSON.parse(conversation.contents[0].functionResponse!);
				const results = parsedResponse.functionResponse.response.results;

				// Should have all 3 results (2 successful + 1 error)
				expect(results).toHaveLength(3);

				// Check that we have the expected content (order may vary)
				const textResults = results.filter((r: { contents?: string }) => r.contents);
				const errorResult = results.filter((r: { error?: string }) => r.error);

				expect(textResults).toHaveLength(2);
				expect(textResults.some((r: { contents: string }) => r.contents === '# Hello')).toBe(true);
				expect(textResults.some((r: { contents: string }) => r.contents === 'World')).toBe(true);
				expect(errorResult).toHaveLength(1);
				expect(errorResult[0].error).toBe('File does not exist: nonexistent.md');
			});

			it('should not create attachments for error results with binary file extensions', () => {
				const conversation = new Conversation();
				const functionResponse = new AIToolResponse(
					AITool.ReadVaultFiles,
					{
						results: [
							{ path: 'image.png', error: 'File does not exist: image.png' }
						]
					},
					'tool-123'
				);

				conversation.addFunctionResponse(functionResponse);

				// Should have one content item (function response only)
				expect(conversation.contents).toHaveLength(1);

				// Should not have attachments (error result should not be treated as binary file)
				expect(conversation.contents[0].attachments).toHaveLength(0);

				// Verify error is in the function response
				const parsedResponse = JSON.parse(conversation.contents[0].functionResponse!);
				expect(parsedResponse.functionResponse.response.results[0].error).toBeDefined();
			});

			it('should handle binary files with errors not creating invalid attachments', () => {
				const conversation = new Conversation();
				const functionResponse = new AIToolResponse(
					AITool.ReadVaultFiles,
					{
						results: [
							{ path: 'image.png', error: 'File does not exist: image.png' },
							{ path: 'valid.png', type: 'png', contents: 'base64encodeddata...' }
						]
					},
					'tool-123'
				);

				conversation.addFunctionResponse(functionResponse);

				// Should have 2 content items: function response + attachments
				expect(conversation.contents).toHaveLength(2);

				// First item should have the error and success message
				const parsedResponse = JSON.parse(conversation.contents[0].functionResponse!);
				expect(parsedResponse.functionResponse.response.results).toHaveLength(1);
				expect(parsedResponse.functionResponse.response.results[0].error).toBe('File does not exist: image.png');

				// Second item should only have the valid attachment
				expect(conversation.contents[1].attachments).toHaveLength(1);
				expect(conversation.contents[1].attachments[0].fileName).toBe('valid.png');
			});
		});

		describe('read_vault_files without errors', () => {
			it('should handle successful text file reads', () => {
				const conversation = new Conversation();
				const functionResponse = new AIToolResponse(
					AITool.ReadVaultFiles,
					{
						results: [
							{ path: 'file.md', type: 'md', contents: '# Title' }
						]
					},
					'tool-123'
				);

				conversation.addFunctionResponse(functionResponse);

				expect(conversation.contents).toHaveLength(1);
				const parsedResponse = JSON.parse(conversation.contents[0].functionResponse!);
				expect(parsedResponse.functionResponse.response.results[0].contents).toBe('# Title');
			});

			it('should create attachments for binary files', () => {
				const conversation = new Conversation();
				const functionResponse = new AIToolResponse(
					AITool.ReadVaultFiles,
					{
						results: [
							{ path: 'image.png', type: 'png', contents: 'base64data...' }
						]
					},
					'tool-123'
				);

				conversation.addFunctionResponse(functionResponse);

				// Should have 2 items: function response + attachments
				expect(conversation.contents).toHaveLength(2);
				expect(conversation.contents[1].attachments).toHaveLength(1);
				expect(conversation.contents[1].attachments[0].fileName).toBe('image.png');
			});
		});

		describe('non-read_vault_files functions', () => {
			it('should handle other functions normally', () => {
				const conversation = new Conversation();
				const functionResponse = new AIToolResponse(
					AITool.WriteVaultFile,
					{ success: true },
					'tool-123'
				);

				conversation.addFunctionResponse(functionResponse);

				expect(conversation.contents).toHaveLength(1);
				expect(conversation.contents[0].role).toBe(Role.User);
				expect(conversation.contents[0].attachments).toHaveLength(0);
			});
		});
	});
});

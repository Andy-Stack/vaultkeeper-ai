import { describe, it, expect } from 'vitest';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';

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
			const content = new ConversationContent('user', 'initial');
			conversation.contents.push(content);

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = 'updated';

			expect(conversation.contents[0].content).toBe('updated');
		});

		it('should only update the last content when multiple contents exist', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent('user', 'first'));
			conversation.contents.push(new ConversationContent('assistant', 'second'));
			conversation.contents.push(new ConversationContent('user', 'third'));

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
			conversation.contents.push(new ConversationContent('user', 'initial'));

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = '';

			expect(conversation.contents[0].content).toBe('');
		});

		it('should handle multiline content', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent('user', 'initial'));

			const multilineContent = 'Line 1\nLine 2\nLine 3';
			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = multilineContent;

			expect(conversation.contents[0].content).toBe(multilineContent);
		});
	});

	describe('function call manipulation', () => {
		it('should set function call on most recent content', () => {
			const conversation = new Conversation();
			const content = new ConversationContent('assistant');
			conversation.contents.push(content);

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = 'readFile';
			mostRecent.isFunctionCall = true;

			expect(conversation.contents[0].functionCall).toBe('readFile');
		});

		it('should mark most recent content as function call', () => {
			const conversation = new Conversation();
			const content = new ConversationContent('assistant');
			conversation.contents.push(content);

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = 'readFile';
			mostRecent.isFunctionCall = true;

			expect(conversation.contents[0].isFunctionCall).toBe(true);
		});

		it('should only update the last content when multiple contents exist', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent('user'));
			conversation.contents.push(new ConversationContent('assistant'));
			conversation.contents.push(new ConversationContent('assistant'));

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = 'searchFiles';
			mostRecent.isFunctionCall = true;

			expect(conversation.contents[0].functionCall).toBe('');
			expect(conversation.contents[0].isFunctionCall).toBe(false);
			expect(conversation.contents[1].functionCall).toBe('');
			expect(conversation.contents[1].isFunctionCall).toBe(false);
			expect(conversation.contents[2].functionCall).toBe('searchFiles');
			expect(conversation.contents[2].isFunctionCall).toBe(true);
		});

		it('should do nothing when contents array is empty', () => {
			const conversation = new Conversation();

			// Should not throw error
			expect(() => {
				const mostRecent = conversation.contents[conversation.contents.length - 1];
				if (mostRecent) {
					mostRecent.functionCall = 'test';
					mostRecent.isFunctionCall = true;
				}
			}).not.toThrow();
			expect(conversation.contents).toHaveLength(0);
		});

		it('should handle empty string as function call', () => {
			const conversation = new Conversation();
			conversation.contents.push(new ConversationContent('assistant'));

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = '';
			mostRecent.isFunctionCall = true;

			expect(conversation.contents[0].functionCall).toBe('');
			expect(conversation.contents[0].isFunctionCall).toBe(true);
		});

		it('should overwrite existing function call', () => {
			const conversation = new Conversation();
			const content = new ConversationContent('assistant', '', '', 'oldFunction', new Date(), true);
			conversation.contents.push(content);

			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.functionCall = 'newFunction';
			mostRecent.isFunctionCall = true;

			expect(conversation.contents[0].functionCall).toBe('newFunction');
			expect(conversation.contents[0].isFunctionCall).toBe(true);
		});
	});

	describe('integration', () => {
		it('should handle complete conversation workflow', () => {
			const conversation = new Conversation();

			// Add user message
			const userMessage = new ConversationContent('user', 'Hello');
			conversation.contents.push(userMessage);

			// Add assistant response
			const assistantMessage = new ConversationContent('assistant');
			conversation.contents.push(assistantMessage);

			// Stream in assistant response
			const mostRecent = conversation.contents[conversation.contents.length - 1];
			mostRecent.content = 'Hi there';
			mostRecent.content = 'Hi there, how can I help you?';

			// Assistant makes a function call
			mostRecent.functionCall = 'readFile';
			mostRecent.isFunctionCall = true;

			expect(conversation.contents).toHaveLength(2);
			expect(conversation.contents[0].role).toBe('user');
			expect(conversation.contents[0].content).toBe('Hello');
			expect(conversation.contents[1].role).toBe('assistant');
			expect(conversation.contents[1].content).toBe('Hi there, how can I help you?');
			expect(conversation.contents[1].functionCall).toBe('readFile');
			expect(conversation.contents[1].isFunctionCall).toBe(true);
		});

		it('should maintain conversation metadata', () => {
			const conversation = new Conversation();

			expect(conversation.title).toBeDefined();
			expect(conversation.created).toBeInstanceOf(Date);
			expect(conversation.updated).toBeInstanceOf(Date);
			expect(conversation.contents).toEqual([]);
		});
	});
});

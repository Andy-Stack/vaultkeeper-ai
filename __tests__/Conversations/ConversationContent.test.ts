import { describe, it, expect } from 'vitest';
import { ConversationContent } from '../../Conversations/ConversationContent';

describe('ConversationContent', () => {
	describe('constructor', () => {
		it('should create content with all parameters', () => {
			const timestamp = new Date('2024-01-01T00:00:00.000Z');
			const content = new ConversationContent(
				'user',
				'Hello',
				'promptContent',
				'functionCall',
				timestamp,
				true,
				false,
				'tool-123'
			);

			expect(content.role).toBe('user');
			expect(content.content).toBe('Hello');
			expect(content.promptContent).toBe('promptContent');
			expect(content.functionCall).toBe('functionCall');
			expect(content.timestamp).toBe(timestamp);
			expect(content.isFunctionCall).toBe(true);
			expect(content.isFunctionCallResponse).toBe(false);
			expect(content.toolId).toBe('tool-123');
		});

		it('should create content with all parameters including thoughtSignature', () => {
			const timestamp = new Date('2024-01-01T00:00:00.000Z');
			const signature = 'base64EncodedSignature==';
			const content = new ConversationContent(
				'user',
				'Hello',
				'promptContent',
				'functionCall',
				timestamp,
				true,
				false,
				'tool-123',
				signature
			);

			expect(content.role).toBe('user');
			expect(content.content).toBe('Hello');
			expect(content.promptContent).toBe('promptContent');
			expect(content.functionCall).toBe('functionCall');
			expect(content.timestamp).toBe(timestamp);
			expect(content.isFunctionCall).toBe(true);
			expect(content.isFunctionCallResponse).toBe(false);
			expect(content.toolId).toBe('tool-123');
			expect(content.thoughtSignature).toBe(signature);
		});

		it('should use default values when optional parameters are omitted', () => {
			const content = new ConversationContent('assistant');

			expect(content.role).toBe('assistant');
			expect(content.content).toBe('');
			expect(content.promptContent).toBe('');
			expect(content.functionCall).toBe('');
			expect(content.timestamp).toBeInstanceOf(Date);
			expect(content.isFunctionCall).toBe(false);
			expect(content.isFunctionCallResponse).toBe(false);
			expect(content.toolId).toBeUndefined();
			expect(content.thoughtSignature).toBeUndefined();
		});

		it('should use current date as default timestamp', () => {
			const before = new Date();
			const content = new ConversationContent('user');
			const after = new Date();

			expect(content.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(content.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it('should accept partial optional parameters', () => {
			const content = new ConversationContent('user', 'Hello', '', 'someFunction');

			expect(content.role).toBe('user');
			expect(content.content).toBe('Hello');
			expect(content.promptContent).toBe('');
			expect(content.functionCall).toBe('someFunction');
			expect(content.timestamp).toBeInstanceOf(Date);
			expect(content.isFunctionCall).toBe(false);
			expect(content.isFunctionCallResponse).toBe(false);
		});

		it('should create user message content', () => {
			const content = new ConversationContent('user', 'What is the weather?');

			expect(content.role).toBe('user');
			expect(content.content).toBe('What is the weather?');
			expect(content.isFunctionCall).toBe(false);
			expect(content.isFunctionCallResponse).toBe(false);
		});

		it('should create assistant message content', () => {
			const content = new ConversationContent('assistant', 'The weather is sunny.');

			expect(content.role).toBe('assistant');
			expect(content.content).toBe('The weather is sunny.');
		});

		it('should create function call content', () => {
			const content = new ConversationContent(
				'assistant',
				'',
				'',
				'readFile',
				new Date(),
				true,
				false,
				'call-1'
			);

			expect(content.role).toBe('assistant');
			expect(content.functionCall).toBe('readFile');
			expect(content.isFunctionCall).toBe(true);
			expect(content.isFunctionCallResponse).toBe(false);
			expect(content.toolId).toBe('call-1');
		});

		it('should create function call response content', () => {
			const content = new ConversationContent(
				'user',
				'File contents here',
				'',
				'',
				new Date(),
				false,
				true,
				'call-1'
			);

			expect(content.role).toBe('user');
			expect(content.content).toBe('File contents here');
			expect(content.isFunctionCall).toBe(false);
			expect(content.isFunctionCallResponse).toBe(true);
			expect(content.toolId).toBe('call-1');
		});
	});

	describe('isConversationContentData', () => {
		it('should return true for valid conversation content data', () => {
			const validData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true for valid data with toolId', () => {
			const validData = {
				role: 'assistant',
				content: '',
				promptContent: '',
				functionCall: 'readFile',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: true,
				isFunctionCallResponse: false,
				toolId: 'tool-123'
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true for valid data with thoughtSignature', () => {
			const validData = {
				role: 'assistant',
				content: '',
				promptContent: '',
				functionCall: 'readFile',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: true,
				isFunctionCallResponse: false,
				thoughtSignature: 'base64Signature=='
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true for valid data with both toolId and thoughtSignature', () => {
			const validData = {
				role: 'assistant',
				content: '',
				promptContent: '',
				functionCall: 'readFile',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: true,
				isFunctionCallResponse: false,
				toolId: 'tool-123',
				thoughtSignature: 'base64Signature=='
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return false when data is null', () => {
			expect(ConversationContent.isConversationContentData(null)).toBe(false);
		});

		it('should return false when data is not an object', () => {
			expect(ConversationContent.isConversationContentData('string')).toBe(false);
			expect(ConversationContent.isConversationContentData(123)).toBe(false);
			expect(ConversationContent.isConversationContentData(true)).toBe(false);
			expect(ConversationContent.isConversationContentData([])).toBe(false);
		});

		it('should return false when role is missing', () => {
			const invalidData = {
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when role is not a string', () => {
			const invalidData = {
				role: 123,
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when content is missing', () => {
			const invalidData = {
				role: 'user',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when content is not a string', () => {
			const invalidData = {
				role: 'user',
				content: 123,
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when functionCall is missing', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when functionCall is not a string', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: null,
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when timestamp is missing', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when timestamp is not a string', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: new Date(),
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when isFunctionCall is missing', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when isFunctionCall is not a boolean', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: 'false',
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when isFunctionCallResponse is missing', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when isFunctionCallResponse is not a boolean', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: 1
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return true when toolId is missing (optional field)', () => {
			const validData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true when thoughtSignature is missing (optional field)', () => {
			const validData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return false when thoughtSignature is not a string', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello',
				promptContent: '',
				functionCall: '',
				timestamp: '2024-01-01T00:00:00.000Z',
				isFunctionCall: false,
				isFunctionCallResponse: false,
				thoughtSignature: 123
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should handle edge case with empty strings', () => {
			const validData = {
				role: '',
				content: '',
				promptContent: '',
				functionCall: '',
				timestamp: '',
				isFunctionCall: false,
				isFunctionCallResponse: false
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});
	});

	describe('properties', () => {
		it('should allow role to be modified', () => {
			const content = new ConversationContent('user');
			content.role = 'assistant';

			expect(content.role).toBe('assistant');
		});

		it('should allow content to be modified', () => {
			const content = new ConversationContent('user', 'initial');
			content.content = 'modified';

			expect(content.content).toBe('modified');
		});

		it('should allow functionCall to be modified', () => {
			const content = new ConversationContent('assistant');
			content.functionCall = 'readFile';

			expect(content.functionCall).toBe('readFile');
		});

		it('should allow timestamp to be modified', () => {
			const content = new ConversationContent('user');
			const newTimestamp = new Date('2025-01-01T00:00:00.000Z');
			content.timestamp = newTimestamp;

			expect(content.timestamp).toBe(newTimestamp);
		});

		it('should allow isFunctionCall to be modified', () => {
			const content = new ConversationContent('assistant');
			content.isFunctionCall = true;

			expect(content.isFunctionCall).toBe(true);
		});

		it('should allow isFunctionCallResponse to be modified', () => {
			const content = new ConversationContent('user');
			content.isFunctionCallResponse = true;

			expect(content.isFunctionCallResponse).toBe(true);
		});

		it('should allow toolId to be modified', () => {
			const content = new ConversationContent('assistant');
			content.toolId = 'tool-456';

			expect(content.toolId).toBe('tool-456');
		});

		it('should allow thoughtSignature to be modified', () => {
			const content = new ConversationContent('assistant');
			content.thoughtSignature = 'newSignature==';

			expect(content.thoughtSignature).toBe('newSignature==');
		});
	});

	describe('edge cases', () => {
		it('should handle very long content', () => {
			const longContent = 'a'.repeat(100000);
			const content = new ConversationContent('user', longContent);

			expect(content.content).toBe(longContent);
			expect(content.content).toHaveLength(100000);
		});

		it('should handle special characters in content', () => {
			const specialContent = '特殊字符 <>&"\'`\n\t\r';
			const content = new ConversationContent('user', specialContent);

			expect(content.content).toBe(specialContent);
		});

		it('should handle multiline content', () => {
			const multilineContent = 'Line 1\nLine 2\nLine 3';
			const content = new ConversationContent('user', multilineContent);

			expect(content.content).toBe(multilineContent);
		});

		it('should handle empty role', () => {
			const content = new ConversationContent('', 'Hello');

			expect(content.role).toBe('');
		});

		it('should handle both function call and response flags true', () => {
			const content = new ConversationContent('user', 'test', '', 'func', new Date(), true, true);

			expect(content.isFunctionCall).toBe(true);
			expect(content.isFunctionCallResponse).toBe(true);
		});

		it('should handle very old timestamps', () => {
			const oldDate = new Date('1970-01-01T00:00:00.000Z');
			const content = new ConversationContent('user', 'Hello', '', '', oldDate);

			expect(content.timestamp).toBe(oldDate);
		});

		it('should handle future timestamps', () => {
			const futureDate = new Date('2099-12-31T23:59:59.999Z');
			const content = new ConversationContent('user', 'Hello', '', '', futureDate);

			expect(content.timestamp).toBe(futureDate);
		});
	});
});

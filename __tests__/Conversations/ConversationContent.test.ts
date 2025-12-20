import { describe, it, expect } from 'vitest';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';

describe('ConversationContent', () => {
	describe('constructor', () => {
		it('should create content with all parameters', () => {
			const timestamp = new Date('2024-01-01T00:00:00.000Z');
			const content = new ConversationContent({
				role: Role.User,
				content: 'Hello',
				displayContent: 'Hello Display',
				functionCall: 'functionCall',
				functionResponse: 'functionResponse',
				timestamp,
				attachments: [],
				shouldDisplayContent: true,
				toolId: 'tool-123'
			});

			expect(content.role).toBe(Role.User);
			expect(content.content).toBe('Hello');
			expect(content.displayContent).toBe('Hello Display');
			expect(content.functionCall).toBe('functionCall');
			expect(content.functionResponse).toBe('functionResponse');
			expect(content.timestamp).toBe(timestamp);
			expect(content.attachments).toEqual([]);
			expect(content.shouldDisplayContent).toBe(true);
			expect(content.toolId).toBe('tool-123');
		});

		it('should create content with all parameters including thoughtSignature', () => {
			const timestamp = new Date('2024-01-01T00:00:00.000Z');
			const signature = 'base64EncodedSignature==';
			const content = new ConversationContent({
				role: Role.User,
				content: 'Hello',
				displayContent: 'Hello Display',
				functionCall: 'functionCall',
				functionResponse: 'functionResponse',
				timestamp,
				attachments: [],
				shouldDisplayContent: true,
				toolId: 'tool-123',
				thoughtSignature: signature
			});

			expect(content.role).toBe(Role.User);
			expect(content.content).toBe('Hello');
			expect(content.displayContent).toBe('Hello Display');
			expect(content.functionCall).toBe('functionCall');
			expect(content.functionResponse).toBe('functionResponse');
			expect(content.timestamp).toBe(timestamp);
			expect(content.attachments).toEqual([]);
			expect(content.shouldDisplayContent).toBe(true);
			expect(content.toolId).toBe('tool-123');
			expect(content.thoughtSignature).toBe(signature);
		});

		it('should use default values when optional parameters are omitted', () => {
			const content = new ConversationContent({ role: Role.Assistant });

			expect(content.role).toBe(Role.Assistant);
			expect(content.content).toBeUndefined();
			expect(content.displayContent).toBeUndefined();
			expect(content.functionCall).toBeUndefined();
			expect(content.functionResponse).toBeUndefined();
			expect(content.timestamp).toBeInstanceOf(Date);
			expect(content.attachments).toEqual([]);
			expect(content.shouldDisplayContent).toBe(true);
			expect(content.toolId).toBeUndefined();
			expect(content.thoughtSignature).toBeUndefined();
		});

		it('should use current date as default timestamp', () => {
			const before = new Date();
			const content = new ConversationContent({ role: Role.User });
			const after = new Date();

			expect(content.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(content.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it('should accept partial optional parameters', () => {
			const content = new ConversationContent({
				role: Role.User,
				content: 'Hello',
				functionCall: 'someFunction'
			});

			expect(content.role).toBe(Role.User);
			expect(content.content).toBe('Hello');
			expect(content.displayContent).toBeUndefined();
			expect(content.functionCall).toBe('someFunction');
			expect(content.functionResponse).toBeUndefined();
			expect(content.timestamp).toBeInstanceOf(Date);
			expect(content.attachments).toEqual([]);
			expect(content.shouldDisplayContent).toBe(true);
		});

		it('should create user message content', () => {
			const content = new ConversationContent({
				role: Role.User,
				content: 'What is the weather?'
			});

			expect(content.role).toBe(Role.User);
			expect(content.content).toBe('What is the weather?');
			expect(content.functionCall).toBeUndefined();
			expect(content.functionResponse).toBeUndefined();
		});

		it('should create assistant message content', () => {
			const content = new ConversationContent({
				role: Role.Assistant,
				content: 'The weather is sunny.'
			});

			expect(content.role).toBe(Role.Assistant);
			expect(content.content).toBe('The weather is sunny.');
		});

		it('should create function call content', () => {
			const content = new ConversationContent({
				role: Role.Assistant,
				functionCall: 'readFile',
				timestamp: new Date(),
				toolId: 'call-1'
			});

			expect(content.role).toBe(Role.Assistant);
			expect(content.functionCall).toBe('readFile');
			expect(content.functionResponse).toBeUndefined();
			expect(content.toolId).toBe('call-1');
		});

		it('should create function call response content', () => {
			const content = new ConversationContent({
				role: Role.User,
				content: 'File contents here',
				functionResponse: 'File contents here',
				timestamp: new Date(),
				toolId: 'call-1'
			});

			expect(content.role).toBe(Role.User);
			expect(content.content).toBe('File contents here');
			expect(content.functionResponse).toBe('File contents here');
			expect(content.functionCall).toBeUndefined();
			expect(content.toolId).toBe('call-1');
		});

		it('should set shouldDisplayContent to false when specified', () => {
			const content = new ConversationContent({
				role: Role.User,
				content: 'Hidden content',
				shouldDisplayContent: false
			});

			expect(content.shouldDisplayContent).toBe(false);
		});

		it('should handle attachments array', () => {
			const attachments = [
				{ fileId: 'file1', fileName: 'test.txt' },
				{ fileId: 'file2', fileName: 'image.png' }
			] as any;

			const content = new ConversationContent({
				role: Role.User,
				content: 'Message with attachments',
				attachments
			});

			expect(content.attachments).toEqual(attachments);
			expect(content.attachments).toHaveLength(2);
		});
	});

	describe('getDisplayContent', () => {
		it('should return displayContent when set', () => {
			const content = new ConversationContent({
				role: Role.User,
				content: 'Content',
				displayContent: 'Display Content'
			});

			expect(content.getDisplayContent()).toBe('Display Content');
		});

		it('should return content when displayContent is not set', () => {
			const content = new ConversationContent({
				role: Role.User,
				content: 'Content'
			});

			expect(content.getDisplayContent()).toBe('Content');
		});

		it('should return empty string when both displayContent and content are not set', () => {
			const content = new ConversationContent({
				role: Role.User
			});

			expect(content.getDisplayContent()).toBe('');
		});
	});

	describe('isConversationContentData', () => {
		it('should return true for valid conversation content data', () => {
			const validData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				content: 'Hello',
				displayContent: 'Hello Display',
				functionCall: '',
				functionResponse: '',
				attachments: [],
				shouldDisplayContent: true
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true for minimal valid data', () => {
			const validData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z'
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true for valid data with toolId', () => {
			const validData = {
				role: 'assistant',
				timestamp: '2024-01-01T00:00:00.000Z',
				functionCall: 'readFile',
				toolId: 'tool-123'
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true for valid data with thoughtSignature', () => {
			const validData = {
				role: 'assistant',
				timestamp: '2024-01-01T00:00:00.000Z',
				functionCall: 'readFile',
				thoughtSignature: 'base64Signature=='
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true for valid data with both toolId and thoughtSignature', () => {
			const validData = {
				role: 'assistant',
				timestamp: '2024-01-01T00:00:00.000Z',
				functionCall: 'readFile',
				toolId: 'tool-123',
				thoughtSignature: 'base64Signature=='
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});

		it('should return true for valid data with errorType', () => {
			const validData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				content: 'Error occurred',
				errorType: 'RATE_LIMIT_ERROR'
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
				timestamp: '2024-01-01T00:00:00.000Z',
				content: 'Hello'
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when role is not a string', () => {
			const invalidData = {
				role: 123,
				timestamp: '2024-01-01T00:00:00.000Z',
				content: 'Hello'
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when timestamp is missing', () => {
			const invalidData = {
				role: 'user',
				content: 'Hello'
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when timestamp is not a string', () => {
			const invalidData = {
				role: 'user',
				timestamp: new Date(),
				content: 'Hello'
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when content is not a string', () => {
			const invalidData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				content: 123
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when displayContent is not a string', () => {
			const invalidData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				displayContent: 123
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when functionCall is not a string', () => {
			const invalidData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				functionCall: null
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when functionResponse is not a string', () => {
			const invalidData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				functionResponse: null
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when attachments is not an array', () => {
			const invalidData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				attachments: 'not-an-array'
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when shouldDisplayContent is not a boolean', () => {
			const invalidData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				shouldDisplayContent: 'true'
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when thoughtSignature is not a string', () => {
			const invalidData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				thoughtSignature: 123
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should return false when errorType is not a string', () => {
			const invalidData = {
				role: 'user',
				timestamp: '2024-01-01T00:00:00.000Z',
				errorType: 123
			};

			expect(ConversationContent.isConversationContentData(invalidData)).toBe(false);
		});

		it('should handle edge case with empty strings', () => {
			const validData = {
				role: '',
				timestamp: '',
				content: '',
				displayContent: '',
				functionCall: '',
				functionResponse: ''
			};

			expect(ConversationContent.isConversationContentData(validData)).toBe(true);
		});
	});

	describe('properties', () => {
		it('should allow role to be modified', () => {
			const content = new ConversationContent({ role: Role.User });
			content.role = Role.Assistant;

			expect(content.role).toBe(Role.Assistant);
		});

		it('should allow content to be modified', () => {
			const content = new ConversationContent({ role: Role.User, content: 'initial' });
			content.content = 'modified';

			expect(content.content).toBe('modified');
		});

		it('should allow displayContent to be modified', () => {
			const content = new ConversationContent({ role: Role.User, displayContent: 'initial' });
			content.displayContent = 'modified';

			expect(content.displayContent).toBe('modified');
		});

		it('should allow functionCall to be modified', () => {
			const content = new ConversationContent({ role: Role.Assistant });
			content.functionCall = 'readFile';

			expect(content.functionCall).toBe('readFile');
		});

		it('should allow functionResponse to be modified', () => {
			const content = new ConversationContent({ role: Role.User });
			content.functionResponse = 'response data';

			expect(content.functionResponse).toBe('response data');
		});

		it('should allow timestamp to be modified', () => {
			const content = new ConversationContent({ role: Role.User });
			const newTimestamp = new Date('2025-01-01T00:00:00.000Z');
			content.timestamp = newTimestamp;

			expect(content.timestamp).toBe(newTimestamp);
		});

		it('should allow attachments to be modified', () => {
			const content = new ConversationContent({ role: Role.User });
			const newAttachments = [{ fileId: 'file1', fileName: 'test.txt' }] as any;
			content.attachments = newAttachments;

			expect(content.attachments).toEqual(newAttachments);
		});

		it('should allow shouldDisplayContent to be modified', () => {
			const content = new ConversationContent({ role: Role.User });
			content.shouldDisplayContent = false;

			expect(content.shouldDisplayContent).toBe(false);
		});

		it('should allow toolId to be modified', () => {
			const content = new ConversationContent({ role: Role.Assistant });
			content.toolId = 'tool-456';

			expect(content.toolId).toBe('tool-456');
		});

		it('should allow thoughtSignature to be modified', () => {
			const content = new ConversationContent({ role: Role.Assistant });
			content.thoughtSignature = 'newSignature==';

			expect(content.thoughtSignature).toBe('newSignature==');
		});

		it('should allow errorType to be modified', () => {
			const content = new ConversationContent({ role: Role.User });
			content.errorType = 'RATE_LIMIT_ERROR' as any;

			expect(content.errorType).toBe('RATE_LIMIT_ERROR');
		});
	});

	describe('edge cases', () => {
		it('should handle very long content', () => {
			const longContent = 'a'.repeat(100000);
			const content = new ConversationContent({ role: Role.User, content: longContent });

			expect(content.content).toBe(longContent);
			expect(content.content).toHaveLength(100000);
		});

		it('should handle special characters in content', () => {
			const specialContent = '特殊字符 <>&"\'`\n\t\r';
			const content = new ConversationContent({ role: Role.User, content: specialContent });

			expect(content.content).toBe(specialContent);
		});

		it('should handle multiline content', () => {
			const multilineContent = 'Line 1\nLine 2\nLine 3';
			const content = new ConversationContent({ role: Role.User, content: multilineContent });

			expect(content.content).toBe(multilineContent);
		});

		it('should handle very old timestamps', () => {
			const oldDate = new Date('1970-01-01T00:00:00.000Z');
			const content = new ConversationContent({ role: Role.User, timestamp: oldDate });

			expect(content.timestamp).toBe(oldDate);
		});

		it('should handle future timestamps', () => {
			const futureDate = new Date('2099-12-31T23:59:59.999Z');
			const content = new ConversationContent({ role: Role.User, timestamp: futureDate });

			expect(content.timestamp).toBe(futureDate);
		});
	});

	describe('safeContinue', () => {
		it('should create a continue message with User role', () => {
			const content = ConversationContent.safeContinue();

			expect(content.role).toBe(Role.User);
			expect(content.content).toBe('Continue');
			expect(content.shouldDisplayContent).toBe(false);
		});
	});
});

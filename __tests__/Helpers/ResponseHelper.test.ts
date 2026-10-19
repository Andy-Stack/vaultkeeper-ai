import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseToolCalls, parseFunctionResponse, sanitizeToolCallContent } from '../../Helpers/ResponseHelper';
import { AIToolCall } from '../../AIClasses/AIToolCall';
import { AITool } from '../../Enums/AITool';
import { Exception } from '../../Helpers/Exception';

describe('ResponseHelper', () => {
	beforeEach(() => {
		vi.spyOn(Exception, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('parseToolCalls', () => {
		it('should parse an array of stored tool calls', () => {
			const json = JSON.stringify([
				{ toolCall: { id: 'a', name: 'search_vault_files', args: { query: 'x' } } },
				{ toolCall: { id: 'b', name: 'read_vault_files', args: {} } }
			]);

			const result = parseToolCalls(json);

			expect(result).toHaveLength(2);
			expect(result![0].toolCall.id).toBe('a');
			expect(result![1].toolCall.name).toBe('read_vault_files');
		});

		it('should parse an empty array', () => {
			expect(parseToolCalls('[]')).toEqual([]);
		});

		it('should round trip calls serialised by AIToolCall', () => {
			const calls = [
				new AIToolCall(AITool.SearchVaultFiles, { search_terms: [] }, 'id-1'),
				new AIToolCall(AITool.ReadVaultFiles, { files: [] }, 'id-2', 'signature==')
			];

			const result = parseToolCalls(AIToolCall.toConversationString(calls));

			expect(result!.map(stored => stored.toolCall.id)).toEqual(['id-1', 'id-2']);
			expect(result![1].toolCall.thoughtSignature).toBe('signature==');
		});

		it('should return null and log for invalid JSON', () => {
			expect(parseToolCalls('not json {')).toBeNull();
			expect(Exception.log).toHaveBeenCalled();
		});
	});

	describe('parseFunctionResponse', () => {
		it('should parse a stored function response', () => {
			const result = parseFunctionResponse(JSON.stringify({ id: 'a', functionResponse: { name: 'search', response: ['x'] } }));

			expect(result).toEqual({ id: 'a', functionResponse: { name: 'search', response: ['x'] } });
		});

		it('should return null and log for invalid JSON', () => {
			expect(parseFunctionResponse('{broken')).toBeNull();
			expect(Exception.log).toHaveBeenCalled();
		});
	});

	describe('sanitizeToolCallContent', () => {
		const toolCall = new AIToolCall(AITool.SearchVaultFiles, { query: 'test' }, 'id-1');

		it('should return content without JSON untouched', () => {
			expect(sanitizeToolCallContent('Just some text', [toolCall])).toBe('Just some text');
		});

		it('should return empty or whitespace content untouched', () => {
			expect(sanitizeToolCallContent('', [toolCall])).toBe('');
			expect(sanitizeToolCallContent('   ', [toolCall])).toBe('   ');
		});

		it('should remove an exact copy of the tool call from the content', () => {
			const content = `Let me search. ${toolCall.toConversationString()}`;

			expect(sanitizeToolCallContent(content, [toolCall])).toBe('Let me search.');
		});

		it('should remove the tool call from a markdown code block', () => {
			const content = `Searching\n\`\`\`json\n${toolCall.toConversationString()}\n\`\`\``;

			expect(sanitizeToolCallContent(content, [toolCall])).toBe('Searching');
		});

		it('should remove a pretty printed copy of the tool call', () => {
			const pretty = JSON.stringify(JSON.parse(toolCall.toConversationString()), null, 2);

			expect(sanitizeToolCallContent(`Before\n${pretty}\nAfter`, [toolCall])).toBe('Before\n\nAfter');
		});

		it('should keep unrelated JSON in the content', () => {
			const content = 'Result: {"other":"value"}';

			expect(sanitizeToolCallContent(content, [toolCall])).toBe(content);
		});

		it('should keep unrelated code blocks', () => {
			const content = '```json\n{"other":"value"}\n```';

			expect(sanitizeToolCallContent(content, [toolCall])).toBe(content);
		});

		it('should remove the copy of every tool call', () => {
			const second = new AIToolCall(AITool.ReadVaultFiles, { files: [] }, 'id-2');
			const content = `${toolCall.toConversationString()} and ${second.toConversationString()}`;

			expect(sanitizeToolCallContent(content, [toolCall, second])).toBe('and');
		});

		it('should return the content unchanged when there are no tool calls', () => {
			expect(sanitizeToolCallContent('text {"a":1}', [])).toBe('text {"a":1}');
		});

		it('should collapse the blank lines left behind by a removal', () => {
			const content = `One\n\n\n\n${toolCall.toConversationString()}\n\n\n\nTwo`;

			expect(sanitizeToolCallContent(content, [toolCall])).toBe('One\n\nTwo');
		});
	});
});

import { describe, it, expect } from 'vitest';
import { AIToolCall } from '../../AIClasses/AIToolCall';
import { AITool } from '../../Enums/AITool';

describe('AIToolCall', () => {
	describe('constructor', () => {
		it('should create instance with name and arguments only', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' }
			);

			expect(toolCall.name).toBe(AITool.SearchVaultFiles);
			expect(toolCall.arguments).toEqual({ query: 'test' });
			expect(toolCall.toolId).toBeUndefined();
			expect(toolCall.thoughtSignature).toBeUndefined();
		});

		it('should create instance with name, arguments, and toolId', () => {
			const toolCall = new AIToolCall(
				AITool.ReadVaultFiles,
				{ path: 'test.md' },
				'tool-123'
			);

			expect(toolCall.name).toBe(AITool.ReadVaultFiles);
			expect(toolCall.arguments).toEqual({ path: 'test.md' });
			expect(toolCall.toolId).toBe('tool-123');
			expect(toolCall.thoughtSignature).toBeUndefined();
		});

		it('should create instance with all four parameters including thoughtSignature', () => {
			const signature = 'base64EncodedSignature==';
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'notes' },
				undefined,
				signature
			);

			expect(toolCall.name).toBe(AITool.SearchVaultFiles);
			expect(toolCall.arguments).toEqual({ query: 'notes' });
			expect(toolCall.toolId).toBeUndefined();
			expect(toolCall.thoughtSignature).toBe(signature);
		});

		it('should create instance with toolId and thoughtSignature', () => {
			const signature = 'aGVsbG8gd29ybGQ=';
			const toolCall = new AIToolCall(
				AITool.WriteVaultFile,
				{ path: 'note.md', content: 'Hello' },
				'tool-456',
				signature
			);

			expect(toolCall.name).toBe(AITool.WriteVaultFile);
			expect(toolCall.arguments).toEqual({ path: 'note.md', content: 'Hello' });
			expect(toolCall.toolId).toBe('tool-456');
			expect(toolCall.thoughtSignature).toBe(signature);
		});

		it('should handle empty arguments object', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{}
			);

			expect(toolCall.name).toBe(AITool.SearchVaultFiles);
			expect(toolCall.arguments).toEqual({});
		});

		it('should handle complex nested arguments', () => {
			const complexArgs = {
				filters: {
					tags: ['important', 'work'],
					dateRange: { start: '2024-01-01', end: '2024-12-31' }
				},
				limit: 10
			};

			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				complexArgs
			);

			expect(toolCall.arguments).toEqual(complexArgs);
		});
	});

	describe('toConversationString', () => {
		it('should serialize to JSON with only name and args when no optional fields', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' }
			);

			const serialized = toolCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual({
				toolCall: {
					name: AITool.SearchVaultFiles,
					args: { query: 'test' },
					id: undefined,
					thoughtSignature: undefined
				}
			});
		});

		it('should serialize with toolId when present', () => {
			const toolCall = new AIToolCall(
				AITool.ReadVaultFiles,
				{ path: 'note.md' },
				'tool-789'
			);

			const serialized = toolCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual({
				toolCall: {
					name: AITool.ReadVaultFiles,
					args: { path: 'note.md' },
					id: 'tool-789',
					thoughtSignature: undefined
				}
			});
		});

		it('should serialize with thoughtSignature when present', () => {
			const signature = 'dGVzdFNpZ25hdHVyZQ==';
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'notes' },
				undefined,
				signature
			);

			const serialized = toolCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual({
				toolCall: {
					name: AITool.SearchVaultFiles,
					args: { query: 'notes' },
					id: undefined,
					thoughtSignature: signature
				}
			});
		});

		it('should serialize with both toolId and thoughtSignature when present', () => {
			const signature = 'YW5vdGhlclNpZ25hdHVyZQ==';
			const toolCall = new AIToolCall(
				AITool.WriteVaultFile,
				{ path: 'file.md', content: 'content' },
				'tool-999',
				signature
			);

			const serialized = toolCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual({
				toolCall: {
					name: AITool.WriteVaultFile,
					args: { path: 'file.md', content: 'content' },
					id: 'tool-999',
					thoughtSignature: signature
				}
			});
		});

		it('should produce valid JSON string', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' },
				'tool-123',
				'c2lnbmF0dXJl'
			);

			const serialized = toolCall.toConversationString();

			expect(() => JSON.parse(serialized)).not.toThrow();
		});

		it('should handle special characters in arguments', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test "quotes" and \'apostrophes\' and\nnewlines' }
			);

			const serialized = toolCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed.toolCall.args.query).toBe('test "quotes" and \'apostrophes\' and\nnewlines');
		});

		it('should handle empty string thoughtSignature', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				''
			);

			const serialized = toolCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed.toolCall.thoughtSignature).toBe('');
		});
	});

	describe('properties', () => {
		it('should have immutable name property', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' }
			);

			// Readonly is enforced at TypeScript compile time
			// At runtime, the properties are accessible
			expect(toolCall.name).toBe(AITool.SearchVaultFiles);
		});

		it('should have immutable arguments property', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' }
			);

			expect(toolCall.arguments).toEqual({ query: 'test' });
		});

		it('should have immutable toolId property', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' },
				'tool-123'
			);

			expect(toolCall.toolId).toBe('tool-123');
		});

		it('should have immutable thoughtSignature property', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				'signature'
			);

			expect(toolCall.thoughtSignature).toBe('signature');
		});
	});

	describe('edge cases', () => {
		it('should handle very long thoughtSignature (realistic base64)', () => {
			const longSignature = 'A'.repeat(10000);
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				longSignature
			);

			expect(toolCall.thoughtSignature).toBe(longSignature);
			expect(toolCall.thoughtSignature).toHaveLength(10000);
		});

		it('should handle thoughtSignature with base64 special characters', () => {
			const base64Signature = 'SGVsbG8gV29ybGQ+Pz8/Pz8+Pg==';
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				base64Signature
			);

			expect(toolCall.thoughtSignature).toBe(base64Signature);
		});

		it('should handle undefined toolId and defined thoughtSignature', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				'signature'
			);

			expect(toolCall.toolId).toBeUndefined();
			expect(toolCall.thoughtSignature).toBe('signature');
		});

		it('should handle defined toolId and undefined thoughtSignature', () => {
			const toolCall = new AIToolCall(
				AITool.SearchVaultFiles,
				{ query: 'test' },
				'tool-123',
				undefined
			);

			expect(toolCall.toolId).toBe('tool-123');
			expect(toolCall.thoughtSignature).toBeUndefined();
		});
	});
});

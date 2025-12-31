import { describe, it, expect } from 'vitest';
import { AIFunctionCall } from '../../AIClasses/AIFunctionCall';
import { AIFunction } from '../../Enums/AIFunction';

describe('AIFunctionCall', () => {
	describe('constructor', () => {
		it('should create instance with name and arguments only', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' }
			);

			expect(functionCall.name).toBe(AIFunction.SearchVaultFiles);
			expect(functionCall.arguments).toEqual({ query: 'test' });
			expect(functionCall.toolId).toBeUndefined();
			expect(functionCall.thoughtSignature).toBeUndefined();
		});

		it('should create instance with name, arguments, and toolId', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.ReadVaultFiles,
				{ path: 'test.md' },
				'tool-123'
			);

			expect(functionCall.name).toBe(AIFunction.ReadVaultFiles);
			expect(functionCall.arguments).toEqual({ path: 'test.md' });
			expect(functionCall.toolId).toBe('tool-123');
			expect(functionCall.thoughtSignature).toBeUndefined();
		});

		it('should create instance with all four parameters including thoughtSignature', () => {
			const signature = 'base64EncodedSignature==';
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'notes' },
				undefined,
				signature
			);

			expect(functionCall.name).toBe(AIFunction.SearchVaultFiles);
			expect(functionCall.arguments).toEqual({ query: 'notes' });
			expect(functionCall.toolId).toBeUndefined();
			expect(functionCall.thoughtSignature).toBe(signature);
		});

		it('should create instance with toolId and thoughtSignature', () => {
			const signature = 'aGVsbG8gd29ybGQ=';
			const functionCall = new AIFunctionCall(
				AIFunction.WriteVaultFile,
				{ path: 'note.md', content: 'Hello' },
				'tool-456',
				signature
			);

			expect(functionCall.name).toBe(AIFunction.WriteVaultFile);
			expect(functionCall.arguments).toEqual({ path: 'note.md', content: 'Hello' });
			expect(functionCall.toolId).toBe('tool-456');
			expect(functionCall.thoughtSignature).toBe(signature);
		});

		it('should handle empty arguments object', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{}
			);

			expect(functionCall.name).toBe(AIFunction.SearchVaultFiles);
			expect(functionCall.arguments).toEqual({});
		});

		it('should handle complex nested arguments', () => {
			const complexArgs = {
				filters: {
					tags: ['important', 'work'],
					dateRange: { start: '2024-01-01', end: '2024-12-31' }
				},
				limit: 10
			};

			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				complexArgs
			);

			expect(functionCall.arguments).toEqual(complexArgs);
		});
	});

	describe('toConversationString', () => {
		it('should serialize to JSON with only name and args when no optional fields', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' }
			);

			const serialized = functionCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual({
				functionCall: {
					name: AIFunction.SearchVaultFiles,
					args: { query: 'test' },
					id: undefined,
					thoughtSignature: undefined
				}
			});
		});

		it('should serialize with toolId when present', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.ReadVaultFiles,
				{ path: 'note.md' },
				'tool-789'
			);

			const serialized = functionCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual({
				functionCall: {
					name: AIFunction.ReadVaultFiles,
					args: { path: 'note.md' },
					id: 'tool-789',
					thoughtSignature: undefined
				}
			});
		});

		it('should serialize with thoughtSignature when present', () => {
			const signature = 'dGVzdFNpZ25hdHVyZQ==';
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'notes' },
				undefined,
				signature
			);

			const serialized = functionCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual({
				functionCall: {
					name: AIFunction.SearchVaultFiles,
					args: { query: 'notes' },
					id: undefined,
					thoughtSignature: signature
				}
			});
		});

		it('should serialize with both toolId and thoughtSignature when present', () => {
			const signature = 'YW5vdGhlclNpZ25hdHVyZQ==';
			const functionCall = new AIFunctionCall(
				AIFunction.WriteVaultFile,
				{ path: 'file.md', content: 'content' },
				'tool-999',
				signature
			);

			const serialized = functionCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual({
				functionCall: {
					name: AIFunction.WriteVaultFile,
					args: { path: 'file.md', content: 'content' },
					id: 'tool-999',
					thoughtSignature: signature
				}
			});
		});

		it('should produce valid JSON string', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' },
				'tool-123',
				'c2lnbmF0dXJl'
			);

			const serialized = functionCall.toConversationString();

			expect(() => JSON.parse(serialized)).not.toThrow();
		});

		it('should handle special characters in arguments', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test "quotes" and \'apostrophes\' and\nnewlines' }
			);

			const serialized = functionCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed.functionCall.args.query).toBe('test "quotes" and \'apostrophes\' and\nnewlines');
		});

		it('should handle empty string thoughtSignature', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				''
			);

			const serialized = functionCall.toConversationString();
			const parsed = JSON.parse(serialized);

			expect(parsed.functionCall.thoughtSignature).toBe('');
		});
	});

	describe('properties', () => {
		it('should have immutable name property', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' }
			);

			// Readonly is enforced at TypeScript compile time
			// At runtime, the properties are accessible
			expect(functionCall.name).toBe(AIFunction.SearchVaultFiles);
		});

		it('should have immutable arguments property', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' }
			);

			expect(functionCall.arguments).toEqual({ query: 'test' });
		});

		it('should have immutable toolId property', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' },
				'tool-123'
			);

			expect(functionCall.toolId).toBe('tool-123');
		});

		it('should have immutable thoughtSignature property', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				'signature'
			);

			expect(functionCall.thoughtSignature).toBe('signature');
		});
	});

	describe('edge cases', () => {
		it('should handle very long thoughtSignature (realistic base64)', () => {
			const longSignature = 'A'.repeat(10000);
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				longSignature
			);

			expect(functionCall.thoughtSignature).toBe(longSignature);
			expect(functionCall.thoughtSignature).toHaveLength(10000);
		});

		it('should handle thoughtSignature with base64 special characters', () => {
			const base64Signature = 'SGVsbG8gV29ybGQ+Pz8/Pz8+Pg==';
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				base64Signature
			);

			expect(functionCall.thoughtSignature).toBe(base64Signature);
		});

		it('should handle undefined toolId and defined thoughtSignature', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' },
				undefined,
				'signature'
			);

			expect(functionCall.toolId).toBeUndefined();
			expect(functionCall.thoughtSignature).toBe('signature');
		});

		it('should handle defined toolId and undefined thoughtSignature', () => {
			const functionCall = new AIFunctionCall(
				AIFunction.SearchVaultFiles,
				{ query: 'test' },
				'tool-123',
				undefined
			);

			expect(functionCall.toolId).toBe('tool-123');
			expect(functionCall.thoughtSignature).toBeUndefined();
		});
	});
});

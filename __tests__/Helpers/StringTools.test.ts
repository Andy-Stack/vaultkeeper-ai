import { describe, it, expect } from 'vitest';
import { StringTools } from '../../Helpers/StringTools';

describe('StringTools', () => {
	describe('serialPatch', () => {
		it('should apply a single exact edit', () => {
			const result = StringTools.serialPatch('hello world', [{ old_content: 'world', new_content: 'there' }]);

			expect(result).toEqual({ result: 'hello there', patched: true, failure: '' });
		});

		it('should apply edits in order so later edits see earlier results', () => {
			const result = StringTools.serialPatch('a', [
				{ old_content: 'a', new_content: 'b' },
				{ old_content: 'b', new_content: 'c' }
			]);

			expect(result.result).toBe('c');
			expect(result.patched).toBe(true);
		});

		it('should only replace the first occurrence by default', () => {
			const result = StringTools.serialPatch('x y x y x', [{ old_content: 'x', new_content: 'z' }]);

			expect(result.result).toBe('z y x y x');
		});

		it('should replace every occurrence when replace_all is set', () => {
			const result = StringTools.serialPatch('x y x y x', [{ old_content: 'x', new_content: 'z', replace_all: true }]);

			expect(result.result).toBe('z y z y z');
		});

		it('should prefer an exact match over a whitespace-flexible match', () => {
			const result = StringTools.serialPatch('a  b\na b', [{ old_content: 'a b', new_content: 'X' }]);

			expect(result.result).toBe('a  b\nX');
		});

		it('should fall back to whitespace-flexible matching', () => {
			const result = StringTools.serialPatch('line one\n\n    line two', [{ old_content: 'line one line two', new_content: 'merged' }]);

			expect(result).toEqual({ result: 'merged', patched: true, failure: '' });
		});

		it('should replace every whitespace-flexible occurrence when replace_all is set', () => {
			const result = StringTools.serialPatch('a  b and a\tb', [{ old_content: 'a b', new_content: 'X', replace_all: true }]);

			expect(result.result).toBe('X and X');
		});

		it('should be strict about non-whitespace characters', () => {
			const result = StringTools.serialPatch('a-b', [{ old_content: 'a b', new_content: 'X' }]);

			expect(result.patched).toBe(false);
		});

		it('should treat regex characters in old content literally', () => {
			const result = StringTools.serialPatch('cost is $5.00 (approx)', [{ old_content: '$5.00 (approx)', new_content: '$6' }]);

			expect(result.result).toBe('cost is $6');
		});

		it('should insert new content containing replacement patterns literally', () => {
			const result = StringTools.serialPatch('price', [{ old_content: 'price', new_content: '$& costs $1' }]);

			expect(result.result).toBe('$& costs $1');
		});

		it('should return the original content and the failing edit when an edit does not match', () => {
			const result = StringTools.serialPatch('original', [
				{ old_content: 'original', new_content: 'changed' },
				{ old_content: 'missing', new_content: 'x' }
			]);

			expect(result).toEqual({ result: 'original', patched: false, failure: 'missing' });
		});

		it('should succeed unchanged when there are no edits', () => {
			expect(StringTools.serialPatch('same', [])).toEqual({ result: 'same', patched: true, failure: '' });
		});

		it('should allow deleting content by replacing with an empty string', () => {
			const result = StringTools.serialPatch('keep remove keep', [{ old_content: ' remove', new_content: '' }]);

			expect(result.result).toBe('keep keep');
		});
	});

	describe('isValidJson', () => {
		it.each(['{}', '[]', '"text"', '123', 'null', '{"a":[1,2]}'])('should accept %s', (input) => {
			expect(StringTools.isValidJson(input)).toBe(true);
		});

		it.each(['', 'not json', '{a:1}', '[1,2', "{'a':1}"])('should reject %j', (input) => {
			expect(StringTools.isValidJson(input)).toBe(false);
		});
	});

	describe('dateToString', () => {
		const date = new Date(2024, 0, 5, 9, 7, 3);

		it('should include the time by default using hyphens', () => {
			expect(StringTools.dateToString(date)).toBe('2024-01-05-09-07-03');
		});

		it('should omit the time when requested', () => {
			expect(StringTools.dateToString(date, false)).toBe('2024-01-05');
		});
	});

	describe('deriveFileName', () => {
		it('should use the first non-empty line', () => {
			expect(StringTools.deriveFileName('\n\n  Meeting notes  \nsecond line')).toBe('Meeting notes');
		});

		it('should strip punctuation but keep hyphens and unicode letters', () => {
			expect(StringTools.deriveFileName('Hello, wörld! A-B?')).toBe('Hello wörld A-B');
		});

		it('should collapse repeated whitespace', () => {
			expect(StringTools.deriveFileName('a    b \t c')).toBe('a b c');
		});

		it('should return the default fallback for empty or punctuation-only text', () => {
			expect(StringTools.deriveFileName('')).toBe('Pasted text');
			expect(StringTools.deriveFileName('   \n  ')).toBe('Pasted text');
			expect(StringTools.deriveFileName('!!! ???')).toBe('Pasted text');
		});

		it('should use a custom fallback', () => {
			expect(StringTools.deriveFileName('', 40, 'Untitled')).toBe('Untitled');
		});

		it('should truncate at a word boundary', () => {
			expect(StringTools.deriveFileName('alpha beta gamma delta', 12)).toBe('alpha beta');
		});

		it('should hard truncate a single long word', () => {
			expect(StringTools.deriveFileName('abcdefghijklmnop', 5)).toBe('abcde');
		});

		it('should not truncate text at exactly the maximum length', () => {
			expect(StringTools.deriveFileName('abcde fghi', 10)).toBe('abcde fghi');
		});
	});

	describe('pluralise', () => {
		it('should only keep the singular for a count of one', () => {
			expect(StringTools.pluralise('file', 1)).toBe('file');
			expect(StringTools.pluralise('file', 0)).toBe('files');
			expect(StringTools.pluralise('file', 2)).toBe('files');
		});
	});

	describe('base64 conversion', () => {
		it('should round trip ascii text', () => {
			const encoded = StringTools.toBase64('hello');

			expect(encoded).toBe('aGVsbG8=');
			expect(new TextDecoder().decode(StringTools.toBytes(encoded))).toBe('hello');
		});

		it('should round trip multi-byte unicode text', () => {
			const text = 'héllo wörld — 日本語 🎉';

			const encoded = StringTools.toBase64(text);

			expect(new TextDecoder().decode(StringTools.toBytes(encoded))).toBe(text);
		});

		it('should convert base64 to an array buffer of the same bytes', () => {
			const buffer = StringTools.toBuffer('AQID');

			expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3]);
		});

		it('should handle empty strings', () => {
			expect(StringTools.toBase64('')).toBe('');
			expect(StringTools.toBytes('').length).toBe(0);
		});
	});

	describe('computeSHA256Hash', () => {
		it('should hash the decoded bytes of the base64 content', async () => {
			// SHA-256 of the ascii bytes "hello"
			const hash = await StringTools.computeSHA256Hash(StringTools.toBase64('hello'));

			expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
		});

		it('should produce different hashes for different content', async () => {
			const first = await StringTools.computeSHA256Hash(StringTools.toBase64('a'));
			const second = await StringTools.computeSHA256Hash(StringTools.toBase64('b'));

			expect(first).not.toBe(second);
		});
	});
});

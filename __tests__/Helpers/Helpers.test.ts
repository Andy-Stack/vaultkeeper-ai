import { describe, it, expect } from 'vitest';
import { StringTools } from "../../Helpers/StringTools";
import { RegexTools } from "../../Helpers/RegexTools";
import { splitFrontmatter } from '../../Helpers/Helpers';

describe('Helpers', () => {
	describe('dateToString', () => {
		it('should format date with time by default', () => {
			const date = new Date('2024-01-15T14:30:45');
			const result = StringTools.dateToString(date);

			// Format should be YYYY-MM-DD-HH-MM-SS (sv-SE locale with colons and spaces replaced)
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
			expect(result).toContain('2024');
			expect(result).toContain('01');
			expect(result).toContain('15');
		});

		it('should format date without time when includeTime is false', () => {
			const date = new Date('2024-01-15T14:30:45');
			const result = StringTools.dateToString(date, false);

			// Format should be YYYY-MM-DD
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(result).toContain('2024');
			expect(result).toContain('01');
			expect(result).toContain('15');
			expect(result).not.toContain('14'); // Should not include time
		});

		it('should use sv-SE locale for consistent formatting', () => {
			const date = new Date('2024-03-05T09:08:07');
			const result = StringTools.dateToString(date);

			// sv-SE uses YYYY-MM-DD format with leading zeros
			expect(result.startsWith('2024-03-05')).toBe(true);
		});

		it('should replace colons and spaces with hyphens', () => {
			const date = new Date('2024-01-15T14:30:45');
			const result = StringTools.dateToString(date);

			// Should not contain colons or spaces
			expect(result).not.toContain(':');
			expect(result).not.toContain(' ');
			// Should be all hyphens and digits
			expect(result).toMatch(/^[\d-]+$/);
		});

		it('should handle midnight correctly', () => {
			const date = new Date('2024-01-15T00:00:00');
			const result = StringTools.dateToString(date);

			expect(result).toContain('00-00-00');
		});

		it('should handle end of day correctly', () => {
			const date = new Date('2024-01-15T23:59:59');
			const result = StringTools.dateToString(date);

			expect(result).toContain('23-59-59');
		});

		it('should pad single-digit months and days', () => {
			const date = new Date('2024-03-05T09:08:07');
			const result = StringTools.dateToString(date);

			// Should have leading zeros
			expect(result).toContain('03');
			expect(result).toContain('05');
			expect(result).toContain('09');
			expect(result).toContain('08');
			expect(result).toContain('07');
		});

		it('should handle different years', () => {
			const date1 = new Date('2020-01-01T00:00:00');
			const date2 = new Date('2030-12-31T23:59:59');

			expect(StringTools.dateToString(date1, false)).toContain('2020');
			expect(StringTools.dateToString(date2, false)).toContain('2030');
		});
	});

	describe('isValidJson', () => {
		it('should return true for valid JSON object', () => {
			expect(StringTools.isValidJson('{"key": "value"}')).toBe(true);
		});

		it('should return true for valid JSON array', () => {
			expect(StringTools.isValidJson('[1, 2, 3]')).toBe(true);
		});

		it('should return true for valid JSON string', () => {
			expect(StringTools.isValidJson('"hello"')).toBe(true);
		});

		it('should return true for valid JSON number', () => {
			expect(StringTools.isValidJson('123')).toBe(true);
		});

		it('should return true for valid JSON boolean', () => {
			expect(StringTools.isValidJson('true')).toBe(true);
			expect(StringTools.isValidJson('false')).toBe(true);
		});

		it('should return true for valid JSON null', () => {
			expect(StringTools.isValidJson('null')).toBe(true);
		});

		it('should return true for complex nested JSON', () => {
			const json = '{"a":{"b":{"c":[1,2,3]}}}';
			expect(StringTools.isValidJson(json)).toBe(true);
		});

		it('should return false for invalid JSON with syntax error', () => {
			expect(StringTools.isValidJson('{"key": value}')).toBe(false); // Missing quotes
		});

		it('should return false for invalid JSON with trailing comma', () => {
			expect(StringTools.isValidJson('{"key": "value",}')).toBe(false);
		});

		it('should return false for unclosed braces', () => {
			expect(StringTools.isValidJson('{"key": "value"')).toBe(false);
		});

		it('should return false for single quotes instead of double quotes', () => {
			expect(StringTools.isValidJson("{'key': 'value'}")).toBe(false);
		});

		it('should return false for empty string', () => {
			expect(StringTools.isValidJson('')).toBe(false);
		});

		it('should return false for random text', () => {
			expect(StringTools.isValidJson('not json at all')).toBe(false);
		});

		it('should return false for undefined keywords', () => {
			expect(StringTools.isValidJson('undefined')).toBe(false);
		});

		it('should handle whitespace in valid JSON', () => {
			expect(StringTools.isValidJson('  {"key": "value"}  ')).toBe(true);
		});

		it('should handle newlines in valid JSON', () => {
			expect(StringTools.isValidJson('{\n  "key": "value"\n}')).toBe(true);
		});
	});

	describe('escapeRegex', () => {
		it('should escape dot', () => {
			expect(RegexTools.escapeRegex('.')).toBe('\\.');
		});

		it('should escape asterisk', () => {
			expect(RegexTools.escapeRegex('*')).toBe('\\*');
		});

		it('should escape plus', () => {
			expect(RegexTools.escapeRegex('+')).toBe('\\+');
		});

		it('should escape question mark', () => {
			expect(RegexTools.escapeRegex('?')).toBe('\\?');
		});

		it('should escape caret', () => {
			expect(RegexTools.escapeRegex('^')).toBe('\\^');
		});

		it('should escape dollar sign', () => {
			expect(RegexTools.escapeRegex('$')).toBe('\\$');
		});

		it('should escape curly braces', () => {
			expect(RegexTools.escapeRegex('{}')).toBe('\\{\\}');
		});

		it('should escape parentheses', () => {
			expect(RegexTools.escapeRegex('()')).toBe('\\(\\)');
		});

		it('should escape pipe', () => {
			expect(RegexTools.escapeRegex('|')).toBe('\\|');
		});

		it('should escape square brackets', () => {
			expect(RegexTools.escapeRegex('[]')).toBe('\\[\\]');
		});

		it('should escape backslash', () => {
			expect(RegexTools.escapeRegex('\\')).toBe('\\\\');
		});

		it('should escape all special regex characters at once', () => {
			const input = '.*+?^${}()|[]\\';
			const escaped = RegexTools.escapeRegex(input);

			// Should be able to use in RegExp without error
			expect(() => new RegExp(escaped)).not.toThrow();

			// Should match the literal string, not use regex features
			const regex = new RegExp(escaped);
			expect(regex.test(input)).toBe(true);
		});

		it('should not escape normal characters', () => {
			expect(RegexTools.escapeRegex('abc123')).toBe('abc123');
		});

		it('should handle mixed text with special characters', () => {
			const input = 'file.*.txt';
			const escaped = RegexTools.escapeRegex(input);

			expect(escaped).toBe('file\\.\\*\\.txt');

			const regex = new RegExp(escaped);
			expect(regex.test('file.*.txt')).toBe(true);
			expect(regex.test('fileXXX.txt')).toBe(false); // Should not match as wildcard
		});

		it('should handle empty string', () => {
			expect(RegexTools.escapeRegex('')).toBe('');
		});

		it('should handle string with only special characters', () => {
			const input = '???***';
			const escaped = RegexTools.escapeRegex(input);

			expect(escaped).toBe('\\?\\?\\?\\*\\*\\*');
		});

		it('should make regex patterns literal', () => {
			const patterns = ['.*', 'a+', 'b?', '^start', 'end$', '(group)'];

			patterns.forEach(pattern => {
				const escaped = RegexTools.escapeRegex(pattern);
				const regex = new RegExp(escaped);

				// Should match the literal pattern string, not behave as regex
				expect(regex.test(pattern)).toBe(true);
			});
		});
	});

	describe('toWhitespaceFlexibleRegex', () => {
		it('matches a single space in the input where the source had a single space', () => {
			const regex = RegexTools.toWhitespaceFlexibleRegex('foo bar');
			expect(regex.test('foo bar')).toBe(true);
		});

		it('matches when whitespace differs in kind or amount', () => {
			const regex = RegexTools.toWhitespaceFlexibleRegex('foo bar');
			expect(regex.test('foo    bar')).toBe(true);
			expect(regex.test('foo\tbar')).toBe(true);
			expect(regex.test('foo\nbar')).toBe(true);
		});

		it('matches multiple runs of whitespace independently', () => {
			const regex = RegexTools.toWhitespaceFlexibleRegex('a b c');
			expect(regex.test('a  b   c')).toBe(true);
		});

		it('does not match when non-whitespace characters differ', () => {
			const regex = RegexTools.toWhitespaceFlexibleRegex('foo bar');
			expect(regex.test('foo baz')).toBe(false);
		});

		it('still escapes special regex characters outside of whitespace', () => {
			const regex = RegexTools.toWhitespaceFlexibleRegex('a.b (c)');
			expect(regex.test('a.b (c)')).toBe(true);
			expect(regex.test('aXb (c)')).toBe(false);
		});

		it('requires whitespace to be present where the source had whitespace', () => {
			const regex = RegexTools.toWhitespaceFlexibleRegex('foo bar');
			expect(regex.test('foobar')).toBe(false);
		});

		it('handles input with no whitespace', () => {
			const regex = RegexTools.toWhitespaceFlexibleRegex('foobar');
			expect(regex.test('foobar')).toBe(true);
			expect(regex.test('foo bar')).toBe(false);
		});

		it('handles empty string input', () => {
			const regex = RegexTools.toWhitespaceFlexibleRegex('');
			expect(regex.test('')).toBe(true);
		});
	});

	describe('asRegex', () => {
		it('compiles a valid regex pattern', () => {
			const result = RegexTools.asRegex('foo.*bar', []);
			expect(result).not.toBeInstanceOf(Error);
			expect((result as RegExp).test('fooXXXbar')).toBe(true);
		});

		it('applies required flags that are missing', () => {
			const result = RegexTools.asRegex('foo', ['i']);
			expect(result).not.toBeInstanceOf(Error);
			expect((result as RegExp).flags).toContain('i');
			expect((result as RegExp).test('FOO')).toBe(true);
		});

		it('does not duplicate a flag that is already present', () => {
			const result = RegexTools.asRegex('/foo/i', ['i']);
			expect(result).not.toBeInstanceOf(Error);
			expect((result as RegExp).flags.match(/i/g)?.length).toBe(1);
		});

		it('falls back to treating invalid regex syntax as literal text', () => {
			const result = RegexTools.asRegex('(unclosed', []);
			expect(result).not.toBeInstanceOf(Error);
			expect((result as RegExp).test('(unclosed')).toBe(true);
		});

		it('returns an Error for a pattern that matches the empty string', () => {
			const result = RegexTools.asRegex('.*', []);
			expect(result).toBeInstanceOf(Error);
		});
	});

	describe('extractRegexLiterals', () => {
		it('extracts a plain literal string with no special characters', () => {
			expect(RegexTools.extractRegexLiterals('foobar')).toEqual(['foobar']);
		});

		it('accepts a RegExp instance as well as a pattern string', () => {
			expect(RegexTools.extractRegexLiterals(/foobar/)).toEqual(['foobar']);
		});

		it('splits the run at an optional atom, dropping the optional character', () => {
			expect(RegexTools.extractRegexLiterals('foob?ar')).toEqual(['foo', 'ar']);
		});

		it('splits the run around a character class', () => {
			expect(RegexTools.extractRegexLiterals('foo[abc]bar')).toEqual(['foo', 'bar']);
		});

		it('splits the run around a capturing group and recurses into it', () => {
			expect(RegexTools.extractRegexLiterals('foo(bar)baz')).toEqual(['foo', 'bar', 'baz']);
		});

		it('splits alternatives inside a group into separate literals', () => {
			expect(RegexTools.extractRegexLiterals('foo(bar|baz)qux')).toEqual(['foo', 'bar', 'baz', 'qux']);
		});

		it('expands a fixed-count quantifier on a single character into repeated characters', () => {
			expect(RegexTools.extractRegexLiterals('a{3}b')).toEqual(['aaab']);
		});

		it('splits the run when a quantifier has a variable count', () => {
			expect(RegexTools.extractRegexLiterals('a{2,4}b')).toEqual(['aa', 'b']);
		});

		it('recurses into a positive lookahead', () => {
			expect(RegexTools.extractRegexLiterals('foo(?=bar)')).toEqual(['foo', 'bar']);
		});

		it('does not recurse into a negative lookahead', () => {
			expect(RegexTools.extractRegexLiterals('foo(?!bar)baz')).toEqual(['foo', 'baz']);
		});

		it('splits the run around a backreference', () => {
			expect(RegexTools.extractRegexLiterals('(foo)\\1bar')).toEqual(['foo', 'bar']);
		});

		it('returns an empty array for a pattern with no literal characters', () => {
			expect(RegexTools.extractRegexLiterals('[abc]+')).toEqual([]);
		});
	});

	describe('splitFrontmatter', () => {
		it('returns empty frontmatter and the whole content as body when no frontmatter is present', () => {
			const content = '# Heading\n\nSome body text.';
			const result = splitFrontmatter(content);
			expect(result.frontmatter).toBe('');
			expect(result.body).toBe(content);
		});

		it('splits a standard frontmatter block from the body', () => {
			const content = '---\ntitle: My Note\ntags: [a, b]\n---\n# Heading\n\nBody text.';
			const result = splitFrontmatter(content);
			expect(result.frontmatter).toBe('---\ntitle: My Note\ntags: [a, b]\n---\n');
			expect(result.body).toBe('# Heading\n\nBody text.');
		});

		it('handles CRLF line endings', () => {
			const content = '---\r\ntitle: My Note\r\n---\r\nBody text.';
			const result = splitFrontmatter(content);
			expect(result.frontmatter).toBe('---\r\ntitle: My Note\r\n---\r\n');
			expect(result.body).toBe('Body text.');
		});

		it('handles a closing frontmatter line that has no trailing newline', () => {
			const content = '---\ntitle: My Note\n---';
			const result = splitFrontmatter(content);
			expect(result.frontmatter).toBe('---\ntitle: My Note\n---');
			expect(result.body).toBe('');
		});

		it('returns empty body when content is only frontmatter followed by a newline', () => {
			const content = '---\ntitle: My Note\n---\n';
			const result = splitFrontmatter(content);
			expect(result.frontmatter).toBe('---\ntitle: My Note\n---\n');
			expect(result.body).toBe('');
		});

		it('returns empty frontmatter and empty body for empty input', () => {
			const result = splitFrontmatter('');
			expect(result.frontmatter).toBe('');
			expect(result.body).toBe('');
		});

		it('does not treat a non-leading --- divider as frontmatter', () => {
			const content = '# Heading\n\n---\n\nA horizontal rule above.';
			const result = splitFrontmatter(content);
			expect(result.frontmatter).toBe('');
			expect(result.body).toBe(content);
		});

		it('preserves later --- dividers in the body when frontmatter is present', () => {
			const content = '---\ntitle: My Note\n---\nIntro paragraph.\n\n---\n\nSection after a horizontal rule.';
			const result = splitFrontmatter(content);
			expect(result.frontmatter).toBe('---\ntitle: My Note\n---\n');
			expect(result.body).toBe('Intro paragraph.\n\n---\n\nSection after a horizontal rule.');
		});

		it('reassembles to the original content', () => {
			const content = '---\ntitle: My Note\ntags: [a, b]\n---\n# Heading\n\nBody text with --- inside.';
			const result = splitFrontmatter(content);
			expect(result.frontmatter + result.body).toBe(content);
		});
	});
});

import { describe, it, expect, vi } from 'vitest';
import { StringTools } from "../../Helpers/StringTools";
import { randomSample, openPluginSettings, splitFrontmatter, mergeTagsIntoFrontmatter } from '../../Helpers/Helpers';

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

	describe('randomSample', () => {
		it('should return n elements when array has more than n elements', () => {
			const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const result = randomSample(array, 5);

			expect(result).toHaveLength(5);
		});

		it('should return all elements when n is greater than array length', () => {
			const array = [1, 2, 3];
			const result = randomSample(array, 10);

			expect(result).toHaveLength(3);
			expect(result.sort()).toEqual([1, 2, 3]);
		});

		it('should return all elements when n equals array length', () => {
			const array = [1, 2, 3, 4, 5];
			const result = randomSample(array, 5);

			expect(result).toHaveLength(5);
		});

		it('should return unique elements (no duplicates)', () => {
			const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const result = randomSample(array, 5);

			const uniqueResult = [...new Set(result)];
			expect(uniqueResult).toHaveLength(result.length);
		});

		it('should only return elements from the original array', () => {
			const array = ['a', 'b', 'c', 'd', 'e'];
			const result = randomSample(array, 3);

			result.forEach(item => {
				expect(array).toContain(item);
			});
		});

		it('should return empty array when n is 0', () => {
			const array = [1, 2, 3, 4, 5];
			const result = randomSample(array, 0);

			expect(result).toHaveLength(0);
		});

		it('should return empty array when input array is empty', () => {
			const array: number[] = [];
			const result = randomSample(array, 5);

			expect(result).toHaveLength(0);
		});

		it('should work with different data types', () => {
			const stringArray = ['a', 'b', 'c', 'd', 'e'];
			const objectArray = [{ id: 1 }, { id: 2 }, { id: 3 }];

			expect(randomSample(stringArray, 2)).toHaveLength(2);
			expect(randomSample(objectArray, 2)).toHaveLength(2);
		});

		it('should produce different samples on multiple calls (probabilistic)', () => {
			const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const samples = new Set<string>();

			// Run multiple times and check we get different results
			for (let i = 0; i < 10; i++) {
				const result = randomSample(array, 5);
				samples.add(JSON.stringify(result.sort()));
			}

			// It's extremely unlikely to get the same sample 10 times
			// (Though theoretically possible, so this is a probabilistic test)
			expect(samples.size).toBeGreaterThan(1);
		});

		it('should handle negative n gracefully', () => {
			const array = [1, 2, 3, 4, 5];
			const result = randomSample(array, -5);

			expect(result).toHaveLength(0);
		});
	});

	describe('escapeRegex', () => {
		it('should escape dot', () => {
			expect(StringTools.escapeRegex('.')).toBe('\\.');
		});

		it('should escape asterisk', () => {
			expect(StringTools.escapeRegex('*')).toBe('\\*');
		});

		it('should escape plus', () => {
			expect(StringTools.escapeRegex('+')).toBe('\\+');
		});

		it('should escape question mark', () => {
			expect(StringTools.escapeRegex('?')).toBe('\\?');
		});

		it('should escape caret', () => {
			expect(StringTools.escapeRegex('^')).toBe('\\^');
		});

		it('should escape dollar sign', () => {
			expect(StringTools.escapeRegex('$')).toBe('\\$');
		});

		it('should escape curly braces', () => {
			expect(StringTools.escapeRegex('{}')).toBe('\\{\\}');
		});

		it('should escape parentheses', () => {
			expect(StringTools.escapeRegex('()')).toBe('\\(\\)');
		});

		it('should escape pipe', () => {
			expect(StringTools.escapeRegex('|')).toBe('\\|');
		});

		it('should escape square brackets', () => {
			expect(StringTools.escapeRegex('[]')).toBe('\\[\\]');
		});

		it('should escape backslash', () => {
			expect(StringTools.escapeRegex('\\')).toBe('\\\\');
		});

		it('should escape all special regex characters at once', () => {
			const input = '.*+?^${}()|[]\\';
			const escaped = StringTools.escapeRegex(input);

			// Should be able to use in RegExp without error
			expect(() => new RegExp(escaped)).not.toThrow();

			// Should match the literal string, not use regex features
			const regex = new RegExp(escaped);
			expect(regex.test(input)).toBe(true);
		});

		it('should not escape normal characters', () => {
			expect(StringTools.escapeRegex('abc123')).toBe('abc123');
		});

		it('should handle mixed text with special characters', () => {
			const input = 'file.*.txt';
			const escaped = StringTools.escapeRegex(input);

			expect(escaped).toBe('file\\.\\*\\.txt');

			const regex = new RegExp(escaped);
			expect(regex.test('file.*.txt')).toBe(true);
			expect(regex.test('fileXXX.txt')).toBe(false); // Should not match as wildcard
		});

		it('should handle empty string', () => {
			expect(StringTools.escapeRegex('')).toBe('');
		});

		it('should handle string with only special characters', () => {
			const input = '???***';
			const escaped = StringTools.escapeRegex(input);

			expect(escaped).toBe('\\?\\?\\?\\*\\*\\*');
		});

		it('should make regex patterns literal', () => {
			const patterns = ['.*', 'a+', 'b?', '^start', 'end$', '(group)'];

			patterns.forEach(pattern => {
				const escaped = StringTools.escapeRegex(pattern);
				const regex = new RegExp(escaped);

				// Should match the literal pattern string, not behave as regex
				expect(regex.test(pattern)).toBe(true);
			});
		});
	});

	describe('openPluginSettings', () => {
		it('should call app.setting.open and openTabById', () => {
			const mockPlugin = {
				app: {
					setting: {
						open: vi.fn(),
						openTabById: vi.fn()
					}
				},
				manifest: {
					id: 'test-plugin-id'
				}
			} as any;

			openPluginSettings(mockPlugin);

			expect(mockPlugin.app.setting.open).toHaveBeenCalledOnce();
			expect(mockPlugin.app.setting.openTabById).toHaveBeenCalledWith('test-plugin-id');
		});

		it('should open settings tab with correct plugin id', () => {
			const pluginId = 'ai-agent-plugin';
			const mockPlugin = {
				app: {
					setting: {
						open: vi.fn(),
						openTabById: vi.fn()
					}
				},
				manifest: {
					id: pluginId
				}
			} as any;

			openPluginSettings(mockPlugin);

			expect(mockPlugin.app.setting.openTabById).toHaveBeenCalledWith(pluginId);
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

	describe('mergeTagsIntoFrontmatter', () => {
		it('returns content unchanged when there are no tags to add', () => {
			const content = '# Heading\n\nBody.';
			expect(mergeTagsIntoFrontmatter(content, [])).toBe(content);
		});

		it('returns content unchanged when all tags are empty after cleaning', () => {
			const content = '# Heading\n\nBody.';
			expect(mergeTagsIntoFrontmatter(content, ['', '  ', '#'])).toBe(content);
		});

		it('prepends new frontmatter when none exists', () => {
			const content = '# Heading\n\nBody.';
			const result = mergeTagsIntoFrontmatter(content, ['noble', 'inventor']);
			expect(result).toBe('---\ntags:\n  - noble\n  - inventor\n---\n# Heading\n\nBody.');
		});

		it('strips leading # from tag inputs', () => {
			const content = '# Heading\n\nBody.';
			const result = mergeTagsIntoFrontmatter(content, ['#noble', '#inventor']);
			expect(result).toBe('---\ntags:\n  - noble\n  - inventor\n---\n# Heading\n\nBody.');
		});

		it('deduplicates within the input list', () => {
			const content = '# Heading\n\nBody.';
			const result = mergeTagsIntoFrontmatter(content, ['noble', 'noble', '#noble']);
			expect(result).toBe('---\ntags:\n  - noble\n---\n# Heading\n\nBody.');
		});

		it('injects a tags field into existing frontmatter that lacks one', () => {
			const content = '---\ntitle: My Note\nrace: Human\n---\n# Heading\n\nBody.';
			const result = mergeTagsIntoFrontmatter(content, ['noble']);
			expect(result).toBe('---\ntitle: My Note\nrace: Human\ntags:\n  - noble\n---\n# Heading\n\nBody.');
		});

		it('merges into an existing block-style tags list and preserves other fields', () => {
			const content = '---\ntitle: My Note\ntags:\n  - existing\nrace: Human\n---\n# Heading\n\nBody.';
			const result = mergeTagsIntoFrontmatter(content, ['noble', 'inventor']);
			expect(result).toBe('---\ntitle: My Note\ntags:\n  - existing\n  - noble\n  - inventor\nrace: Human\n---\n# Heading\n\nBody.');
		});

		it('always writes added tags as a YAML list (Obsidian 1.9 requirement)', () => {
			const content = '# Heading\n\nBody.';
			const result = mergeTagsIntoFrontmatter(content, ['meeting', 'work', 'planning']);
			expect(result).toBe('---\ntags:\n  - meeting\n  - work\n  - planning\n---\n# Heading\n\nBody.');
		});

		it('merges into an existing inline tags list and normalises to block style', () => {
			const content = '---\ntitle: My Note\ntags: [existing, other]\nrace: Human\n---\n# Heading\n\nBody.';
			const result = mergeTagsIntoFrontmatter(content, ['noble']);
			expect(result).toBe('---\ntitle: My Note\ntags:\n  - existing\n  - other\n  - noble\nrace: Human\n---\n# Heading\n\nBody.');
		});

		it('repairs a comma-separated string value into a YAML list (Obsidian 1.9 breakage)', () => {
			const content = '---\ntags: meeting, work, planning\n---\n# Heading\n';
			const result = mergeTagsIntoFrontmatter(content, ['noble']);
			expect(result).toBe('---\ntags:\n  - meeting\n  - work\n  - planning\n  - noble\n---\n# Heading\n');
		});

		it('repairs a quoted comma-separated string value into a YAML list', () => {
			const content = '---\ntags: "meeting, work"\n---\n# Heading\n';
			const result = mergeTagsIntoFrontmatter(content, ['noble']);
			expect(result).toBe('---\ntags:\n  - meeting\n  - work\n  - noble\n---\n# Heading\n');
		});

		it('upgrades a single scalar string value to a YAML list', () => {
			const content = '---\ntags: meeting\n---\n# Heading\n';
			const result = mergeTagsIntoFrontmatter(content, ['noble']);
			expect(result).toBe('---\ntags:\n  - meeting\n  - noble\n---\n# Heading\n');
		});

		it('deduplicates against existing tags', () => {
			const content = '---\ntags:\n  - noble\n---\n# Heading\n';
			const result = mergeTagsIntoFrontmatter(content, ['noble', 'inventor']);
			expect(result).toBe('---\ntags:\n  - noble\n  - inventor\n---\n# Heading\n');
		});

		it('upgrades a singular tag: key into a tags: YAML list (unsupported in 1.9)', () => {
			const content = '---\ntag: existing\ntitle: My Note\n---\n# Heading\n';
			const result = mergeTagsIntoFrontmatter(content, ['noble']);
			expect(result).toBe('---\ntags:\n  - existing\n  - noble\ntitle: My Note\n---\n# Heading\n');
		});

		it('preserves body byte-for-byte', () => {
			const content = '# Heading\n\nBody with --- divider\n\nand more text.';
			const result = mergeTagsIntoFrontmatter(content, ['noble']);
			expect(result.endsWith('# Heading\n\nBody with --- divider\n\nand more text.')).toBe(true);
		});

		it('handles a tags field that is the last key in frontmatter', () => {
			const content = '---\ntitle: My Note\ntags:\n  - existing\n---\n# Heading\n';
			const result = mergeTagsIntoFrontmatter(content, ['noble']);
			expect(result).toBe('---\ntitle: My Note\ntags:\n  - existing\n  - noble\n---\n# Heading\n');
		});
	});
});

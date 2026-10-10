import { describe, it, expect } from 'vitest';
import { getBlockContent, getHeadings, headingMatches, maskCode } from '../../Helpers/MarkdownStructureHelper';

describe('MarkdownStructureHelper', () => {
	describe('maskCode', () => {
		it('blanks fenced blocks and inline code without moving columns', () => {
			const lines = maskCode('a `code` b\n~~~\n[[x]]\n~~~\nafter');

			expect(lines).toEqual(['a        b', '   ', '     ', '   ', 'after']);
		});
	});

	describe('getHeadings', () => {
		it('reads ATX headings outside frontmatter and code', () => {
			const content = '---\n# not: heading\n---\n# Rivals ##\n```\n# Code\n```\n#tag\n## Allies';

			expect(getHeadings(content)).toEqual(['Rivals', 'Allies']);
		});

		it('matches headings the way links write them', () => {
			expect(headingMatches('Rivals: The [[Guild]]', 'rivals the guild')).toBe(true);
		});
	});

	describe('getBlockContent', () => {
		it('reads a paragraph block', () => {
			expect(getBlockContent('Intro\n\nFirst line\nsecond line ^para', 'para')).toBe('First line\nsecond line');
		});

		it('reads list and task items', () => {
			const content = '- first\n- second ^item\n- [x] done ^task\n1) numbered ^num';

			expect(getBlockContent(content, 'item')).toBe('second');
			expect(getBlockContent(content, 'task')).toBe('done');
			expect(getBlockContent(content, 'num')).toBe('numbered');
		});

		it('reads a block that is itself a quote', () => {
			expect(getBlockContent('> quoted\n> text ^quote', 'quote')).toBe('quoted\ntext');
		});

		it('reads the block above an ID on its own line, such as a table', () => {
			const content = '| a | b |\n| - | - |\n| 1 | 2 |\n\n^table';

			expect(getBlockContent(content, 'table')).toBe('| a | b |\n| - | - |\n| 1 | 2 |');
		});

		it('matches IDs case-insensitively and ignores code', () => {
			expect(getBlockContent('Text ^MixedCase', 'mixedcase')).toBe('Text');
			expect(getBlockContent('```\nText ^code\n```', 'code')).toBeUndefined();
		});
	});
});

import { describe, it, expect } from 'vitest';
import {
	normaliseFrontmatterList,
	mergeListIntoFrontmatter,
	parseFrontmatterYaml,
	mergeFrontmatterFields,
} from '../../Helpers/FrontmatterHelpers';

describe('FrontmatterHelpers', () => {
	describe('normaliseFrontmatterList', () => {
		it('returns an empty array for null, undefined, and non-list scalars', () => {
			expect(normaliseFrontmatterList(null)).toEqual([]);
			expect(normaliseFrontmatterList(undefined)).toEqual([]);
			expect(normaliseFrontmatterList({})).toEqual([]);
			expect(normaliseFrontmatterList(true)).toEqual([]);
		});

		it('splits a comma-separated string into a list (Obsidian 1.9 breakage)', () => {
			expect(normaliseFrontmatterList('meeting, work, planning')).toEqual(['meeting', 'work', 'planning']);
		});

		it('treats a single scalar string as a one-item list', () => {
			expect(normaliseFrontmatterList('meeting')).toEqual(['meeting']);
		});

		it('passes an existing array through, cleaning each item', () => {
			expect(normaliseFrontmatterList(['meeting', 'work'])).toEqual(['meeting', 'work']);
		});

		it('strips a leading # and trims whitespace', () => {
			expect(normaliseFrontmatterList(['#meeting', '  work  '])).toEqual(['meeting', 'work']);
			expect(normaliseFrontmatterList('#meeting, #work')).toEqual(['meeting', 'work']);
		});

		it('drops empty entries', () => {
			expect(normaliseFrontmatterList('meeting, , work,')).toEqual(['meeting', 'work']);
			expect(normaliseFrontmatterList(['', '  ', '#'])).toEqual([]);
		});

		it('coerces numbers to strings', () => {
			expect(normaliseFrontmatterList([2024, 'meeting'])).toEqual(['2024', 'meeting']);
		});
	});

	describe('mergeListIntoFrontmatter', () => {
		it('creates the field as a list when absent', () => {
			const fm: Record<string, unknown> = {};
			mergeListIntoFrontmatter(fm, 'tags', ['noble', 'inventor']);
			expect(fm.tags).toEqual(['noble', 'inventor']);
		});

		it('unions additions after existing entries, keeping existing first', () => {
			const fm: Record<string, unknown> = { tags: ['existing'] };
			mergeListIntoFrontmatter(fm, 'tags', ['noble', 'inventor']);
			expect(fm.tags).toEqual(['existing', 'noble', 'inventor']);
		});

		it('de-duplicates against existing entries and within additions', () => {
			const fm: Record<string, unknown> = { tags: ['noble'] };
			mergeListIntoFrontmatter(fm, 'tags', ['noble', 'inventor', 'inventor']);
			expect(fm.tags).toEqual(['noble', 'inventor']);
		});

		it('repairs a malformed comma-separated existing value into a list', () => {
			const fm: Record<string, unknown> = { tags: 'meeting, work' };
			mergeListIntoFrontmatter(fm, 'tags', ['noble']);
			expect(fm.tags).toEqual(['meeting', 'work', 'noble']);
		});

		it('leaves an absent field untouched when there is nothing to add', () => {
			const fm: Record<string, unknown> = {};
			mergeListIntoFrontmatter(fm, 'tags', []);
			expect('tags' in fm).toBe(false);
		});
	});

	describe('parseFrontmatterYaml', () => {
		it('parses a bare YAML mapping into an object', () => {
			const result = parseFrontmatterYaml('title: My Note\ntags:\n  - work');
			expect(result).toEqual({ title: 'My Note', tags: ['work'] });
		});

		it('strips a ```yaml fenced code block', () => {
			const result = parseFrontmatterYaml('```yaml\ntitle: My Note\n```');
			expect(result).toEqual({ title: 'My Note' });
		});

		it('strips a plain ``` fenced code block', () => {
			const result = parseFrontmatterYaml('```\ntitle: My Note\n```');
			expect(result).toEqual({ title: 'My Note' });
		});

		it('strips surrounding --- frontmatter fences', () => {
			const result = parseFrontmatterYaml('---\ntitle: My Note\n---');
			expect(result).toEqual({ title: 'My Note' });
		});

		it('returns null for empty or whitespace-only input', () => {
			expect(parseFrontmatterYaml('')).toBeNull();
			expect(parseFrontmatterYaml('   \n  ')).toBeNull();
		});

		it('returns null when the YAML is not a mapping', () => {
			expect(parseFrontmatterYaml('- just\n- a\n- list')).toBeNull();
			expect(parseFrontmatterYaml('just a scalar')).toBeNull();
		});

		it('returns null for malformed YAML', () => {
			expect(parseFrontmatterYaml('title: "unterminated')).toBeNull();
		});
	});

	describe('mergeFrontmatterFields', () => {
		it('unions list-valued fields and keeps existing entries first', () => {
			const fm: Record<string, unknown> = { tags: ['existing'] };
			mergeFrontmatterFields(fm, { tags: ['new'] });
			expect(fm.tags).toEqual(['existing', 'new']);
		});

		it('normalises a malformed comma-separated list suggestion', () => {
			const fm: Record<string, unknown> = {};
			mergeFrontmatterFields(fm, { tags: 'work, meeting' });
			expect(fm.tags).toEqual(['work', 'meeting']);
		});

		it('treats aliases and cssclasses as list fields too', () => {
			const fm: Record<string, unknown> = {};
			mergeFrontmatterFields(fm, { aliases: ['Alias'], cssclasses: 'wide' });
			expect(fm.aliases).toEqual(['Alias']);
			expect(fm.cssclasses).toEqual(['wide']);
		});

		it('adds scalar fields only when the note has no value', () => {
			const fm: Record<string, unknown> = { author: 'Ada' };
			mergeFrontmatterFields(fm, { author: 'Babbage', status: 'draft' });
			expect(fm.author).toBe('Ada');
			expect(fm.status).toBe('draft');
		});

		it('fills scalar fields that are present but empty/null', () => {
			const fm: Record<string, unknown> = { author: '', status: null };
			mergeFrontmatterFields(fm, { author: 'Ada', status: 'draft' });
			expect(fm.author).toBe('Ada');
			expect(fm.status).toBe('draft');
		});

		it('skips null and undefined suggested values', () => {
			const fm: Record<string, unknown> = {};
			mergeFrontmatterFields(fm, { author: null, status: undefined });
			expect('author' in fm).toBe(false);
			expect('status' in fm).toBe(false);
		});
	});
});

import { describe, it, expect, afterEach } from 'vitest';
import { DeregisterAllServices } from '../../Services/DependencyService';
import { BlockQuoteValidation } from '../../DocumentValidation/Stages/BlockQuoteValidation';
import type { BlockQuoteValidationResult } from '../../DocumentValidation/Results/BlockQuoteValidationResult';
import type { IVaultChange } from '../../Services/TemporaryVaultService';
import { extractWikilinks } from '../../Helpers/WikilinkHelper';
import { findQuotedText, quoteMatchesBlock } from '../../Helpers/BlockQuoteHelper';
import { createChange, deleteChange, modifyChange, registerFakeVault } from './fakeVault';

async function validate(files: Record<string, string>, changes: IVaultChange[]): Promise<BlockQuoteValidationResult> {
	const temporaryVaultService = registerFakeVault(files);
	temporaryVaultService.addAll(changes);
	return await new BlockQuoteValidation().validate() as BlockQuoteValidationResult;
}

function quoteFor(content: string): string | undefined {
	const [link] = extractWikilinks(content);
	return findQuotedText(content.split('\n'), link);
}

const source = 'The guild trusts **no one** - not even its own. ^trust';

describe('BlockQuoteValidation', () => {
	afterEach(() => {
		DeregisterAllServices();
	});

	describe('findQuotedText', () => {
		it('finds an inline quote before the link', () => {
			expect(quoteFor('As written, "trusts no one" — [[Source#^trust]]')).toBe('trusts no one');
			expect(quoteFor('As written, “trusts no one”: [[Source#^trust]]')).toBe('trusts no one');
		});

		it('finds a blockquote containing the link', () => {
			expect(quoteFor('> trusts no one\n> not even its own\n> [[Source#^trust]]')).toBe('trusts no one not even its own');
		});

		it('finds a blockquote on the line above the link', () => {
			expect(quoteFor('> "trusts no one"\n[[Source#^trust]]')).toBe('trusts no one');
		});

		it('finds a callout quote and drops its title line', () => {
			expect(quoteFor('> [!quote] The Guild\n> trusts no one — [[Source#^trust]]')).toBe('trusts no one');
		});

		it('finds nothing for a bare link', () => {
			expect(quoteFor('See [[Source#^trust]]')).toBeUndefined();
		});
	});

	describe('quoteMatchesBlock', () => {
		it('ignores quote styles, dashes, emphasis and whitespace', () => {
			expect(quoteMatchesBlock('trusts no one – not   even its own', source.replace(' ^trust', ''))).toBe(true);
			expect(quoteMatchesBlock('The “guild”', 'The "guild" said')).toBe(true);
		});

		it('matches partial quotes and ellipsis fragments in order only', () => {
			expect(quoteMatchesBlock('no one', 'The guild trusts no one')).toBe(true);
			expect(quoteMatchesBlock('The guild ... no one', 'The guild trusts no one')).toBe(true);
			expect(quoteMatchesBlock('The guild […] no one', 'The guild trusts no one')).toBe(true);
			expect(quoteMatchesBlock('no one … The guild', 'The guild trusts no one')).toBe(false);
		});
	});

	it('flags a changed note whose quote does not match the block', async () => {
		const files = { 'Source.md': source };

		const result = await validate(files, [createChange('Hooks.md', 'They say "trusts everyone" [[Source#^trust]]')]);

		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]).toMatchObject({
			source: 'Hooks.md',
			targetPath: 'Source.md',
			quotedText: 'trusts everyone',
			blockText: 'The guild trusts **no one** - not even its own.',
			lineText: 'They say "trusts everyone" [[Source#^trust]]'
		});
		expect(result.toString()).toContain('quotes "trusts everyone"');
	});

	it('flags unchanged notes when a modified note edits the quoted block', async () => {
		const files = { 'Source.md': source, 'Hooks.md': '"trusts no one" [[Source#^trust]]' };

		const result = await validate(files, [modifyChange('Source.md', source, 'The guild trusts everyone. ^trust')]);

		expect(result.issues).toMatchObject([{ source: 'Hooks.md', quotedText: 'trusts no one', blockText: 'The guild trusts everyone.' }]);
		expect(result.affectedFiles()).toEqual(['Hooks.md']);
	});

	it('leaves missing notes, missing blocks, bare links and embeds to other checks', async () => {
		const files = { 'Source.md': source, 'Gone.md': 'Gone ^gone' };
		const content = [
			'"anything" [[Missing#^trust]]',
			'"anything" [[Source#^missing]]',
			'"anything" [[Gone#^gone]]',
			'Bare [[Source#^trust]]',
			'"anything" ![[Source#^trust]]'
		].join('\n');

		const result = await validate(files, [createChange('Hooks.md', content), deleteChange('Gone.md', 'Gone ^gone')]);

		expect(result.issueCount()).toBe(0);
	});
});

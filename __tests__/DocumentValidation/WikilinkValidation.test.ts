import { describe, it, expect, afterEach } from 'vitest';
import { DeregisterAllServices } from '../../Services/DependencyService';
import { WikilinkValidation } from '../../DocumentValidation/Stages/WikilinkValidation';
import type { WikilinkValidationResult } from '../../DocumentValidation/Results/WikilinkValidationResult';
import { BrokenLinkReason } from '../../Enums/BrokenLinkReason';
import type { IVaultChange } from '../../Services/TemporaryVaultService';
import { createChange, deleteChange, modifyChange, registerFakeVault, renameChange } from './fakeVault';

async function validate(files: Record<string, string>, changes: IVaultChange[], alwaysUpdateLinks = false): Promise<WikilinkValidationResult> {
	const temporaryVaultService = registerFakeVault(files, alwaysUpdateLinks);
	temporaryVaultService.addAll(changes);
	return await new WikilinkValidation().validate() as WikilinkValidationResult;
}

describe('WikilinkValidation', () => {
	afterEach(() => {
		DeregisterAllServices();
	});

	it('flags a link to a deleted file, even with alwaysUpdateLinks on', async () => {
		const files = { 'Guild.md': 'Guild', 'Hooks.md': 'Meet the [[Guild]]' };

		const result = await validate(files, [deleteChange('Guild.md', 'Guild')], true);

		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]).toMatchObject({ source: 'Hooks.md', line: 0, column: 9, original: '[[Guild]]', reason: BrokenLinkReason.MissingFile, lineText: 'Meet the [[Guild]]' });
	});

	it('flags a full path link to a moved file but not a link by name', async () => {
		const files = { 'World/Guild.md': 'Guild', 'Hooks.md': '[[World/Guild]]\n[[Guild|the guild]]' };

		const result = await validate(files, [renameChange('World/Guild.md', 'Factions/Guild.md', 'Guild')]);

		expect(result.issues.map(issue => issue.original)).toEqual(['[[World/Guild]]']);
	});

	it('does not flag moves when alwaysUpdateLinks is on', async () => {
		const files = { 'World/Guild.md': 'Guild', 'Hooks.md': '[[World/Guild]]' };

		const result = await validate(files, [renameChange('World/Guild.md', 'Factions/Guild.md', 'Guild')], true);

		expect(result.issueCount()).toBe(0);
	});

	it('checks the new content of a modified note, not its live links', async () => {
		const files = { 'Hooks.md': '[[Missing Live]]' };

		const result = await validate(files, [modifyChange('Hooks.md', '[[Missing Live]]', 'Now [[Missing New]]')]);

		expect(result.issues.map(issue => issue.original)).toEqual(['[[Missing New]]']);
	});

	it('resolves links to created files but not to deleted ones', async () => {
		const files = { 'Old.md': 'Old' };

		const result = await validate(files, [
			createChange('Notes/Hooks.md', '[[New]] and [[Old]]'),
			createChange('People/New.md', 'New'),
			deleteChange('Old.md', 'Old')
		]);

		expect(result.issues.map(issue => issue.original)).toEqual(['[[Old]]']);
	});

	it('flags a relative link in a moved note at its new path', async () => {
		const files = { 'Notes/Index.md': '[[./Guild]]', 'Notes/Guild.md': 'Guild' };

		const result = await validate(files, [renameChange('Notes/Index.md', 'Index.md', '[[./Guild]]')]);

		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]).toMatchObject({ source: 'Index.md', reason: BrokenLinkReason.MissingFile });
	});

	it('reports a moved note that links to a deleted file once, at its new path', async () => {
		const files = { 'Notes/Index.md': '[[Guild]]', 'Guild.md': 'Guild' };

		const result = await validate(files, [
			renameChange('Notes/Index.md', 'Index.md', '[[Guild]]'),
			deleteChange('Guild.md', 'Guild')
		]);

		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].source).toBe('Index.md');
	});

	it('ignores links in code, and parses escaped table pipes and block references', async () => {
		const content = [
			'```',
			'[[In Fence]]',
			'```',
			'Inline `[[In Code]]` text',
			'| [[Missing Table\\|alias]] | cell |',
			'See [[Missing Block#^abc123]]'
		].join('\n');

		const result = await validate({}, [createChange('Hooks.md', content)]);

		expect(result.issues.map(issue => [issue.linkpath, issue.subpath, issue.line])).toEqual([
			['Missing Table', '', 4],
			['Missing Block', '#^abc123', 5]
		]);
	});

	it('flags missing headings and blocks, and resolves same-note headings', async () => {
		const files = { 'Guild.md': '# Rivals\nThe guild. ^real' };
		const content = '# Local\n[[Guild#Rivals]] [[Guild#Missing]] [[Guild#^real]] [[Guild#^missing]] [[#Local]] [[Guild#Rivals#Deeper]]';

		const result = await validate(files, [createChange('Hooks.md', content)]);

		expect(result.issues.map(issue => [issue.original, issue.reason])).toEqual([
			['[[Guild#Missing]]', BrokenLinkReason.MissingHeading],
			['[[Guild#^missing]]', BrokenLinkReason.MissingBlock],
			['[[Guild#Rivals#Deeper]]', BrokenLinkReason.MissingHeading]
		]);
	});

	it('flags links from unchanged notes when a modified note drops a heading or block', async () => {
		const guild = '# Rivals\nThe guild. ^real';
		const files = { 'Guild.md': guild, 'Secrets.md': 'Her rivals: [[Guild#Rivals]]', 'Hooks.md': '![[Guild#^real]]' };

		const result = await validate(files, [modifyChange('Guild.md', guild, '# Allies\nThe guild.')]);

		expect(result.brokenWikilinks()).toMatchObject([{ source: 'Secrets.md', reason: BrokenLinkReason.MissingHeading, lineText: 'Her rivals: [[Guild#Rivals]]' }]);
		expect(result.brokenBlockReferences()).toMatchObject([{ source: 'Hooks.md', reason: BrokenLinkReason.MissingBlock, isEmbed: true }]);
		expect(result.embedCount()).toBe(1);
		expect(result.affectedFiles().sort()).toEqual(['Hooks.md', 'Secrets.md']);
		expect(result.toString()).toContain('Secrets.md line 1: [[Guild#Rivals]] (heading not found)');
	});
});

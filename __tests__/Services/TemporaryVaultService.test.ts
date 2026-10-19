import { describe, it, expect, afterEach } from 'vitest';
import { DeregisterAllServices } from '../../Services/DependencyService';
import { DiffState } from '../../Enums/DiffState';
import type { TemporaryVaultService } from '../../Services/TemporaryVaultService';
import { createChange, deleteChange, modifyChange, registerFakeVault, renameChange } from '../DocumentValidation/fakeVault';

const baseFiles = {
	'Notes/Alpha.md': 'alpha',
	'Notes/Beta.md': 'beta',
	'Image.png': 'binary'
};

function setup(changes = [] as ReturnType<typeof createChange>[], alwaysUpdateLinks = false, files: Record<string, string> = baseFiles): TemporaryVaultService {
	const service = registerFakeVault(files, alwaysUpdateLinks);
	service.addAll(changes);
	return service;
}

describe('TemporaryVaultService', () => {
	afterEach(() => {
		DeregisterAllServices();
	});

	describe('exists', () => {
		it('should find files that already exist in the vault', () => {
			expect(setup().exists('Notes/Alpha.md')).toBe(true);
		});

		it('should not find files that do not exist', () => {
			expect(setup().exists('Notes/Missing.md')).toBe(false);
		});

		it('should find files that are about to be created', () => {
			expect(setup([createChange('Notes/New.md', 'new')]).exists('Notes/New.md')).toBe(true);
		});

		it('should not find files that are about to be deleted', () => {
			expect(setup([deleteChange('Notes/Alpha.md', 'alpha')]).exists('Notes/Alpha.md')).toBe(false);
		});

		it('should find a moved file at its destination but not its source', () => {
			const service = setup([renameChange('Notes/Alpha.md', 'Archive/Alpha.md', 'alpha')]);

			expect(service.exists('Archive/Alpha.md')).toBe(true);
			expect(service.exists('Notes/Alpha.md')).toBe(false);
		});
	});

	describe('read', () => {
		it('should read the pending content of a modified note', async () => {
			const service = setup([modifyChange('Notes/Alpha.md', 'alpha', 'alpha edited')]);

			expect(await service.read('Notes/Alpha.md')).toBe('alpha edited');
		});

		it('should read the pending content of a created note', async () => {
			expect(await setup([createChange('Notes/New.md', 'new')]).read('Notes/New.md')).toBe('new');
		});

		it('should read the live content of an unchanged note', async () => {
			expect(await setup().read('Notes/Beta.md')).toBe('beta');
		});

		it('should return undefined for a missing note', async () => {
			expect(await setup().read('Notes/Missing.md')).toBeUndefined();
		});

		it('should return undefined for a deleted note', async () => {
			expect(await setup([deleteChange('Notes/Alpha.md', 'alpha')]).read('Notes/Alpha.md')).toBeUndefined();
		});

		it('should read a moved note at its new path only', async () => {
			const service = setup([renameChange('Notes/Alpha.md', 'Archive/Alpha.md', 'alpha')]);

			expect(await service.read('Archive/Alpha.md')).toBe('alpha');
			expect(await service.read('Notes/Alpha.md')).toBeUndefined();
		});

		it('should not track the content of non-note files', async () => {
			const service = setup([modifyChange('Image.png', 'binary', 'changed')]);

			expect(service.changedNotes()).toEqual([]);
			expect(await service.read('Image.png')).toBe('binary');
		});

		it('should not track content for changes that carry binary data', () => {
			const service = setup([{ ...createChange('Notes/Doc.md', 'text'), base64: 'AAAA' }]);

			expect(service.changedNotes()).toEqual([]);
		});
	});

	describe('change tracking', () => {
		it('should report the pending content of changed notes', () => {
			const service = setup([
				modifyChange('Notes/Alpha.md', 'alpha', 'alpha edited'),
				createChange('Notes/New.md', 'new')
			]);

			expect(service.changedNotes()).toEqual([
				{ path: 'Notes/Alpha.md', content: 'alpha edited' },
				{ path: 'Notes/New.md', content: 'new' }
			]);
		});

		it('should report moved and deleted paths as removed', () => {
			const service = setup([
				renameChange('Notes/Alpha.md', 'Archive/Alpha.md', 'alpha'),
				deleteChange('Notes/Beta.md', 'beta')
			]);

			expect(service.removedPaths()).toEqual(['Notes/Alpha.md', 'Notes/Beta.md']);
		});

		it('should report modified notes', () => {
			const service = setup([
				modifyChange('Notes/Alpha.md', 'alpha', 'edited'),
				modifyChange('Image.png', 'binary', 'changed')
			]);

			expect(service.modifiedPaths()).toEqual(['Notes/Alpha.md']);
		});

		it.each([
			['modified', modifyChange('Notes/Alpha.md', 'alpha', 'edited'), 'Notes/Alpha.md', true],
			['deleted', deleteChange('Notes/Alpha.md', 'alpha'), 'Notes/Alpha.md', true],
			['moved', renameChange('Notes/Alpha.md', 'Archive/Alpha.md', 'alpha'), 'Notes/Alpha.md', true],
			['untouched', modifyChange('Notes/Alpha.md', 'alpha', 'edited'), 'Notes/Beta.md', false]
		])('should know whether a %s path is changed', (_description, change, path, expected) => {
			expect(setup([change]).isChanged(path)).toBe(expected);
		});

		it('should only track changes that are unreviewed or accepted', () => {
			const accepted = { ...modifyChange('Notes/Alpha.md', 'alpha', 'accepted'), status: DiffState.Accepted };
			const rejected = { ...deleteChange('Notes/Beta.md', 'beta'), status: DiffState.Rejected };
			const suggestion = { ...createChange('Notes/New.md', 'new'), status: DiffState.Suggestion };
			const service = setup([accepted, rejected, suggestion]);

			expect(service.changedNotes()).toEqual([{ path: 'Notes/Alpha.md', content: 'accepted' }]);
			expect(service.exists('Notes/Beta.md')).toBe(true);
			expect(service.exists('Notes/New.md')).toBe(false);
		});

		it('should drop a change from the view when it is rejected and the view is retracked', () => {
			const change = deleteChange('Notes/Alpha.md', 'alpha');
			const service = setup([change]);
			expect(service.exists('Notes/Alpha.md')).toBe(false);

			change.status = DiffState.Rejected;
			service.retrack();

			expect(service.exists('Notes/Alpha.md')).toBe(true);
		});

		it('should expose the tracked vault changes', () => {
			const change = createChange('Notes/New.md', 'new');

			expect(setup([change]).getVaultChanges()).toEqual([change]);
		});
	});

	describe('reset', () => {
		it('should clear all tracked changes', async () => {
			const service = setup([
				createChange('Notes/New.md', 'new'),
				deleteChange('Notes/Alpha.md', 'alpha'),
				modifyChange('Notes/Beta.md', 'beta', 'edited')
			]);

			service.reset();

			expect(service.getVaultChanges()).toEqual([]);
			expect(service.changedNotes()).toEqual([]);
			expect(service.removedPaths()).toEqual([]);
			expect(service.modifiedPaths()).toEqual([]);
			expect(service.exists('Notes/New.md')).toBe(false);
			expect(service.exists('Notes/Alpha.md')).toBe(true);
			expect(await service.read('Notes/Beta.md')).toBe('beta');
		});
	});

	describe('getFirstLinkpathDest', () => {
		it('should resolve an empty link to the source note', () => {
			expect(setup().getFirstLinkpathDest('', 'Notes/Alpha.md')).toBe('Notes/Alpha.md');
		});

		it('should resolve a link by name to an existing note', () => {
			expect(setup().getFirstLinkpathDest('Beta', 'Notes/Alpha.md')).toBe('Notes/Beta.md');
		});

		it('should resolve a link to a note that is about to be created', () => {
			const service = setup([createChange('Elsewhere/Gamma.md', 'gamma')]);

			expect(service.getFirstLinkpathDest('Gamma', 'Notes/Alpha.md')).toBe('Elsewhere/Gamma.md');
		});

		it('should match pending notes case insensitively', () => {
			const service = setup([createChange('Elsewhere/Gamma.md', 'gamma')]);

			expect(service.getFirstLinkpathDest('gamma', 'Notes/Alpha.md')).toBe('Elsewhere/Gamma.md');
		});

		it('should not resolve a link to a deleted note', () => {
			const service = setup([deleteChange('Notes/Beta.md', 'beta')]);

			expect(service.getFirstLinkpathDest('Beta', 'Notes/Alpha.md')).toBeUndefined();
		});

		it('should not resolve a link by name to a moved note when links are not auto-updated', () => {
			const service = setup([renameChange('Notes/Beta.md', 'Archive/Beta.md', 'beta')], false);

			expect(service.getFirstLinkpathDest('Notes/Beta', 'Notes/Alpha.md')).toBeUndefined();
		});

		it('should follow a moved note when Obsidian updates links automatically', () => {
			const service = setup([renameChange('Notes/Beta.md', 'Archive/Beta.md', 'beta')], true);

			expect(service.getFirstLinkpathDest('Notes/Beta', 'Notes/Alpha.md')).toBe('Archive/Beta.md');
		});

		it('should resolve a relative link from the folder of the source note', () => {
			expect(setup().getFirstLinkpathDest('./Beta', 'Notes/Alpha.md')).toBe('Notes/Beta.md');
		});

		it('should resolve a parent relative link', () => {
			expect(setup().getFirstLinkpathDest('../Image.png', 'Notes/Alpha.md')).toBe('Image.png');
		});

		it('should not resolve a relative link by name outside the source folder', () => {
			expect(setup().getFirstLinkpathDest('./Image', 'Notes/Alpha.md')).toBeUndefined();
		});

		it('should resolve a relative link to a pending note', () => {
			const service = setup([createChange('Notes/Sub/New.md', 'new')]);

			expect(service.getFirstLinkpathDest('./Sub/New', 'Notes/Alpha.md')).toBe('Notes/Sub/New.md');
		});
	});
});

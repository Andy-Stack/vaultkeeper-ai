import { describe, it, expect } from 'vitest';
import { DiffState } from '../../Enums/DiffState';
import { FileEvent } from '../../Enums/FileEvent';
import type { IVaultChange } from '../../Services/TemporaryVaultService';
import { countUndecided, displayState, reviewDoneLabel, vaultChangeFolder, vaultChangeName } from '../../Helpers/VaultChangeHelper';

function change(overrides: Partial<IVaultChange> = {}): IVaultChange {
	return { changeType: FileEvent.Modify, status: DiffState.None, ...overrides };
}

describe('VaultChangeHelper', () => {
	describe('displayState', () => {
		it('treats a suggestion with no text as undecided', () => {
			expect(displayState(change({ status: DiffState.Suggestion }))).toBe(DiffState.None);
		});

		it('keeps a suggestion that has text', () => {
			expect(displayState(change({ status: DiffState.Suggestion, suggestion: 'shorter' }))).toBe(DiffState.Suggestion);
		});

		it('passes other states through', () => {
			expect(displayState(change({ status: DiffState.Accepted }))).toBe(DiffState.Accepted);
			expect(displayState(change({ status: DiffState.Rejected }))).toBe(DiffState.Rejected);
		});
	});

	describe('countUndecided', () => {
		it('counts undecided changes, including empty suggestions', () => {
			const changes = [
				change(),
				change({ status: DiffState.Suggestion }),
				change({ status: DiffState.Accepted }),
				change({ status: DiffState.Suggestion, suggestion: 'tweak' })
			];

			expect(countUndecided(changes)).toBe(2);
		});
	});

	describe('reviewDoneLabel', () => {
		it('asks for the remaining decisions while any are undecided', () => {
			expect(reviewDoneLabel(4)).toBe('Decide 4 more');
		});

		it('reads Done once everything is decided', () => {
			expect(reviewDoneLabel(0)).toBe('Done');
		});
	});

	describe('vaultChangeName / vaultChangeFolder', () => {
		it('falls back to the new path when there is no file', () => {
			const created = change({ changeType: FileEvent.Create, newPath: 'World/Factions/Thieves Guild.md' });

			expect(vaultChangeName(created)).toBe('Thieves Guild.md');
			expect(vaultChangeFolder(created)).toBe('World/Factions');
		});
	});
});

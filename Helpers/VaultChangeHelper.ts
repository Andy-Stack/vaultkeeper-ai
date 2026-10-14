import { basename, dirname } from "path-browserify";
import { DiffState } from "Enums/DiffState";
import type { IVaultChange } from "Services/TemporaryVaultService";
import type { IValidationIssue } from "../DocumentValidation/IValidationIssue";

// The state shown to the user: a suggestion with no text yet still counts as undecided
export function displayState(vaultChange: IVaultChange): DiffState {
    if (vaultChange.status === DiffState.Suggestion && vaultChange.suggestion === undefined) {
        return DiffState.None;
    }

    return vaultChange.status;
}

export function countUndecided(vaultChanges: IVaultChange[]): number {
    return vaultChanges.filter(vaultChange => displayState(vaultChange) === DiffState.None).length;
}

export function reviewDoneLabel(undecided: number): string {
    return undecided > 0 ? `Decide ${undecided} more` : "Done";
}

export function vaultChangeName(vaultChange: IVaultChange): string {
    return vaultChange.file?.basename ?? basename(vaultChange.newPath ?? "-");
}

export function vaultChangeFolder(vaultChange: IVaultChange): string {
    return vaultChange.file?.parent?.path ?? dirname(vaultChange.newPath ?? "-");
}
export function isIssueForChange(issue: IValidationIssue, vaultChange: IVaultChange): boolean {
    return issue.changePath === vaultChange.newPath || issue.changePath === vaultChange.oldPath;
}

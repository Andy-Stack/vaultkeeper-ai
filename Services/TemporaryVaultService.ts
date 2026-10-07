import { TFile } from "obsidian";
import type { FileEvent } from "Enums/FileEvent";
import type { DiffState } from "Enums/DiffState";
import type { IVaultChangeResponse } from "./VaultService";

export interface IVaultChange {
    oldPath?: string;
    newPath?: string;
    oldContent?: string;
    newContent?: string;
    file?: TFile;
    base64?: string;
    changeType: FileEvent;
    diffString?: string;
    suggestion?: string;
    status: DiffState;
}

export interface IVaultChangeRequest<T> extends IVaultChange {
    changeAction: () => Promise<IVaultChangeResponse<T>>;
}

export class TemporaryVaultService {

    private vaultChanges: IVaultChange[] = [];

    public getVaultChanges(): IVaultChange[] {
        return this.vaultChanges;
    }

    public addAll(vaultChanges: IVaultChange[]) {
        vaultChanges.forEach(change => this.vaultChanges.push(change));
    }

    public reset() {
        this.vaultChanges = [];
    }

}
import { TFile, type Vault } from "obsidian";
import type { SanitiserService } from "./SanitiserService";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type VaultkeeperAIPlugin from "main";
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

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly sanitiserService: SanitiserService;
    private readonly vault: Vault;

    private vaultChanges: IVaultChange[] = [];

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.sanitiserService = Resolve<SanitiserService>(Services.SanitiserService);
        
        this.vault = this.plugin.app.vault;
    }

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
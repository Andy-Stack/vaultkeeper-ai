import { TFile, type Vault } from "obsidian";
import type { SanitiserService } from "./SanitiserService";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type VaultkeeperAIPlugin from "main";

export class TemporaryVaultService {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly sanitiserService: SanitiserService;
    private readonly vault: Vault;

    private readonly fileMap: Map<string, { newContent: string, file: TFile }> = new Map();

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.sanitiserService = Resolve<SanitiserService>(Services.SanitiserService);
        
        this.vault = this.plugin.app.vault;
    }

    public reset() {
        this.fileMap.clear();
    }

}
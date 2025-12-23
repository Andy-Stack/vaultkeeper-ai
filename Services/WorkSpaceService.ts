import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { TFile, WorkspaceLeaf } from "obsidian";
import type { VaultService } from "./VaultService";

export class WorkSpaceService {
    private readonly plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    private readonly vaultService: VaultService = Resolve<VaultService>(Services.VaultService);

    public async openNote(noteName: string) {
        const file: TFile | null = this.plugin.app.metadataCache.getFirstLinkpathDest(noteName, "");
        const leaf: WorkspaceLeaf = this.plugin.app.workspace.getLeaf(false);

        if (file) {
            await leaf.openFile(file);
        }
    }

    public getActiveFile(allowAccessToPluginRoot: boolean = false): TFile | null {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        
        if (!activeFile || this.vaultService.isExclusion(activeFile.path, allowAccessToPluginRoot)) {
            return null;
        }
        
        return activeFile;
    }
}
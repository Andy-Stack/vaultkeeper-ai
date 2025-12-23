import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { TFile, WorkspaceLeaf } from "obsidian";

export class WorkSpaceService {
    private readonly plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);

    public async openNote(noteName: string) {
        const file: TFile | null = this.plugin.app.metadataCache.getFirstLinkpathDest(noteName, "");
        const leaf: WorkspaceLeaf = this.plugin.app.workspace.getLeaf(false);

        if (file) {
            await leaf.openFile(file);
        }
    }

    public getActiveFile(): TFile | null {
        return this.plugin.app.workspace.getActiveFile();
    }
}
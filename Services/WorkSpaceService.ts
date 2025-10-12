import type AIAgentPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { TFile, WorkspaceLeaf } from "obsidian";

export class WorkSpaceService {
    private readonly plugin: AIAgentPlugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);

    public async openNote(noteName: string) {
        const file: TFile | null = this.plugin.app.metadataCache.getFirstLinkpathDest(noteName, "");
        const leaf: WorkspaceLeaf = this.plugin.app.workspace.getLeaf(false);

        if (file) {
            await leaf.openFile(file);
        }
    }
}
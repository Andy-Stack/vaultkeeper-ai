import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { Notice, TFile, type View, type WorkspaceLeaf } from "obsidian";
import type { VaultService } from "./VaultService";

export class WorkSpaceService {
    private readonly plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    private readonly vaultService: VaultService = Resolve<VaultService>(Services.VaultService);

    public async openNote(noteName: string) {
        const file: TFile | null = this.plugin.app.metadataCache.getFirstLinkpathDest(noteName, "");
        const leaf: WorkspaceLeaf = this.plugin.app.workspace.getLeaf(false);

        if (file) {
            await leaf.openFile(file);
        } else {
            new Notice(`Failed to open note: "${noteName}"`);
        }
    }

    public async openNoteByPath(path: string) {
        const file = this.plugin.app.vault.getAbstractFileByPath(path);

        if (file instanceof TFile) {
            const leaf: WorkspaceLeaf = this.plugin.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        } else {
            new Notice(`Failed to open note: "${path}"`);
        }
    }

    public getActiveFile(allowAccessToPluginRoot: boolean = false): TFile | null {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        
        if (!activeFile || this.vaultService.isExclusion(activeFile.path, allowAccessToPluginRoot)) {
            return null;
        }
        
        return activeFile;
    }

    public getActiveViewOfType<ViewType extends View>(type: new (...args: WorkspaceLeaf[]) => ViewType): ViewType | null {
        return this.plugin.app.workspace.getActiveViewOfType(type);
    }
    

    public getViewActionsView(): Element | null | undefined {
        const leaf = this.plugin.app.workspace.getMostRecentLeaf();
        return leaf?.view?.containerEl?.querySelector('.view-actions');
    }
}
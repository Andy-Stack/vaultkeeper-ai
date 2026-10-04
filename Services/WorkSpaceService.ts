import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { Notice, TFile, Workspace, type WorkspaceLeaf } from "obsidian";
import type { FileSystemService } from "./FileSystemService";

export class WorkSpaceService {
    private readonly plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    private readonly fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    public getWorkSpace(): Workspace {
        return this.plugin.app.workspace;
    }

    public async openNote(noteName: string, focusIfAlreadyOpen: boolean = true) {
        const file: TFile | null = this.plugin.app.metadataCache.getFirstLinkpathDest(noteName, "");

        if (file) {
            await this.openFile(file, focusIfAlreadyOpen);
        } else {
            new Notice(`Failed to open note: "${noteName}"`);
        }
    }

    public async openNoteByPath(path: string, focusIfAlreadyOpen: boolean = true) {
        const file = this.plugin.app.vault.getAbstractFileByPath(path);

        if (file instanceof TFile) {
            await this.openFile(file, focusIfAlreadyOpen);
        } else {
            new Notice(`Failed to open note: "${path}"`);
        }
    }

    public getActiveFile(allowAccessToPluginRoot: boolean = false): TFile | null {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        
        if (!activeFile || this.fileSystemService.isExclusion(activeFile.path, { allowAccessToPluginRoot })) {
            return null;
        }
        
        return activeFile;
    }

    public getLeavesOfType(type: string): WorkspaceLeaf[] {
        return this.plugin.app.workspace.getLeavesOfType(type);
    }

    private async openFile(file: TFile, focusIfOpen: boolean) {
        const workspace = this.plugin.app.workspace;

        if (focusIfOpen) {
            const existingLeaf = this.findLeafWithFile(file);
            if (existingLeaf) {
                await workspace.revealLeaf(existingLeaf);
                workspace.setActiveLeaf(existingLeaf, { focus: true });
                return;
            }
        }

        const leaf: WorkspaceLeaf = workspace.getLeaf(false);
        await leaf.openFile(file);
    }

    /** Checks the view state rather than leaf.view so deferred (not yet loaded) tabs are also matched **/
    private findLeafWithFile(file: TFile): WorkspaceLeaf | undefined {
        let match: WorkspaceLeaf | undefined;

        this.plugin.app.workspace.iterateAllLeaves((leaf) => {
            if (!match && leaf.getViewState().state?.file === file.path) {
                match = leaf;
            }
        });

        return match;
    }
}
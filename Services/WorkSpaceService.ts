import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { Notice, TFile, type WorkspaceLeaf } from "obsidian";
import type { FileSystemService } from "./FileSystemService";

export class WorkSpaceService {
    private readonly plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    private readonly fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

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
        
        if (!activeFile || this.fileSystemService.isExclusion(activeFile.path, allowAccessToPluginRoot)) {
            return null;
        }
        
        return activeFile;
    }

    public getLeavesOfType(type: string): WorkspaceLeaf[] {
        return this.plugin.app.workspace.getLeavesOfType(type);
    }
}
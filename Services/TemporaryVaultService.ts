import { TFile } from "obsidian";
import { dirname, join } from "path-browserify";
import { FileEvent } from "Enums/FileEvent";
import type { DiffState } from "Enums/DiffState";
import type VaultkeeperAIPlugin from "main";
import { getConfig } from "Helpers/ObsidianInternals";
import { isNotePath } from "Helpers/MarkdownStructureHelper";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { IVaultChangeResponse, VaultService } from "./VaultService";

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

/* A view of the vault as it will be once the pending changes are applied. Assumes one change per file. */
export class TemporaryVaultService {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly vaultService: VaultService;

    private vaultChanges: IVaultChange[] = [];

    private readonly pendingPaths = new Set<string>();
    private readonly pendingContent = new Map<string, string>();
    private readonly movedPaths = new Map<string, string>();
    private readonly deletedPaths = new Set<string>();
    private readonly modifiedNotePaths = new Set<string>();
    private readonly liveContent = new Map<string, string | undefined>();

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.vaultService = Resolve<VaultService>(Services.VaultService);
    }

    public getVaultChanges(): IVaultChange[] {
        return this.vaultChanges;
    }

    public addAll(vaultChanges: IVaultChange[]) {
        for (const vaultChange of vaultChanges) {
            this.vaultChanges.push(vaultChange);
            this.track(vaultChange);
        }
    }

    public reset() {
        this.vaultChanges = [];
        this.pendingPaths.clear();
        this.pendingContent.clear();
        this.movedPaths.clear();
        this.deletedPaths.clear();
        this.modifiedNotePaths.clear();
        this.liveContent.clear();
    }

    public exists(path: string): boolean {
        if (this.pendingPaths.has(path)) {
            return true;
        }
        if (this.isRemoved(path)) {
            return false;
        }
        return this.plugin.app.vault.getAbstractFileByPath(path) instanceof TFile;
    }

    public async read(path: string): Promise<string | undefined> {
        const pendingContent = this.pendingContent.get(path);
        if (pendingContent !== undefined) {
            return pendingContent;
        }
        if (this.isRemoved(path)) {
            return undefined;
        }
        if (!this.liveContent.has(path)) {
            this.liveContent.set(path, await this.readLive(path));
        }
        return this.liveContent.get(path);
    }

    public getFirstLinkpathDest(linkpath: string, sourcePath: string): string | undefined {
        if (!linkpath) {
            return sourcePath;
        }

        // Relative links only resolve from the note's folder, never by name elsewhere in the vault
        if (linkpath.startsWith("./") || linkpath.startsWith("../")) {
            const path = join(dirname(sourcePath), linkpath);
            return [path, `${path}.md`].find(candidate => this.exists(candidate));
        }

        const pendingMatch = this.findPendingPath(linkpath);
        if (pendingMatch) {
            return pendingMatch;
        }

        const liveMatch = this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)?.path;
        if (!liveMatch || this.deletedPaths.has(liveMatch)) {
            return undefined;
        }

        // Obsidian rewrites links to a moved file when this setting is on
        const movedTo = this.movedPaths.get(liveMatch);
        if (movedTo !== undefined) {
            return getConfig("alwaysUpdateLinks", this.plugin) === true ? movedTo : undefined;
        }

        return liveMatch;
    }

    public changedNotes(): { path: string, content: string }[] {
        return [...this.pendingContent].map(([path, content]) => ({ path, content }));
    }

    public removedPaths(): string[] {
        return [...this.movedPaths.keys(), ...this.deletedPaths];
    }

    public modifiedPaths(): string[] {
        return [...this.modifiedNotePaths];
    }

    public isChanged(livePath: string): boolean {
        return this.modifiedNotePaths.has(livePath) || this.isRemoved(livePath);
    }

    private track(vaultChange: IVaultChange) {
        const { oldPath, newPath, newContent } = vaultChange;

        switch (vaultChange.changeType) {
            case FileEvent.Create:
                if (newPath) {
                    this.pendingPaths.add(newPath);
                }
                break;
            case FileEvent.Rename:
                if (oldPath && newPath) {
                    this.movedPaths.set(oldPath, newPath);
                    this.pendingPaths.add(newPath);
                }
                break;
            case FileEvent.Delete:
                if (oldPath) {
                    this.deletedPaths.add(oldPath);
                }
                break;
            case FileEvent.Modify:
                if (newPath && isNotePath(newPath)) {
                    this.modifiedNotePaths.add(newPath);
                }
                break;
        }

        if (vaultChange.changeType !== FileEvent.Delete && newPath && isNotePath(newPath) && newContent !== undefined && !vaultChange.base64) {
            this.pendingContent.set(newPath, newContent);
        }
    }

    private isRemoved(path: string): boolean {
        return this.movedPaths.has(path) || this.deletedPaths.has(path);
    }

    private findPendingPath(linkpath: string): string | undefined {
        const target = linkpath.toLowerCase();
        const candidates = [target, `${target}.md`];

        for (const path of this.pendingPaths) {
            const lowerPath = path.toLowerCase();
            if (candidates.some(candidate => lowerPath === candidate || lowerPath.endsWith(`/${candidate}`))) {
                return path;
            }
        }
        return undefined;
    }

    // Read through VaultService so the user's exclusions are respected
    private async readLive(path: string): Promise<string | undefined> {
        const file = this.vaultService.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
            return undefined;
        }
        const result = await this.vaultService.read(file);
        return result instanceof Error ? undefined : result.content;
    }

}

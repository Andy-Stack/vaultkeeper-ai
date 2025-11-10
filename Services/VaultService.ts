import { FileManager, TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type VaultkeeperAIPlugin from "main";
import { Path } from "Enums/Path";
import { escapeRegex, randomSample } from "Helpers/Helpers";
import type { ISearchMatch, ISearchSnippet } from "../Helpers/SearchTypes";
import type { SanitiserService } from "./SanitiserService";
import { FileEvent } from "Enums/FileEvent";
import type { SettingsService } from "./SettingsService";

interface IFileEventArgs {
    oldPath: string;
}

/* This service protects the users vault through their exclusions. The plugin root is excluded by default */
export class VaultService {

    private readonly AGENT_ROOT_DIR = Path.VaultkeeperAIDir;
    private readonly AGENT_ROOT_CONTENTS = `${Path.VaultkeeperAIDir}/**`;

    private readonly vault: Vault;
    private readonly plugin: VaultkeeperAIPlugin;
    private readonly settingsService: SettingsService;
    private readonly fileManager: FileManager;
    private readonly sanitiserService: SanitiserService;

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.vault = this.plugin.app.vault;
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.fileManager = Resolve<FileManager>(Services.FileManager);
        this.sanitiserService = Resolve<SanitiserService>(Services.SanitiserService);
    }

    public registerFileEvents(handleFileEvent: (event: FileEvent, file: TAbstractFile, args: IFileEventArgs) => void) {
        this.plugin.registerEvent(this.vault.on(FileEvent.Create, file => handleFileEvent(FileEvent.Create, file, { oldPath: "" })));
        this.plugin.registerEvent(this.vault.on(FileEvent.Modify, file => handleFileEvent(FileEvent.Modify, file, { oldPath: "" })));
        this.plugin.registerEvent(this.vault.on(FileEvent.Rename, (file, oldPath) => handleFileEvent(FileEvent.Rename, file, { oldPath: oldPath })));
        this.plugin.registerEvent(this.vault.on(FileEvent.Delete, file => handleFileEvent(FileEvent.Delete, file, { oldPath: "" })));
    }

    public getMarkdownFiles(allowAccessToPluginRoot: boolean = false): TFile[] {
        return this.vault.getMarkdownFiles().filter(file => !this.isExclusion(file.path, allowAccessToPluginRoot));
    }

    public getAbstractFileByPath(filePath: string, allowAccessToPluginRoot: boolean = false): TAbstractFile | null {
        filePath = this.sanitiserService.sanitize(filePath);

        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            console.error(`Plugin attempted to retrieve a file that is in the exclusions list: ${filePath}`);
            return null;
        }
        return this.vault.getAbstractFileByPath(filePath);
    }

    public async exists(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<boolean> {
        filePath = this.sanitiserService.sanitize(filePath);

        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            console.error(`Plugin attempted to access a file that is in the exclusions list: ${filePath}`);
            return false;
        }

        return await this.vault.adapter.exists(filePath);
    }

    public async read(file: TFile, allowAccessToPluginRoot: boolean = false): Promise<string> {
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            console.error(`Plugin attempted to read a file that is in the exclusions list: ${file.path}`);
            return "";
        }
        return await this.vault.read(file);
    }

    public async create(filePath: string, content: string, allowAccessToPluginRoot: boolean = false): Promise<TFile> {
        filePath = this.sanitiserService.sanitize(filePath);
        
        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            throw new Error(`Plugin attempted to create a file that is in the exclusion list: ${filePath}`);
        }
        await this.createDirectories(filePath, allowAccessToPluginRoot);
        return await this.vault.create(filePath, content);
    }

    public async modify(file: TFile, content: string, allowAccessToPluginRoot: boolean = false): Promise<void> {
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            console.error(`Plugin attempted to modify a file that is in the exclusions list: ${file.path}`)
            return;
        }
        await this.vault.process(file, () => content);
    }

    public async delete(file: TAbstractFile, allowAccessToPluginRoot: boolean = false): Promise<{ success: true } | { success: false, error: string }> {
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            console.error(`Plugin attempted to delete a file that is in the exclusions list: ${file.path}`)
            return { success: false, error: "File is in exclusion list" };
        }
        try {
            await this.fileManager.trashFile(file);
            return { success: true };
        } catch (error) {
            console.error(`Error deleting file ${file.path}:`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    public async move(sourcePath: string, destinationPath: string, allowAccessToPluginRoot: boolean = false): Promise<{ success: true } | { success: false, error: string }> {
        sourcePath = this.sanitiserService.sanitize(sourcePath);
        destinationPath = this.sanitiserService.sanitize(destinationPath);

        if (this.isExclusion(sourcePath, allowAccessToPluginRoot)) {
            console.error(`Plugin attempted to move a file that is in the exclusions list: ${sourcePath}`)
            return { success: false, error: "Source file is in exclusion list" };
        }

        const file: TAbstractFile | null = this.getAbstractFileByPath(sourcePath, allowAccessToPluginRoot);
        if (file === null) {
            return { success: false, error: "Source file not found" };
        }

        try {
            await this.createDirectories(destinationPath, allowAccessToPluginRoot)
            await this.fileManager.renameFile(file, destinationPath);
            return { success: true };
        } catch (error) {
            console.error(`Error moving file from ${sourcePath} to ${destinationPath}:`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    public async createFolder(path: string, allowAccessToPluginRoot: boolean = false): Promise<TFolder> {
        path = this.sanitiserService.sanitize(path);

        if (this.isExclusion(path, allowAccessToPluginRoot)) {
            throw new Error(`Plugin attempted to create a folder that is in the exclusion list: ${path}`);
        }
        return await this.vault.createFolder(path);
    }

    public async listDirectoryContents(path: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TAbstractFile[]> {
        const sanitisedPath = this.sanitiserService.sanitize(path);

        const files = await this.listFilesInDirectory(sanitisedPath, recursive, allowAccessToPluginRoot);
        const folders = await this.listFoldersInDirectory(sanitisedPath, recursive, allowAccessToPluginRoot);

        return [...files, ...folders] as TAbstractFile[];
    }

    public async listFilesInDirectory(path: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TFile[]> {
        const dir: TAbstractFile | null = this.getAbstractFileByPath(this.sanitiserService.sanitize(path), allowAccessToPluginRoot);

        if (dir == null || !(dir instanceof TFolder)) {
            return [];
        }

        let files: TFile[] = [];
        for (const child of dir.children) {
            if (child instanceof TFile) {
                if (!this.isExclusion(child.path, allowAccessToPluginRoot)) {
                    files.push(child);
                }
            } else if (child instanceof TFolder && recursive) {
                if (!this.isExclusion(child.path, allowAccessToPluginRoot)) {
                    const childFiles = await this.listFilesInDirectory(child.path, recursive, allowAccessToPluginRoot);
                    files = files.concat(childFiles);
                }
            }
        }

        return files;
    }

    public async listFoldersInDirectory(path: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TFolder[]> {
        const dir: TAbstractFile | null = this.getAbstractFileByPath(this.sanitiserService.sanitize(path), allowAccessToPluginRoot);

        if (dir == null || !(dir instanceof TFolder)) {
            return [];
        }

        let folders: TFolder[] = [];
        for (const child of dir.children) {
            if (!(child instanceof TFolder)) {
                continue;
            }

            if (!this.isExclusion(child.path, allowAccessToPluginRoot)) {
                folders.push(child);

                if (recursive) {
                    const childFolders = await this.listFoldersInDirectory(child.path, recursive, allowAccessToPluginRoot);
                    folders = folders.concat(childFolders);
                }
            }
        }

        return folders;
    }

    public async searchVaultFiles(searchTerm: string, allowAccessToPluginRoot: boolean = false): Promise<ISearchMatch[]> {
        let regex: RegExp;
        try {
            regex = new RegExp(searchTerm, "ig");
        } catch {
            regex = new RegExp(escapeRegex(searchTerm), "ig");
        }

        const files: TFile[] = await this.listFilesInDirectory(Path.Root, true, allowAccessToPluginRoot);

        const allMatches: ISearchMatch[] = [];

        for (const file of files) {
            const content = await this.vault.cachedRead(file);
            const snippets = this.extractSnippets(content, regex);

            if (snippets.length > 0) {
                allMatches.push({ file, snippets });
            }
        }

        const flatMatches: { file: TFile; snippet: ISearchSnippet }[] = [];
        for (const match of allMatches) {
            for (const snippet of match.snippets) {
                flatMatches.push({ file: match.file, snippet });
            }
        }

        // randomly sample matches if more than N matches are found
        let selectedMatches: { file: TFile; snippet: ISearchSnippet }[];
        if (flatMatches.length > this.settingsService.settings.searchResultsLimit) {
            selectedMatches = randomSample(flatMatches, this.settingsService.settings.searchResultsLimit);
        } else {
            selectedMatches = flatMatches;
        }

        const resultMap = new Map<TFile, ISearchSnippet[]>();
        for (const match of selectedMatches) {
            const existing = resultMap.get(match.file);
            if (existing) {
                existing.push(match.snippet);
            } else {
                resultMap.set(match.file, [match.snippet]);
            }
        }

        const results: ISearchMatch[] = [];
        for (const [file, snippets] of resultMap.entries()) {
            results.push({ file, snippets });
        }

        // add filename matches
        for (const file of files) {
            if (file.basename.match(regex) &&
                !results.some(result => result.file.basename === file.basename)) {
                results.push({ file, snippets: [] });
            }
        }

        return results;
    }

    public isExclusion(filePath: string, allowAccessToPluginRoot: boolean = false): boolean {
        const exclusions = allowAccessToPluginRoot
            ? this.settingsService.settings.exclusions
            : [this.AGENT_ROOT_DIR, this.AGENT_ROOT_CONTENTS, ...this.settingsService.settings.exclusions];

        return exclusions.some(pattern => {
            if (filePath === pattern) {
                return true;
            }

            // First, temporarily replace wildcards to protect them from escaping
            let regexPattern = pattern
                .replace(/\*\*/g, "::DOUBLESTAR::")    // Temporarily replace **
                .replace(/\*/g, "::SINGLESTAR::")      // Temporarily replace *
                .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
                .replace(/::SINGLESTAR::/g, "[^/]*")   // * matches anything except /
                .replace(/::DOUBLESTAR::/g, ".*");     // ** matches anything including /

            // If pattern ends with /, match the directory and all its contents
            if (pattern.endsWith("/")) {
                regexPattern = regexPattern + ".*";
            }

            // Add anchors for full path matching
            const regex = new RegExp("^" + regexPattern + "(/.*)?$");

            return regex.test(filePath);
        });
    }

    private async createDirectories(filePath: string, allowAccessToPluginRoot: boolean = false) {
        const dirPath: string = filePath.substring(0, filePath.lastIndexOf("/"));

        const dirs: string[] = dirPath.split("/");

        let currentPath = "";
        for (const dir of dirs) {
            if (dir) {
                currentPath = currentPath ? `${currentPath}/${dir}` : dir;
                if (!(await this.exists(currentPath, allowAccessToPluginRoot))) {
                    await this.createFolder(currentPath, allowAccessToPluginRoot);
                }
            }
        }
    }

    private extractSnippets(content: string, regex: RegExp): ISearchSnippet[] {
        const snippets: ISearchSnippet[] = [];
        const snippetSize = this.settingsService.settings.snippetSizeLimit / 2;

        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
            const matchIndex = match.index;
            const matchLength = match[0].length;

            const snippetStart = Math.max(0, matchIndex - snippetSize);
            const snippetEnd = Math.min(content.length, matchIndex + matchLength + snippetSize);

            snippets.push({
                text: content.substring(snippetStart, snippetEnd),
                matchIndex,
                matchLength
            });
        }

        regex.lastIndex = 0;

        return this.mergeOverlappingSnippets(snippets, content);
    }

    private mergeOverlappingSnippets(snippets: ISearchSnippet[], content: string): ISearchSnippet[] {
        if (snippets.length === 0) return snippets;

        snippets.sort((a, b) => a.matchIndex - b.matchIndex);

        const merged: ISearchSnippet[] = [];
        let current = snippets[0];
        const snippetSize = this.settingsService.settings.snippetSizeLimit / 2;

        for (let i = 1; i < snippets.length; i++) {
            const next = snippets[i];

            const currentStart = Math.max(0, current.matchIndex - snippetSize);
            const currentEnd = Math.min(content.length, current.matchIndex + current.matchLength + snippetSize);
            const nextStart = Math.max(0, next.matchIndex - snippetSize);
            const nextEnd = Math.min(content.length, next.matchIndex + next.matchLength + snippetSize);

            if (nextStart <= currentEnd) {
                const mergedStart = Math.min(currentStart, nextStart);
                const mergedEnd = Math.max(currentEnd, nextEnd);

                current = {
                    text: content.substring(mergedStart, mergedEnd),
                    matchIndex: current.matchIndex,
                    matchLength: next.matchIndex + next.matchLength - current.matchIndex
                };
            } else {
                merged.push(current);
                current = next;
            }
        }

        merged.push(current);

        return merged;
    }
}
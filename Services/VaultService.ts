import { FileManager, TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type VaultkeeperAIPlugin from "main";
import { Path } from "Enums/Path";
import { randomSample, shuffleArray } from "Helpers/Helpers";
import { StringTools } from "Helpers/StringTools";
import type { ISearchMatch, ISearchSnippet } from "../Helpers/SearchTypes";
import type { SanitiserService } from "./SanitiserService";
import { FileEvent } from "Enums/FileEvent";
import type { SettingsService } from "./SettingsService";
import { Exception } from "Helpers/Exception";
import type { EventService } from "./EventService";
import { DiffService } from "./DiffService";
import * as path from "path-browserify";
import { Event } from "Enums/Event";

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
    private readonly diffService: DiffService;
    private readonly eventService: EventService;

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        
        this.vault = this.plugin.app.vault;
        this.fileManager = this.plugin.app.fileManager

        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.sanitiserService = Resolve<SanitiserService>(Services.SanitiserService);
        this.diffService = Resolve<DiffService>(Services.DiffService);
        this.eventService = Resolve<EventService>(Services.EventService);
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
            Exception.log(`Plugin attempted to retrieve a file that is in the exclusions list: ${filePath}`);
            return null;
        }
        return this.vault.getAbstractFileByPath(filePath);
    }

    public async exists(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<boolean> {
        filePath = this.sanitiserService.sanitize(filePath);
        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            Exception.log(`Plugin attempted to access a file that is in the exclusions list: ${filePath}`);
            return false;
        }

        return await this.vault.adapter.exists(filePath);
    }

    public async read(file: TFile, allowAccessToPluginRoot: boolean = false): Promise<string> {
        const filePath = this.sanitiserService.sanitize(file.path);
        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            Exception.log(`Plugin attempted to read a file that is in the exclusions list: ${filePath}`);
            return "";
        }
        return await this.vault.read(file);
    }

    public async create(filePath: string, content: string, allowAccessToPluginRoot: boolean = false, requiresConfirmation: boolean = true): Promise<TFile | Error> {
        filePath = this.sanitiserService.sanitize(filePath);
        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            Exception.log(`Plugin attempted to create a file that is in the exclusion list: ${filePath}`);
            return Exception.new(`Failed to create file, permission denied: ${filePath}`);
        }

        const fileName = path.basename(filePath);
        return this.proposeChange(fileName, fileName, "", content, requiresConfirmation, async () => {
            await this.createDirectories(filePath, allowAccessToPluginRoot);
            return await this.vault.create(filePath, content);
        });
    }

    public async modify(file: TFile, content: string, allowAccessToPluginRoot: boolean = false, requiresConfirmation: boolean = true): Promise<TFile | Error> {
        const filePath = this.sanitiserService.sanitize(file.path);
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            Exception.log(`Plugin attempted to modify a file that is in the exclusion list: ${filePath}`);
            return Exception.new(`File does not exist: ${filePath}`);
        }

        return this.proposeChange(file.name, file.name, await this.vault.read(file), content, requiresConfirmation, async () => {
            await this.vault.process(file, () => content);
            return file;
        });
    }

    public async delete(file: TAbstractFile, allowAccessToPluginRoot: boolean = false): Promise<void | Error> {
        const filePath = this.sanitiserService.sanitize(file.path);
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            Exception.log(`Plugin attempted to delete a file that is in the exclusions list: ${filePath}`)
            return Exception.new(`File does not exist: ${filePath}`);
        }
        try {
            await this.fileManager.trashFile(file);
        } catch (error) {
            Exception.log(error);
            return Exception.new(error);
        }
    }

    public async move(sourcePath: string, destinationPath: string, allowAccessToPluginRoot: boolean = false): Promise<void | Error> {
        sourcePath = this.sanitiserService.sanitize(sourcePath);
        destinationPath = this.sanitiserService.sanitize(destinationPath);
        const file = this.getAbstractFileByPath(sourcePath, allowAccessToPluginRoot);
        
        if (file === null) {
            return Exception.new(`File does not exist: ${sourcePath}`);
        }

        try {
            await this.createDirectories(destinationPath, allowAccessToPluginRoot)
            await this.fileManager.renameFile(file, destinationPath);
        } catch (error) {
            Exception.log(error);
            return Exception.new(error);
        }
    }

    public async createFolder(path: string, allowAccessToPluginRoot: boolean = false): Promise<TFolder | Error> {
        path = this.sanitiserService.sanitize(path);
        if (this.isExclusion(path, allowAccessToPluginRoot)) {
            Exception.log(`Plugin attempted to create a folder that is in the exclusion list: ${path}`);
            return Exception.new(`Failed to create folder, permission denied: ${path}`);
        }
        return await this.vault.createFolder(path);
    }

    public async listDirectoryContents(path: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TAbstractFile[]> {
        path = this.sanitiserService.sanitize(path);

        const files = await this.listFilesInDirectory(path, recursive, allowAccessToPluginRoot);
        const folders = await this.listFoldersInDirectory(path, recursive, allowAccessToPluginRoot);

        return [...files, ...folders] as TAbstractFile[];
    }

    public async listFilesInDirectory(path: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TFile[]> {
        path = this.sanitiserService.sanitize(path);

        const dir: TAbstractFile | null = this.getAbstractFileByPath(path, allowAccessToPluginRoot);

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
        path = this.sanitiserService.sanitize(path);

        const dir: TAbstractFile | null = this.getAbstractFileByPath(path, allowAccessToPluginRoot);

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
        if (searchTerm.trim() === "") {
            return [];
        }

        // Always ensure 'g' flag is present for extractSnippets to work correctly
        // (regex.exec in a loop requires 'g' flag to advance, otherwise infinite loop)
        const regex = StringTools.asRegex(searchTerm, ["i", "g"]);

        if (regex === null) {
            return [];
        }

        const files: TFile[] = await this.listFilesInDirectory(Path.Root, true, allowAccessToPluginRoot);

        // Randomize file order to ensure varied results across multiple searches
        const shuffledFiles = shuffleArray(files);

        // Process files in parallel batches with early termination
        const BATCH_SIZE = 100;
        const MAX_MATCHES = this.settingsService.settings.searchResultsLimit * 3;
        const allMatches: ISearchMatch[] = [];

        for (let i = 0; i < shuffledFiles.length; i += BATCH_SIZE) {
            // Early termination: stop if we have enough matches
            if (allMatches.length >= MAX_MATCHES) {
                break;
            }

            const batch = shuffledFiles.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (file) => {
                try {
                    const content = await this.vault.cachedRead(file);
                    const snippets = this.extractSnippets(content, regex);

                    // Check filename match
                    const hasFilenameMatch = file.basename.match(regex) !== null;

                    // Return match if content has snippets OR filename matches
                    if (snippets.length > 0 || hasFilenameMatch) {
                        return { file, snippets };
                    }

                    return null;
                } catch (error) {
                    console.error(`Error processing file ${file.path}:`, error);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);

            for (const result of batchResults) {
                if (result !== null) {
                    allMatches.push(result);
                }
            }
        }

        // Sample files if we have more than the limit
        let selectedMatches: ISearchMatch[];
        if (allMatches.length > this.settingsService.settings.searchResultsLimit) {
            selectedMatches = randomSample(allMatches, this.settingsService.settings.searchResultsLimit);
        } else {
            selectedMatches = allMatches;
        }

        return selectedMatches;
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

    private async createDirectories(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<void | Error> {
        const dirPath: string = filePath.substring(0, filePath.lastIndexOf("/"));

        const dirs: string[] = dirPath.split("/");

        let currentPath = "";
        const failures: string[] = [];
        for (const dir of dirs) {
            if (dir) {
                currentPath = currentPath ? `${currentPath}/${dir}` : dir;
                try {
                    if (!(await this.exists(currentPath, allowAccessToPluginRoot))) {
                        await this.createFolder(currentPath, allowAccessToPluginRoot);
                    }
                } catch (error) {
                    failures.push(currentPath);
                    Exception.log(error);
                }
            }
        }
        if (failures.length > 0) {
            return Exception.new(`Failed to create the following directories: ${String(failures)}`);
        }
    }

    private extractSnippets(content: string, regex: RegExp): ISearchSnippet[] {
        const matchPositions: { matchIndex: number; matchLength: number }[] = [];

        let match: RegExpExecArray | null;

        // First pass: collect all match positions without extracting text
        while ((match = regex.exec(content)) !== null) {
            matchPositions.push({
                matchIndex: match.index,
                matchLength: match[0].length
            });
        }

        regex.lastIndex = 0;

        if (matchPositions.length === 0) {
            return [];
        }

        // Second pass: merge overlapping positions and extract text only once per snippet
        return this.mergeOverlappingSnippets(matchPositions, content);
    }

    private mergeOverlappingSnippets(
        matchPositions: { matchIndex: number; matchLength: number }[],
        content: string
    ): ISearchSnippet[] {
        if (matchPositions.length === 0) return [];

        // Sort by match position
        matchPositions.sort((a, b) => a.matchIndex - b.matchIndex);

        const snippetSize = this.settingsService.settings.snippetSizeLimit / 2;
        const merged: ISearchSnippet[] = [];
        let current = matchPositions[0];

        for (let i = 1; i < matchPositions.length; i++) {
            const next = matchPositions[i];

            const currentEnd = Math.min(content.length, current.matchIndex + current.matchLength + snippetSize);
            const nextStart = Math.max(0, next.matchIndex - snippetSize);

            if (nextStart <= currentEnd) {
                // Merge overlapping matches
                current = {
                    matchIndex: current.matchIndex,
                    matchLength: next.matchIndex + next.matchLength - current.matchIndex
                };
            } else {
                // Extract text only for finalized (non-overlapping) snippet
                const snippetStart = Math.max(0, current.matchIndex - snippetSize);
                const snippetEnd = Math.min(content.length, current.matchIndex + current.matchLength + snippetSize);

                merged.push({
                    text: content.substring(snippetStart, snippetEnd),
                    matchIndex: current.matchIndex,
                    matchLength: current.matchLength
                });

                current = next;
            }
        }

        // Extract text for the last snippet
        const snippetStart = Math.max(0, current.matchIndex - snippetSize);
        const snippetEnd = Math.min(content.length, current.matchIndex + current.matchLength + snippetSize);

        merged.push({
            text: content.substring(snippetStart, snippetEnd),
            matchIndex: current.matchIndex,
            matchLength: current.matchLength
        });

        return merged;
    }

    private async proposeChange<T>(oldFileName: string, newFileName: string, oldContent: string, newContent: string,
        requiresConfirmation: boolean = true, performChange: () => Promise<T>): Promise<T | Error> {
            try {
                const result = requiresConfirmation ?
                    await this.diffService.requestDiff(oldFileName, newFileName, oldContent, newContent) : { accepted: true };

                if (result.accepted) {
                    return await performChange();
                }

                let response = "User rejected this change. Stop all actions and consult with the user";
                if (result.suggestion) {
                    response = `User has rejected the input with the following suggestion: ${result.suggestion}`;
                }
                return Exception.new(response);
            } catch (error) {
                this.eventService.trigger(Event.DiffClosed);
                Exception.log(error);
                return Exception.new(error);
            }
    }
}
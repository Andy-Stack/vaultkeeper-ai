import { arrayBufferToBase64, FileManager, TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type VaultkeeperAIPlugin from "main";
import { Path } from "Enums/Path";
import { pathExtname } from "Helpers/Helpers";
import type { IPageText, ISearchResult, ISearchSnippet } from "../Types/SearchTypes";
import type { SanitiserService } from "./SanitiserService";
import { FileEvent } from "Enums/FileEvent";
import { DEFAULT_SETTINGS, type SettingsService } from "./SettingsService";
import { Exception } from "Helpers/Exception";
import type { EventService } from "./EventService";
import { DiffService } from "./DiffService";
import * as path from "path-browserify";
import { Event } from "Enums/Event";
import { AbortService } from "./AbortService";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { FileType, isBinaryFile, isDocumentFile, isFileType } from "Enums/FileType";
import { readDocument, readPDF } from "Helpers/DocumentHelper";
import { RegexTools } from "Helpers/RegexTools";

interface IFileEventArgs {
    oldPath: string;
}

export interface IVaultOptions {
    recursive?: boolean;
    chunkSize?: number;
    limitResults?: boolean;
    primaryIndex?: number | undefined;
    secondaryIndex?: number | undefined;
    allowAccessToPluginRoot?: boolean;
    requiresConfirmation?: boolean;
}

type ResolvedVaultOptions = Required<Omit<IVaultOptions, 'primaryIndex' | 'secondaryIndex'>> & Pick<IVaultOptions, 'primaryIndex' | 'secondaryIndex'>;

/* This service protects the users vault through their exclusions. The plugin root is excluded by default */
export class VaultService {

    private readonly defaultOptions: ResolvedVaultOptions = {
        recursive: true,
        chunkSize: DEFAULT_SETTINGS.contextSizeLimit,
        limitResults: false,
        primaryIndex: undefined,
        secondaryIndex: undefined,
        allowAccessToPluginRoot: false,
        requiresConfirmation: true
    };

    private readonly AGENT_ROOT_DIR = Path.VaultkeeperAIDir;
    private readonly AGENT_ROOT_CONTENTS = `${Path.VaultkeeperAIDir}/**`;

    private readonly vault: Vault;
    private readonly plugin: VaultkeeperAIPlugin;
    private readonly settingsService: SettingsService;
    private readonly fileManager: FileManager;
    private readonly sanitiserService: SanitiserService;
    private readonly diffService: DiffService;
    private readonly eventService: EventService;

    private settingsSubscription: object;

    private exclusions: string[] = [];
    private rootExclusions: string[] = [];
    private userExclusionRegExps: RegExp[] = [];
    private rootExclusionRegExps: RegExp[] = [];

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);

        this.vault = this.plugin.app.vault;
        this.fileManager = this.plugin.app.fileManager

        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.sanitiserService = Resolve<SanitiserService>(Services.SanitiserService);
        this.diffService = Resolve<DiffService>(Services.DiffService);
        this.eventService = Resolve<EventService>(Services.EventService);

        this.settingsSubscription = this.settingsService.subscribeToSettingsChanged(changed => {
            if (changed.includes("exclusions")) {
                this.buildExclusions();
            }
        });

        this.buildExclusions();
    }

    public dispose() {
        this.settingsService.unsubscribe(this.settingsSubscription);
    }

    public registerFileEvents(handleFileEvent: (event: FileEvent, file: TAbstractFile, args: IFileEventArgs) => void) {
        this.plugin.registerEvent(this.vault.on(FileEvent.Create, file => handleFileEvent(FileEvent.Create, file, { oldPath: "" })));
        this.plugin.registerEvent(this.vault.on(FileEvent.Modify, file => handleFileEvent(FileEvent.Modify, file, { oldPath: "" })));
        this.plugin.registerEvent(this.vault.on(FileEvent.Rename, (file, oldPath) => handleFileEvent(FileEvent.Rename, file, { oldPath: oldPath })));
        this.plugin.registerEvent(this.vault.on(FileEvent.Delete, file => handleFileEvent(FileEvent.Delete, file, { oldPath: "" })));
    }

    public getMarkdownFiles(vaultOptions?: IVaultOptions): TFile[] {
        return this.vault.getMarkdownFiles().filter(file => !this.isExclusion(file.path, this.getOptions(vaultOptions)));
    }

    public getAbstractFileByPath(filePath: string, vaultOptions?: IVaultOptions): TAbstractFile | null {
        filePath = this.sanitiserService.sanitize(filePath);
        if (this.isExclusion(filePath, this.getOptions(vaultOptions))) {
            Exception.log(`Plugin attempted to retrieve a file that is in the exclusions list: ${filePath}`);
            return null;
        }
        return this.vault.getAbstractFileByPath(filePath);
    }

    public async exists(filePath: string, vaultOptions?: IVaultOptions): Promise<boolean> {
        filePath = this.sanitiserService.sanitize(filePath);
        if (this.isExclusion(filePath, this.getOptions(vaultOptions))) {
            Exception.log(`Plugin attempted to access a file that is in the exclusions list: ${filePath}`);
            return false;
        }

        return await this.vault.adapter.exists(filePath, true);
    }

    public async read(file: TFile, vaultOptions?: IVaultOptions): Promise<{ content: string, nextIndex: number | undefined } | Error> {
        const options = this.getOptions(vaultOptions);

        const filePath = this.sanitiserService.sanitize(file.path);
        if (this.isExclusion(filePath, options)) {
            Exception.log(`Plugin attempted to read a file that is in the exclusions list: ${filePath}`);
            return Exception.new(`File does not exist: ${filePath}`);
        }

        const fileExtension = file.extension.toLowerCase();

        if (isBinaryFile(fileExtension)) {
            const arrayBuffer = await this.readBinaryData(file, options);
            if (arrayBuffer) {
                return { content: arrayBufferToBase64(arrayBuffer), nextIndex: undefined };
            }
        }

        let content: string;
        if (isDocumentFile(fileExtension)) {
            const arrayBuffer = await this.readBinaryData(file, options);
            content = arrayBuffer ? (readDocument(arrayBuffer, fileExtension))[0].text : "";
        } else {
            content = await this.vault.read(file);
        }

        if (!options.limitResults) {
            return { content, nextIndex: undefined };
        }

        const index = options.primaryIndex ?? 0;
        const nextIndex = index + options.chunkSize;
        return {
            content: content.slice(index, nextIndex),
            nextIndex: nextIndex < content.length ? nextIndex : undefined
        };
    }

    public async readBinaryData(file: TFile, vaultOptions?: IVaultOptions): Promise<ArrayBuffer | null> {
        const filePath = this.sanitiserService.sanitize(file.path);
        if (this.isExclusion(filePath, this.getOptions(vaultOptions))) {
            Exception.log(`Plugin attempted to read a file that is in the exclusions list: ${filePath}`);
            return null;
        }
        return await this.vault.readBinary(file);
    }

    public async create(filePath: string, content: string, vaultOptions?: IVaultOptions): Promise<TFile | Error> {
        const options = this.getOptions(vaultOptions);
        filePath = this.sanitiserService.sanitize(filePath);

        const fileExtension = pathExtname(filePath);

        if (this.isExclusion(filePath, options)) {
            Exception.log(`Plugin attempted to create a file that is in the exclusion list: ${filePath}`);
            return Exception.new(`Failed to create file, permission denied: ${filePath}`);
        }

        if (isBinaryFile(pathExtname(fileExtension)) || isDocumentFile(pathExtname(fileExtension))) {
            return Exception.new(`Creating ${pathExtname(filePath)} files is not supported`);
        }

        const fileName = path.basename(filePath);
        return this.proposeChange(fileName, fileName, "", content, options, async () => {
            await this.createDirectories(filePath, options);
            return await this.vault.create(filePath, content);
        });
    }

    public async modify(file: TFile, content: string, vaultOptions?: IVaultOptions): Promise<TFile | Error> {
        const options = this.getOptions(vaultOptions);
        const filePath = this.sanitiserService.sanitize(file.path);
        const fileExtension = pathExtname(filePath);

        if (this.isExclusion(file.path, options)) {
            Exception.log(`Plugin attempted to modify a file that is in the exclusion list: ${filePath}`);
            return Exception.new(`File does not exist: ${filePath}`);
        }

        if (isBinaryFile(pathExtname(filePath)) || isDocumentFile(pathExtname(fileExtension))) {
            return Exception.new(`Modifying ${pathExtname(filePath)} files is not supported`);
        }

        const currentContentResult = await this.read(file, options);

        if (currentContentResult instanceof Error) {
            return currentContentResult;
        }

        return this.proposeChange(file.name, file.name, currentContentResult.content, content, options, async () => {
            await this.vault.process(file, () => content);
            return file;
        });
    }

    public async updateFrontmatter(file: TFile, mutate: (frontmatter: Record<string, unknown>) => void, vaultOptions?: IVaultOptions): Promise<TFile | Error> {
        const filePath = this.sanitiserService.sanitize(file.path);
        const fileExtension = pathExtname(filePath);

        if (this.isExclusion(file.path, this.getOptions(vaultOptions))) {
            Exception.log(`Plugin attempted to update frontmatter of a file that is in the exclusion list: ${filePath}`);
            return Exception.new(`File does not exist: ${filePath}`);
        }

        if (isBinaryFile(pathExtname(filePath)) || isDocumentFile(pathExtname(fileExtension))) {
            return Exception.new(`Modifying ${pathExtname(filePath)} files is not supported`);
        }

        try {
            // frontmatter updates are not fed through 'proposeChange'
            await this.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => mutate(frontmatter));
            return file;
        } catch (error) {
            Exception.log(error);
            return Exception.new(error);
        }
    }

    public async patch(file: TFile, oldContent: string[], newContent: string[], vaultOptions?: IVaultOptions): Promise<TFile | Error> {
        const options = this.getOptions(vaultOptions);
        const filePath = this.sanitiserService.sanitize(file.path);
        if (this.isExclusion(file.path, options)) {
            Exception.log(`Plugin attempted to patch a file that is in the exclusion list: ${filePath}`);
            return Exception.new(`File does not exist: ${filePath}`);
        }

        if (isBinaryFile(pathExtname(filePath))) {
            return Exception.new(`Patching ${pathExtname(filePath)} files is not supported`);
        }

        if (oldContent.length !== newContent.length) {
            return Exception.new(`Mismatched patch arrays: ${oldContent.length} old content entries but ${newContent.length} new content entries. Each old content entry must have a corresponding new content entry.`);
        }

        const currentContentResult = await this.read(file, options);

        if (currentContentResult instanceof Error) {
            return currentContentResult;
        }

        const currentContent = currentContentResult.content;

        for (const content of oldContent) {
            if (!currentContent.includes(content) && !RegexTools.toWhitespaceFlexibleRegex(content).test(currentContent)) {
                return Exception.new(`Content to replace was not found in the file, the old content must match exactly. No changes have been made. Unmatched content: "${content}"`);
            }
        }

        let updatedContent = currentContent;
        for (let i = 0; i < oldContent.length; i++) {
            if (updatedContent.includes(oldContent[i])) {
                updatedContent = updatedContent.replace(oldContent[i], newContent[i]);
            } else {
                updatedContent = updatedContent.replace(RegexTools.toWhitespaceFlexibleRegex(oldContent[i]), newContent[i]);
            }
        }

        return this.proposeChange(file.name, file.name, currentContent, updatedContent, options, async () => {
            await this.vault.process(file, () => updatedContent);
            return file;
        });
    }

    public async delete(file: TAbstractFile, vaultOptions?: IVaultOptions): Promise<void | Error> {
        const options = this.getOptions(vaultOptions);
        const filePath = this.sanitiserService.sanitize(file.path);
        const isFile = file instanceof TFile;

        if (this.isExclusion(filePath, options)) {
            Exception.log(`Plugin attempted to delete a ${isFile ? "file" : "folder"} that is in the exclusions list: ${filePath}`)
            return isFile ? Exception.new(`File does not exist: ${filePath} GOT`)
                          : Exception.new(`Deletion failed. The folder or its contents may be protected: ${filePath}`);
        }

        // handle file deletion
        if (isFile) {
            const currentContentResult = await this.read(file, options)

            if (currentContentResult instanceof Error) {
                return currentContentResult;
            }

            return this.proposeChange(file.name, file.name, currentContentResult.content, "", options, async () => {
                await this.fileManager.trashFile(file);
            });
        }

        // handle folder deletion
        try {
            await this.fileManager.trashFile(file);
        } catch (error) {
            Exception.log(error);
            return Exception.new(error);
        }
    }

    public async move(sourcePath: string, destinationPath: string, vaultOptions?: IVaultOptions): Promise<void | Error> {
        const options = this.getOptions(vaultOptions);
        sourcePath = this.sanitiserService.sanitize(sourcePath);
        destinationPath = this.sanitiserService.sanitize(destinationPath);
        const file = this.getAbstractFileByPath(sourcePath, options);

        if (file === null) {
            return Exception.new(`Move failed as source does not exist: ${sourcePath}`);
        }

        const isFile = file instanceof TFile;

        if (this.isExclusion(destinationPath, options)) {
            return Exception.new(`Failed to rename "${sourcePath}" to "${destinationPath}", permission denied.`)
        }

        try {
            if (isFile) {
                await this.createDirectories(destinationPath, options);
            } else {
                const parentPath = destinationPath.substring(0, destinationPath.lastIndexOf("/"));
                if (parentPath) await this.createDirectories(parentPath, options);
            }
            await this.fileManager.renameFile(file, destinationPath);
        } catch (error) {
            Exception.log(error);
            return Exception.new(error);
        }
    }

    public async createBinary(filePath: string, data: ArrayBuffer, vaultOptions?: IVaultOptions): Promise<TFile | Error> {
        const options = this.getOptions(vaultOptions);
        filePath = this.sanitiserService.sanitize(filePath);
        if (this.isExclusion(filePath, options)) {
            Exception.log(`Plugin attempted to create a binary file that is in the exclusion list: ${filePath}`);
            return Exception.new(`Failed to create file, permission denied: ${filePath}`);
        }

        try {
            await this.createDirectories(filePath, options);
            return await this.vault.createBinary(filePath, data);
        } catch (error) {
            Exception.log(error);
            return Exception.new(error);
        }
    }

    public async modifyBinary(file: TFile, data: ArrayBuffer, vaultOptions?: IVaultOptions): Promise<TFile | Error> {
        const filePath = this.sanitiserService.sanitize(file.path);
        if (this.isExclusion(file.path, this.getOptions(vaultOptions))) {
            Exception.log(`Plugin attempted to modify a binary file that is in the exclusion list: ${filePath}`);
            return Exception.new(`File does not exist: ${filePath}`);
        }

        try {
            await this.vault.modifyBinary(file, data);
            return file;
        } catch (error) {
            Exception.log(error);
            return Exception.new(error);
        }
    }

    public async listDirectoryContents(path: string, vaultOptions?: IVaultOptions): Promise<{ results: TAbstractFile[], nextIndex: number | undefined }> {
        const options = this.getOptions(vaultOptions);
        path = this.sanitiserService.sanitize(path);

        const files = await this.listFilesInDirectory(path, options);
        const folders = await this.listFoldersInDirectory(path, options);

        const contents = [...files, ...folders] as TAbstractFile[];

        if (options.limitResults) {
            const index = options.primaryIndex ?? 0;
            const nextIndex = index + this.settingsService.settings.searchResultsLimit;
            return {
                results: contents.slice(index, nextIndex),
                nextIndex: nextIndex > contents.length - 1 ? undefined : nextIndex
            };
        }

        return { results: contents, nextIndex: undefined };
    }

    public async listFilesInDirectory(path: string, vaultOptions?: IVaultOptions): Promise<TFile[]> {
        const options = this.getOptions(vaultOptions);
        path = this.sanitiserService.sanitize(path);

        const dir: TAbstractFile | null = this.getAbstractFileByPath(path, options);

        if (dir == null || !(dir instanceof TFolder)) {
            return [];
        }

        let files: TFile[] = [];
        for (const child of dir.children) {
            if (child instanceof TFile) {
                if (!this.isExclusion(child.path, options)) {
                    files.push(child);
                }
            } else if (child instanceof TFolder && options.recursive) {
                if (!this.isExclusion(child.path, options)) {
                    const childFiles = await this.listFilesInDirectory(child.path, options);
                    files = files.concat(childFiles);
                }
            }
        }

        return files;
    }

    public async listFoldersInDirectory(path: string, vaultOptions?: IVaultOptions): Promise<TFolder[]> {
        const options = this.getOptions(vaultOptions);
        path = this.sanitiserService.sanitize(path);

        const dir: TAbstractFile | null = this.getAbstractFileByPath(path, options);

        if (dir == null || !(dir instanceof TFolder)) {
            return [];
        }

        let folders: TFolder[] = [];
        for (const child of dir.children) {
            if (!(child instanceof TFolder)) {
                continue;
            }

            if (!this.isExclusion(child.path, options)) {
                folders.push(child);

                if (options.recursive) {
                    const childFolders = await this.listFoldersInDirectory(child.path, options);
                    folders = folders.concat(childFolders);
                }
            }
        }

        return folders;
    }

    public async searchVaultFiles(searchTerm: string, vaultOptions?: IVaultOptions): Promise<ISearchResult | Error> {
        const options = this.getOptions(vaultOptions);
        // Always ensure 'g' flag is present for extractSnippets to work correctly
        // (regex.exec in a loop requires 'g' flag to advance, otherwise infinite loop)
        const regex = RegexTools.asRegex(searchTerm, ["i", "g"]);

        if (regex instanceof Error) {
            return regex;
        }

        let fileNameMatches: string[] = [];
        let fileContentsMatches: { file: TFile, snippets: ISearchSnippet[] }[] = [];

        const literals = RegexTools.extractRegexLiterals(regex);
        const resultsLimit = options.limitResults ? this.settingsService.settings.searchResultsLimit : Infinity;

        const files: TFile[] = await this.listFilesInDirectory(Path.Root, options);
        files.sort(VaultService.recentFileSorter());

        const primaryIndex = options.primaryIndex ?? 0;
        const secondaryIndex = options.secondaryIndex ?? 0;

        const fileNamesExhausted = primaryIndex < 0 || primaryIndex > files.length - 1;
        const fileContentsExhausted = secondaryIndex < 0 || secondaryIndex > files.length - 1;

        let fileNameIndex = primaryIndex;
        let fileNameLimitIndex: number | undefined;

        while (!fileNamesExhausted && fileNameIndex < files.length) {
            if (fileNameLimitIndex !== undefined) {
                break;
            }
            const file = files[fileNameIndex];

            const hasFilenameMatch = file.basename.match(regex) !== null || file.name.match(regex) !== null;
            if (hasFilenameMatch) {
                fileNameMatches.push(file.path);
                if (fileNameMatches.length >= resultsLimit) {
                    fileNameLimitIndex = fileNameIndex;
                }
            }

            fileNameIndex++;
        }

        const start = performance.now();

        let contentLimitIndex: number | undefined;

        let fileContentIndex = secondaryIndex;
        while (!fileContentsExhausted && fileContentIndex < files.length) {
            if (contentLimitIndex !== undefined) {
                break;
            }

            const file = files[fileContentIndex];

            if (performance.now() - start > this.settingsService.settings.searchTimeLimit) {
                break;
            }

            try {
                if (contentLimitIndex === undefined) {
                    let content;
                    const fileExtension = file.extension.toLocaleLowerCase();

                    if (isFileType(fileExtension, FileType.PDF)) {
                        const arrayBuffer = await this.vault.readBinary(file);
                        content = await readPDF(arrayBuffer);
                    } else if (isDocumentFile(fileExtension)) {
                        const arrayBuffer = await this.vault.readBinary(file);
                        content = readDocument(arrayBuffer, fileExtension);
                    } else {
                        content = [{ text: await this.vault.cachedRead(file), pageNumber: 1 }] as IPageText[];
                    }

                    let snippets: ISearchSnippet[] = [];
                    literals.forEach(literal => {
                        snippets.push(...this.extractLiteralSnippets(content, literal));
                    });

                    if (snippets.length === 0) {
                        snippets = this.extractSnippets(content, regex);
                    }

                    if (snippets.length > 0) {
                        fileContentsMatches.push({ file, snippets });
                        if (fileContentsMatches.length >= resultsLimit) {
                            contentLimitIndex = fileContentIndex;
                        }
                    }
                }
            } catch (error) {
                Exception.log(error);
            } finally {
                fileContentIndex++;
            }
        }

        const nextFileNameIndex = fileNameIndex < files.length ? fileNameIndex : undefined;
        const nextContentIndex = fileContentIndex < files.length ? fileContentIndex : undefined;

        return {
            fileNameMatches: fileNameMatches,
            fileContentMatches: fileContentsMatches,
            nextFileNamesIndex: nextFileNameIndex,
            nextFileContentsIndex: nextContentIndex
        };
    }

    public isExclusion(filePath: string, vaultOptions?: IVaultOptions): boolean {
        const options = this.getOptions(vaultOptions);
        const exclusions = options.allowAccessToPluginRoot ? this.exclusions : this.rootExclusions;
        const exclusionRegExps = options.allowAccessToPluginRoot ? this.userExclusionRegExps : this.rootExclusionRegExps;

        if (exclusions.some(exclusion => filePath === exclusion)) {
            return true;
        }

        return exclusionRegExps.some(exclusion => {
            return exclusion.test(filePath);
        });
    }

    public async createDirectories(filePath: string, vaultOptions?: IVaultOptions): Promise<void | Error> {
        const options = this.getOptions(vaultOptions);
        const dirPath: string = path.extname(filePath)
            ? filePath.substring(0, filePath.lastIndexOf("/"))
            : filePath;

        const dirs: string[] = dirPath.split("/");

        let currentPath = "";
        const failures: string[] = [];
        for (const dir of dirs) {
            if (dir) {
                currentPath = currentPath ? `${currentPath}/${dir}` : dir;
                if (!(await this.exists(currentPath, options))) {
                    const result = await this.createDirectory(currentPath, options);
                    if (result instanceof Error) {
                        failures.push(currentPath);
                    }
                }
            }
        }
        if (failures.length > 0) {
            return Exception.new(`Failed to create the following directories: ${String(failures)}`);
        }
    }

    private async createDirectory(path: string, options: IVaultOptions): Promise<TFolder | Error> {
        path = this.sanitiserService.sanitize(path);
        if (this.isExclusion(path, options)) {
            Exception.log(`Plugin attempted to create a folder that is in the exclusion list: ${path}`);
            return Exception.new(`Failed to create folder, permission denied: ${path}`);
        }
        return await this.vault.createFolder(path);
    }

    private extractLiteralSnippets(pages: IPageText[], literal: string): ISearchSnippet[] {
        const allSnippets: ISearchSnippet[] = [];

        for (const page of pages) {
            const matchPositions: { matchIndex: number; matchLength: number }[] = [];

            let matchIndex = page.text.indexOf(literal);
            while (matchIndex !== -1) {
                matchPositions.push({ matchIndex, matchLength: literal.length });
                matchIndex = page.text.indexOf(literal, matchIndex + literal.length);
            }

            if (matchPositions.length > 0) {
                const pageSnippets = this.mergeOverlappingSnippets(matchPositions, page.text, page.pageNumber);
                allSnippets.push(...pageSnippets);
            }
        }

        return allSnippets;
    }

    private extractSnippets(pages: IPageText[], regex: RegExp): ISearchSnippet[] {
        const allSnippets: ISearchSnippet[] = [];

        for (const page of pages) {
            const matchPositions: { matchIndex: number; matchLength: number }[] = [];
            let match: RegExpExecArray | null;

            // First pass: collect all match positions without extracting text
            while ((match = regex.exec(page.text)) !== null) {
                matchPositions.push({
                    matchIndex: match.index,
                    matchLength: match[0].length
                });
            }

            regex.lastIndex = 0;

            if (matchPositions.length > 0) {
                // Second pass: merge overlapping positions and extract text only once per snippet
                const pageSnippets = this.mergeOverlappingSnippets(matchPositions, page.text, page.pageNumber);
                allSnippets.push(...pageSnippets);
            }
        }

        return allSnippets;
    }

    private mergeOverlappingSnippets(matchPositions: { matchIndex: number; matchLength: number }[], content: string, pageNumber: number
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
                    matchLength: current.matchLength,
                    pageNumber: pageNumber
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
            matchLength: current.matchLength,
            pageNumber: pageNumber
        });

        return merged;
    }

    private buildExclusions() {
        this.exclusions = this.settingsService.settings.exclusions;
        this.rootExclusions = this.exclusions.concat(this.AGENT_ROOT_DIR, this.AGENT_ROOT_CONTENTS);

        this.userExclusionRegExps = this.exclusions.map(exclusion => this.prepareExclusionRegex(exclusion));
        this.rootExclusionRegExps = [
            ...this.userExclusionRegExps,
            this.prepareExclusionRegex(this.AGENT_ROOT_DIR),
            this.prepareExclusionRegex(this.AGENT_ROOT_CONTENTS)
        ];
    }

    private prepareExclusionRegex(exclusion: string) {
        // First, temporarily replace wildcards to protect them from escaping
        let regexPattern = exclusion
            .replace(/\*\*/g, "::DOUBLESTAR::")    // Temporarily replace **
            .replace(/\*/g, "::SINGLESTAR::")      // Temporarily replace *
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
            .replace(/::SINGLESTAR::/g, "[^/]*")   // * matches anything except /
            .replace(/::DOUBLESTAR::/g, ".*");     // ** matches anything including /

        // If pattern ends with /, match the directory and all its contents
        if (exclusion.endsWith("/")) {
            regexPattern = regexPattern + ".*";
        }

        // Add anchors for full path matching
        return new RegExp("^" + regexPattern + "(/.*)?$");
    }

    private async proposeChange<T>(oldFileName: string, newFileName: string, oldContent: string, newContent: string,
        options: IVaultOptions, performChange: () => Promise<T>): Promise<T | Error> {
            try {
                const result = this.settingsService.settings.freeEdit || !options.requiresConfirmation ? { accepted: true } :
                    await this.diffService.requestDiff(oldFileName, newFileName, oldContent, newContent);

                if (result.accepted) {
                    return await performChange();
                }

                let response = AIToolResponse.UserRejectionMessage;
                if (result.suggestion) {
                    response = `${AIToolResponse.UserSuggestionMessage}\n${result.suggestion}`;
                }
                return Exception.new(response);
            } catch (error) {
                if (AbortService.isAbortError(error)) {
                    throw error;
                }
                this.eventService.trigger(Event.DiffClosed);
                Exception.log(error);

                return Exception.new(error);
            }
    }

    private static recentFileSorter() {
        return (a: TFile, b: TFile) => {
            const result = b.stat.mtime - a.stat.mtime;
            if (result !== 0) {
                return result;
            }
            return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
        };
    }

    private getOptions(vaultOptions?: IVaultOptions): ResolvedVaultOptions {
        return {
          recursive: vaultOptions?.recursive ?? this.defaultOptions.recursive,
          chunkSize: vaultOptions?.chunkSize ?? this.defaultOptions.chunkSize,
          limitResults: vaultOptions?.limitResults ?? this.defaultOptions.limitResults,
          primaryIndex: vaultOptions?.primaryIndex ?? this.defaultOptions.primaryIndex,
          secondaryIndex: vaultOptions?.secondaryIndex ?? this.defaultOptions.secondaryIndex,
          allowAccessToPluginRoot: vaultOptions?.allowAccessToPluginRoot ?? this.defaultOptions.allowAccessToPluginRoot,
          requiresConfirmation: vaultOptions?.requiresConfirmation ?? this.defaultOptions.requiresConfirmation
        };
    }
      
}
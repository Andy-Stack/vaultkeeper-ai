import { FileManager, TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type AIAgentPlugin from "main";
import { Path } from "Enums/Path";
import { escapeRegex, randomSample } from "Helpers/Helpers";
import type { SearchMatch, SearchSnippet } from "../Helpers/SearchTypes";
import type { SanitiserService } from "./SanitiserService";

/* This service protects the users vault through their exclusions. The plugin root is excluded by default */
export class VaultService {

    private readonly AGENT_ROOT = `${Path.AIAgentDir}/**`;
    private readonly USER_INSTRUCTION = Path.UserInstruction;

    private readonly plugin: AIAgentPlugin;
    private readonly fileManager: FileManager;
    private readonly vault: Vault;
    private readonly sanitiserService: SanitiserService;

    public constructor() {
        this.plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
        this.fileManager = Resolve<FileManager>(Services.FileManager);
        this.vault = this.plugin.app.vault;
        this.sanitiserService = Resolve<SanitiserService>(Services.SanitiserService);
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

    public exists(filePath: string, allowAccessToPluginRoot: boolean = false): boolean {
        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            console.error(`Plugin attempted to access a file that is in the exclusions list: ${filePath}`);
            return false;
        }
        return this.vault.getAbstractFileByPath(filePath) instanceof TFile;
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

    public async delete(file: TAbstractFile, force?: boolean, allowAccessToPluginRoot: boolean = false): Promise<{ success: true } | { success: false, error: string }> {
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            console.error(`Plugin attempted to delete a file that is in the exclusions list: ${file.path}`)
            return { success: false, error: "File is in exclusion list" };
        }
        try {
            await this.vault.delete(file, force);
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

    public async listFilesInDirectory(dirPath: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TFile[]> {
        const dir: TAbstractFile | null = this.getAbstractFileByPath(this.sanitiserService.sanitize(dirPath), true);

        if (dir == null || !(dir instanceof TFolder)) {
            return [];
        }

        let files: TFile[] = [];
        for (let child of dir.children) {
            if (child instanceof TFile) {
                files.push(child);
            } else if (child instanceof TFolder && recursive) {
                const childFiles = await this.listFilesInDirectory(child.path, recursive, allowAccessToPluginRoot);
                files = files.concat(childFiles);
            }
        }

        // if an excluded file or directory is present we just filter it rather than 
        // reporting it since this function could touch a large part of the vault
        return files.filter(file => !this.isExclusion(file.path, allowAccessToPluginRoot));
    }

    public async searchVaultFiles(searchTerm: string): Promise<SearchMatch[]> {
        let regex: RegExp;
        try {
            regex = new RegExp(searchTerm, "ig");
        } catch {
            regex = new RegExp(escapeRegex(searchTerm), "ig");
        }

        const files: TFile[] = await this.listFilesInDirectory(Path.Root);

        const allMatches: SearchMatch[] = [];

        for (const file of files) {
            const content = await this.vault.cachedRead(file);
            const snippets = this.extractSnippets(content, regex);

            if (snippets.length > 0) {
                allMatches.push({ file, snippets });
            }
        }

        const flatMatches: { file: TFile; snippet: SearchSnippet }[] = [];
        for (const match of allMatches) {
            for (const snippet of match.snippets) {
                flatMatches.push({ file: match.file, snippet });
            }
        }

        // If more than 20 matches, randomly sample 20
        let selectedMatches: { file: TFile; snippet: SearchSnippet }[];
        if (flatMatches.length > 20) {
            selectedMatches = randomSample(flatMatches, 20);
        } else {
            selectedMatches = flatMatches;
        }

        const resultMap = new Map<TFile, SearchSnippet[]>();
        for (const match of selectedMatches) {
            const existing = resultMap.get(match.file);
            if (existing) {
                existing.push(match.snippet);
            } else {
                resultMap.set(match.file, [match.snippet]);
            }
        }

        const results: SearchMatch[] = [];
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

    private async createDirectories(filePath: string, allowAccessToPluginRoot: boolean = false) {
        const dirPath: string = filePath.substring(0, filePath.lastIndexOf('/'));

        const dirs: string[] = dirPath.split('/');

        let currentPath = "";
        for (const dir of dirs) {
            if (dir) {
                currentPath = currentPath ? `${currentPath}/${dir}` : dir;
                if (this.getAbstractFileByPath(currentPath, allowAccessToPluginRoot) == null) {
                    await this.createFolder(currentPath, allowAccessToPluginRoot);
                }
            }
        }
    }

    private extractSnippets(content: string, regex: RegExp): SearchSnippet[] {
        const snippets: SearchSnippet[] = [];
        const maxContextLength = 300;

        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
            const matchIndex = match.index;
            const matchLength = match[0].length;

            const snippetStart = Math.max(0, matchIndex - maxContextLength);
            const snippetEnd = Math.min(content.length, matchIndex + matchLength + maxContextLength);

            snippets.push({
                text: content.substring(snippetStart, snippetEnd),
                matchIndex,
                matchLength
            });
        }

        regex.lastIndex = 0;

        return this.mergeOverlappingSnippets(snippets, content);
    }

    private mergeOverlappingSnippets(snippets: SearchSnippet[], content: string): SearchSnippet[] {
        if (snippets.length === 0) return snippets;

        snippets.sort((a, b) => a.matchIndex - b.matchIndex);

        const merged: SearchSnippet[] = [];
        let current = snippets[0];
        const maxContextLength = 300;

        for (let i = 1; i < snippets.length; i++) {
            const next = snippets[i];

            const currentStart = Math.max(0, current.matchIndex - maxContextLength);
            const currentEnd = Math.min(content.length, current.matchIndex + current.matchLength + maxContextLength);
            const nextStart = Math.max(0, next.matchIndex - maxContextLength);
            const nextEnd = Math.min(content.length, next.matchIndex + next.matchLength + maxContextLength);

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

    private isExclusion(filePath: string, allowAccessToPluginRoot: boolean = false): boolean {
        // the ai should never be able to edit the user instruction
        const exclusions = allowAccessToPluginRoot
            ? [this.USER_INSTRUCTION, ...this.plugin.settings.exclusions]
            : [this.AGENT_ROOT, ...this.plugin.settings.exclusions];

        return exclusions.some(pattern => {
            if (filePath === pattern) {
                return true;
            }

            let regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
                .replace(/\*\*/g, '::DOUBLESTAR::')    // Temporarily replace **
                .replace(/\*/g, '[^/]*')               // * matches anything except /
                .replace(/::DOUBLESTAR::/g, '.*');     // ** matches anything including /

            // If pattern ends with /, match the directory and all its contents
            if (pattern.endsWith('/')) {
                regexPattern = regexPattern + '.*';
            }

            // Add anchors for full path matching
            const regex = new RegExp('^' + regexPattern + '$');

            return regex.test(filePath);
        });
    }
}
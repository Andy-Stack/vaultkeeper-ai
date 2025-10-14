import { TFile, TFolder, type TAbstractFile, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type AIAgentPlugin from "main";
import { Path } from "Enums/Path";
import { escapeRegex } from "Helpers/Helpers";
import type { SearchMatch, SearchSnippet } from "../Helpers/SearchTypes";

/* This service protects the users vault through their exclusions. The plugin root is excluded by default */
export class VaultService {

    private readonly AGENT_ROOT = `${Path.Root}/**`;
    private readonly USER_INSTRUCTION = Path.UserInstruction;

    private readonly plugin: AIAgentPlugin;
    private readonly vault: Vault;

    public constructor() {
        this.plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
        this.vault = this.plugin.app.vault;
    }

    public getMarkdownFiles(allowAccessToPluginRoot: boolean = false): TFile[] {
        return this.vault.getMarkdownFiles().filter(file => !this.isExclusion(file.path, allowAccessToPluginRoot));
    }

    public getAbstractFileByPath(filePath: string, allowAccessToPluginRoot: boolean = false): TAbstractFile | null {
        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            console.log(`Plugin attempted to retrieve a file that is in the exclusions list: ${filePath}`);
            return null;
        }
        return this.vault.getAbstractFileByPath(filePath);
    }

    public async read(file: TFile, allowAccessToPluginRoot: boolean = false): Promise<string> {
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            console.log(`Plugin attempted to read a file that is in the exclusions list: ${file.path}`);
            return "";
        }
        return await this.vault.read(file);
    }

    public async create(filePath: string, content: string, allowAccessToPluginRoot: boolean = false): Promise<TFile> {
        if (this.isExclusion(filePath, allowAccessToPluginRoot)) {
            throw new Error(`Plugin attempted to create a file that is in the exclusion list: ${filePath}`);
        }
        return await this.vault.create(filePath, content);
    }

    public async modify(file: TFile, content: string, allowAccessToPluginRoot: boolean = false): Promise<void> {
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            console.log(`Plugin attempted to modify a file that is in the exclusions list: ${file.path}`)
            return;
        }
        await this.vault.modify(file, content);
    }

    public async delete(file: TAbstractFile, force?: boolean, allowAccessToPluginRoot: boolean = false): Promise<void> {
        if (this.isExclusion(file.path, allowAccessToPluginRoot)) {
            console.log(`Plugin attempted to delete a file that is in the exclusions list: ${file.path}`)
            return;
        }
        await this.vault.delete(file, force);
    }

    public async createFolder(path: string, allowAccessToPluginRoot: boolean = false): Promise<TFolder> {
        if (this.isExclusion(path, allowAccessToPluginRoot)) {
            throw new Error(`Plugin attempted to create a folder that is in the exclusion list: ${path}`);
        }
        return await this.vault.createFolder(path);
    }

    public async listFilesInDirectory(dirPath: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TFile[]> {
        const dir: TAbstractFile | null = this.getAbstractFileByPath(dirPath, true);

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
            regex = new RegExp(searchTerm, "ig"); // Added 'g' flag for global matching
        } catch {
            regex = new RegExp(escapeRegex(searchTerm), "ig");
        }

        const files: TFile[] = this.vault.getFiles().filter(file => !this.isExclusion(file.path));

        // Collect all matches from all files
        const allMatches: SearchMatch[] = [];

        for (const file of files) {
            const content = await this.vault.cachedRead(file);
            const snippets = this.extractSnippets(content, regex);

            if (snippets.length > 0) {
                allMatches.push({ file, snippets });
            }
        }

        // Flatten matches for random sampling
        const flatMatches: { file: TFile; snippet: SearchSnippet }[] = [];
        for (const match of allMatches) {
            for (const snippet of match.snippets) {
                flatMatches.push({ file: match.file, snippet });
            }
        }

        // If more than 20 matches, randomly sample 20
        let selectedMatches: { file: TFile; snippet: SearchSnippet }[];
        if (flatMatches.length > 20) {
            selectedMatches = this.randomSample(flatMatches, 20);
        } else {
            selectedMatches = flatMatches;
        }

        // Regroup by file
        const resultMap = new Map<TFile, SearchSnippet[]>();
        for (const match of selectedMatches) {
            const existing = resultMap.get(match.file);
            if (existing) {
                existing.push(match.snippet);
            } else {
                resultMap.set(match.file, [match.snippet]);
            }
        }

        // Convert map to array of SearchMatch objects
        const results: SearchMatch[] = [];
        for (const [file, snippets] of resultMap.entries()) {
            results.push({ file, snippets });
        }

        return results;
    }

    /**
     * Extracts snippets from content based on regex matches.
     * Merges overlapping snippets to avoid duplication.
     */
    private extractSnippets(content: string, regex: RegExp): SearchSnippet[] {
        const snippets: SearchSnippet[] = [];
        const maxContextLength = 300; // Characters before and after the match

        let match: RegExpExecArray | null;

        // Find all matches
        while ((match = regex.exec(content)) !== null) {
            const matchIndex = match.index;
            const matchLength = match[0].length;

            // Calculate snippet boundaries
            const snippetStart = Math.max(0, matchIndex - maxContextLength);
            const snippetEnd = Math.min(content.length, matchIndex + matchLength + maxContextLength);

            snippets.push({
                text: content.substring(snippetStart, snippetEnd),
                matchIndex,
                matchLength
            });
        }

        // Reset regex lastIndex
        regex.lastIndex = 0;

        // Merge overlapping snippets
        return this.mergeOverlappingSnippets(snippets, content);
    }

    /**
     * Merges snippets that overlap in the original content
     */
    private mergeOverlappingSnippets(snippets: SearchSnippet[], content: string): SearchSnippet[] {
        if (snippets.length === 0) return snippets;

        // Sort snippets by match index
        snippets.sort((a, b) => a.matchIndex - b.matchIndex);

        const merged: SearchSnippet[] = [];
        let current = snippets[0];
        const maxContextLength = 300;

        for (let i = 1; i < snippets.length; i++) {
            const next = snippets[i];

            // Calculate the actual boundaries of current and next snippets in the original content
            const currentStart = Math.max(0, current.matchIndex - maxContextLength);
            const currentEnd = Math.min(content.length, current.matchIndex + current.matchLength + maxContextLength);
            const nextStart = Math.max(0, next.matchIndex - maxContextLength);
            const nextEnd = Math.min(content.length, next.matchIndex + next.matchLength + maxContextLength);

            // Check if snippets overlap
            if (nextStart <= currentEnd) {
                // Merge: extend current to include next
                const mergedStart = Math.min(currentStart, nextStart);
                const mergedEnd = Math.max(currentEnd, nextEnd);

                current = {
                    text: content.substring(mergedStart, mergedEnd),
                    matchIndex: current.matchIndex, // Keep the first match index
                    matchLength: next.matchIndex + next.matchLength - current.matchIndex // Total span
                };
            } else {
                // No overlap, save current and move to next
                merged.push(current);
                current = next;
            }
        }

        // Don't forget the last snippet
        merged.push(current);

        return merged;
    }

    /**
     * Randomly samples n items from an array
     */
    private randomSample<T>(array: T[], n: number): T[] {
        const result: T[] = [];
        const taken = new Set<number>();

        while (result.length < n && result.length < array.length) {
            const index = Math.floor(Math.random() * array.length);
            if (!taken.has(index)) {
                taken.add(index);
                result.push(array[index]);
            }
        }

        return result;
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
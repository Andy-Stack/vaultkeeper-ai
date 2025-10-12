import type { TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type AIAgentPlugin from "main";
import { Path } from "Enums/Path";

/* This service protects the users vault through their exclusions. The plugin root is excluded by default */
export class VaultService {

    private readonly AGENT_ROOT = `${Path.Root}/**`;

    private readonly plugin: AIAgentPlugin;
    private readonly vault: Vault;

    public constructor() {
        this.plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
        this.vault = this.plugin.app.vault;
    }

    public getMarkdownFiles(): TFile[] {
        return this.vault.getMarkdownFiles().filter(file => !this.isExclusion(file.path));
    }

    public getAbstractFileByPath(filePath: string): TAbstractFile | null {
        if (this.isExclusion(filePath)) {
            console.log(`Plugin attempted to retrieve a file that is in the exclusions list: ${filePath}`);
            return null;
        } 
        return this.vault.getAbstractFileByPath(filePath);
    }

    public async read(file: TFile): Promise<string> {
        if (this.isExclusion(file.path)) {
            console.log(`Plugin attempted to read a file that is in the exclusions list: ${file.path}`);
            return "";
        } 
        return await this.vault.read(file);
    }

    public async create(filePath: string, content: string): Promise<TFile> {
        if (this.isExclusion(filePath)) {
            throw new Error(`Plugin attempted to create a file that is in the exclusion list: ${filePath}`);
        }
        return await this.vault.create(filePath, content);
    }

    public async modify(file: TFile, content: string): Promise<void> {
        if (this.isExclusion(file.path)) {
            console.log(`Plugin attempted to modify a file that is in the exclusions list: ${file.path}`)
            return;
        } 
        await this.vault.modify(file, content);
    }

    public async delete(file: TAbstractFile, force?: boolean): Promise<void> {
        if (this.isExclusion(file.path)) {
            console.log(`Plugin attempted to delete a file that is in the exclusions list: ${file.path}`)
            return;
        }
        await this.vault.delete(file, force);
    }

    public async createFolder(path: string): Promise<TFolder> {
        if (this.isExclusion(path)) {
            throw new Error(`Plugin attempted to create a folder that is in the exclusion list: ${path}`);
        }
        return await this.vault.createFolder(path);
    }

    /**
     * Checks if a file should be excluded based on configured exclusion patterns.
     * Supports exact matches and glob patterns (**, *).
     */
    private isExclusion(filePath: string): boolean {
        const exclusions = [this.AGENT_ROOT, ...this.plugin.settings.exclusions];

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
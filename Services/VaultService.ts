import { TFile, TFolder, type TAbstractFile, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type AIAgentPlugin from "main";
import { Path } from "Enums/Path";

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
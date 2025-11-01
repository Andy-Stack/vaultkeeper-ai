import type AIAgentPlugin from "main";
import { TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { isValidJson } from "Helpers/Helpers";
import { Path } from "Enums/Path";
import type { VaultService } from "./VaultService";
import type { ISearchMatch } from "../Helpers/SearchTypes";

export class FileSystemService {
    
    private readonly vaultService: VaultService;

    public constructor() {
        this.vaultService = Resolve<VaultService>(Services.VaultService);
    }

    public getVaultFileListForMarkDown() {
        const files: TFile[] = this.vaultService.getMarkdownFiles();
        return files.map(file => {
            return file.path.replace(/\.md$/, "");
        });
    }

    public async readFile(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<string | null> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
        if (file && file instanceof TFile) {
            return await this.vaultService.read(file, allowAccessToPluginRoot);
        }
        return null;
    }

    public async writeFile(filePath: string, content: string, allowAccessToPluginRoot: boolean = false): Promise<boolean | any> {
        try {
            const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
            if (file == null || !(file instanceof TFile)) {
                await this.vaultService.create(filePath, content, allowAccessToPluginRoot);
                return true;
            }
            await this.vaultService.modify(file as TFile, content, allowAccessToPluginRoot);
            return true;
        }
        catch (error) {
            console.error("Error writing file:", error);
            return error;
        }
    }

    public async deleteFile(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<{ success: true } | { success: false, error: string }> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);

        if (!file || !(file instanceof TFile)) {
            return { success: false, error: "File not found" };
        }

        return await this.vaultService.delete(file, undefined, allowAccessToPluginRoot);
    }

    public async moveFile(sourcePath: string, destinationPath: string, allowAccessToPluginRoot: boolean = false): Promise<{ success: true } | { success: false, error: string }> {
        return await this.vaultService.move(sourcePath, destinationPath, allowAccessToPluginRoot);
    }

    public async listFilesInDirectory(dirPath: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TFile[]> {
        return await this.vaultService.listFilesInDirectory(dirPath, recursive, allowAccessToPluginRoot);
    }

    public async listFoldersInDirectory(dirPath: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TFolder[]> {
        return await this.vaultService.listFoldersInDirectory(dirPath, recursive, allowAccessToPluginRoot);
    }

    public async listDirectoryContents(dirPath: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TAbstractFile[]> {
        return await this.vaultService.listDirectoryContents(dirPath, recursive, allowAccessToPluginRoot);
    }

    public async readObjectFromFile(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<object | null> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
        if (file && file instanceof TFile) {
            const content = await this.vaultService.read(file, allowAccessToPluginRoot);
            if (isValidJson(content) === true) {
                return JSON.parse(content);
            }
        }
        return null;
    }

    public async writeObjectToFile(filePath: string, data: object, allowAccessToPluginRoot: boolean = false): Promise<boolean> {
        try {
            const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);

            if (file && file instanceof TFile) {
                await this.vaultService.modify(file, JSON.stringify(data, null, 4), allowAccessToPluginRoot);
            }
            else {
                await this.vaultService.create(filePath, JSON.stringify(data, null, 4), allowAccessToPluginRoot);
            }

            return true;
        } catch (error) {
            console.error("Error writing JSON file:", error);
            return false;
        }
    }

    public async searchVaultFiles(searchTerm: string, allowAccessToPluginRoot: boolean = false): Promise<ISearchMatch[]> {
        return await this.vaultService.searchVaultFiles(searchTerm, allowAccessToPluginRoot);
    }
}
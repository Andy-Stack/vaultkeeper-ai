import type AIAgentPlugin from "main";
import { TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { isValidJson } from "Helpers/Helpers";
import { Path } from "Enums/Path";
import type { VaultService } from "./VaultService";
import type { SearchMatch } from "../Helpers/SearchTypes";

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
            let file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
            if (file == null || !(file instanceof TFile)) {
                await this.createDirectories(this.vaultService, filePath, allowAccessToPluginRoot);
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

    public async deleteFile(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<boolean> {
        try {
            const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);

            if (file && file instanceof TFile) {
                await this.vaultService.delete(file, undefined, allowAccessToPluginRoot);
                return true;
            }

            return false;
        } catch (error) {
            console.error("Error deleting file:", error);
            return false;
        }
    }

    public async listFilesInDirectory(dirPath: string, recursive: boolean = true, allowAccessToPluginRoot: boolean = false): Promise<TFile[]> {
        return await this.vaultService.listFilesInDirectory(dirPath, recursive, allowAccessToPluginRoot);
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
            let file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);

            if (file && file instanceof TFile) {
                await this.vaultService.modify(file, JSON.stringify(data, null, 4), allowAccessToPluginRoot);
            }
            else {
                await this.createDirectories(this.vaultService, filePath, allowAccessToPluginRoot);
                await this.vaultService.create(filePath, JSON.stringify(data, null, 4), allowAccessToPluginRoot);
            }

            return true;
        } catch (error) {
            console.error("Error writing JSON file:", error);
            return false;
        }
    }

    public async searchVaultFiles(searchTerm: string): Promise<SearchMatch[]> {
        return await this.vaultService.searchVaultFiles(searchTerm);
    }

    private async createDirectories(vaultService: VaultService, filePath: string, allowAccessToPluginRoot: boolean = false) {
        const dirPath: string = filePath.substring(0, filePath.lastIndexOf('/'));

        const dirs: string[] = dirPath.split('/');

        let currentPath = "";
        for (const dir of dirs) {
            if (dir) {
                currentPath = currentPath ? `${currentPath}/${dir}` : dir;
                if (vaultService.getAbstractFileByPath(currentPath, allowAccessToPluginRoot) == null) {
                    await vaultService.createFolder(currentPath, allowAccessToPluginRoot);
                }
            }
        }
    }
}
import type AIAgentPlugin from "main";
import { TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { isValidJson } from "Helpers/Helpers";
import { Path } from "Enums/Path";
import type { VaultService } from "./VaultService";

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

    public async readFile(filePath: string): Promise<string | null> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            return await this.vaultService.read(file);
        }
        return null;
    }

    public async writeFile(filePath: string, content: string): Promise<boolean> {
        try {
            let file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath);
            if (file == null || !(file instanceof TFile)) {
                await this.createDirectories(this.vaultService, filePath);
                await this.vaultService.create(filePath, content);
                return true;
            }
            await this.vaultService.modify(file as TFile, content);
            return true;
        }
        catch (error) {
            console.error("Error writing file:", error);
            return false;
        }
    }

    public async deleteFile(filePath: string): Promise<boolean> {
        try {
            const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath);

            if (file && file instanceof TFile) {
                await this.vaultService.delete(file);
                return true;
            }

            return false;
        } catch (error) {
            console.error("Error deleting file:", error);
            return false;
        }
    }

    public async listFilesInDirectory(dirPath: string, recursive: boolean = true): Promise<TFile[]> {
        const dir: TAbstractFile | null = this.vaultService.getAbstractFileByPath(dirPath);
        
        if (dir == null || !(dir instanceof TFolder)) {
            return [];
        }

        let files: TFile[] = [];
        for (let child of dir.children) {
            if (child instanceof TFile) {
                files.push(child);
            } else if (child instanceof TFolder && recursive) {
                const childFiles = await this.listFilesInDirectory(child.path, recursive);
                files = files.concat(childFiles);
            }
        }

        return files;
    }

    public async readObjectFromFile(filePath: string): Promise<object | null> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            const content = await this.vaultService.read(file);
            if (isValidJson(content) === true) {
                return JSON.parse(content);
            }
        }
        return null;
    }

    public async writeObjectToFile(filePath: string, data: object): Promise<boolean> {
        try {
            let file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath);

            if (file && file instanceof TFile) {
                await this.vaultService.modify(file, JSON.stringify(data, null, 4));
            }
            else {
                await this.createDirectories(this.vaultService, filePath);
                await this.vaultService.create(filePath, JSON.stringify(data, null, 4));
            }

            return true;
        } catch (error) {
            console.error("Error writing JSON file:", error);
            return false;
        }
    }

    private async createDirectories(vaultService: VaultService, filePath: string) {
        const dirPath: string = filePath.substring(0, filePath.lastIndexOf('/'));

        const dirs: string[] = dirPath.split('/');

        let currentPath = "";
        for (const dir of dirs) {
            if (dir) {
                currentPath = currentPath ? `${currentPath}/${dir}` : dir;
                if (vaultService.getAbstractFileByPath(currentPath) == null) {
                    await vaultService.createFolder(currentPath);
                }
            }
        }
    }
}
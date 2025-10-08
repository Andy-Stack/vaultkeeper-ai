import type AIAgentPlugin from "main";
import { TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { isValidJson } from "Helpers/Helpers";

export class FileSystemService {

    private vault: Vault;

    public constructor() {
        this.vault = Resolve<AIAgentPlugin>(Services.AIAgentPlugin).app.vault;
    }

    public getVaultFileListForMarkDown() {
        const files: TFile[] = this.vault.getMarkdownFiles();
        return files.map(file => {
            return file.path.replace(/\.md$/, "");
        });
    }

    public async readFile(filePath: string): Promise<string | null> {
        const file: TAbstractFile | null = this.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            return await this.vault.read(file);
        }
        return null;
    }

    public async writeFile(filePath: string, content: string): Promise<boolean> {
        try {
            let file: TAbstractFile | null = this.vault.getAbstractFileByPath(filePath);
            if (file == null || !(file instanceof TFile)) {
                await this.createDirectories(this.vault, filePath);
                await this.vault.create(filePath, content);
                return true;
            }
            this.vault.modify(file as TFile, content);
            return true;
        }
        catch (error) {
            console.error("Error writing file:", error);
            return false;
        }
    }

    public async deleteFile(filePath: string): Promise<boolean> {
        try {
            const file: TAbstractFile | null = this.vault.getAbstractFileByPath(filePath);

            if (file && file instanceof TFile) {
                await this.vault.delete(file);
                return true;
            }

            return false;
        } catch (error) {
            console.error("Error deleting file:", error);
            return false;
        }
    }

    public async listFilesInDirectory(dirPath: string, recursive: boolean = true): Promise<TFile[]> {
        const dir: TAbstractFile | null = this.vault.getAbstractFileByPath(dirPath);
        
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
        const file: TAbstractFile | null = this.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            const content = await this.vault.read(file);
            if (isValidJson(content) === true) {
                return JSON.parse(content);
            }
        }
        return null;
    }

    public async writeObjectToFile(filePath: string, data: object): Promise<boolean> {
        try {
            let file: TAbstractFile | null = this.vault.getAbstractFileByPath(filePath);

            if (file && file instanceof TFile) {
                await this.vault.modify(file, JSON.stringify(data, null, 4));
            }
            else {
                await this.createDirectories(this.vault, filePath);
                await this.vault.create(filePath, JSON.stringify(data, null, 4));
            }

            return true;
        } catch (error) {
            console.error("Error writing JSON file:", error);
            return false;
        }
    }

    private async createDirectories(vault: Vault, filePath: string) {
        const dirPath: string = filePath.substring(0, filePath.lastIndexOf('/'));

        const dirs: string[] = dirPath.split('/');

        let currentPath = "";
        for (const dir of dirs) {
            if (dir) {
                currentPath = currentPath ? `${currentPath}/${dir}` : dir;
                if (vault.getAbstractFileByPath(currentPath) == null) {
                    await vault.createFolder(currentPath);
                }
            }
        }
    }
}
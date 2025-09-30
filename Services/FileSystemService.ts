import type DmsAssistantPlugin from "main";
import { TAbstractFile, TFile, type Vault } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { isValidJson } from "Helpers/Helpers";

export class FileSystemService {

    private vault: Vault;

    public constructor() {
        this.vault = Resolve<DmsAssistantPlugin>(Services.DmsAssistantPlugin).app.vault;
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
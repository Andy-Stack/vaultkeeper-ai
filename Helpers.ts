import { TFile, TFolder, type Vault } from "obsidian";

export function isValidJson(str: string): boolean {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export async function createDirectories(vault: Vault, filePath: string) {
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
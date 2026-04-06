import { TAbstractFile, TFile, TFolder } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { VaultService } from "./VaultService";
import type { ISearchMatch } from "../Types/SearchTypes";
import { Exception } from "Helpers/Exception";

export class FileSystemService {
    
    private readonly vaultService: VaultService;

    public constructor() {
        this.vaultService = Resolve<VaultService>(Services.VaultService);
    }

    public async exists(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<boolean> {
        return await this.vaultService.exists(filePath, allowAccessToPluginRoot);
    }

    public async readFile(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<string | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
        if (file == null) {
            return Exception.new(`File does not exist: ${filePath}`);    
        }
        if (file instanceof TFile) {
            return await this.vaultService.read(file, allowAccessToPluginRoot);
        }
        return Exception.new(`Path is a folder, not a file: ${filePath}`);
    }

    public async readBinaryFile(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<ArrayBuffer | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
        if (file == null) {
            return Exception.new(`File does not exist: ${filePath}`);    
        }
        if (file instanceof TFile) {
            const arrayBuffer = await this.vaultService.readBinaryData(file, allowAccessToPluginRoot);
            if (!arrayBuffer) {
                return Exception.new(`Failed to read binary dta for: ${filePath}`);
            }
            return arrayBuffer;
        }
        return Exception.new(`Path is a folder, not a file: ${filePath}`);
    }

    public async writeFile(filePath: string, content: string, allowAccessToPluginRoot: boolean = false, requiresConfirmation: boolean = true): Promise<TFile | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
        if (file == null || !(file instanceof TFile)) {
            return await this.vaultService.create(filePath, content, allowAccessToPluginRoot, requiresConfirmation);
        }
        return await this.vaultService.modify(file, content, allowAccessToPluginRoot, requiresConfirmation);
    }

    public async writeBinaryFile(filePath: string, data: ArrayBuffer, allowAccessToPluginRoot: boolean = false): Promise<TFile | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
        if (file == null || !(file instanceof TFile)) {
            return await this.vaultService.createBinary(filePath, data, allowAccessToPluginRoot);
        }
        return await this.vaultService.modifyBinary(file, data, allowAccessToPluginRoot);
    }

    public async patchFile(filePath: string, oldContent: string[], newContent: string[], allowAccessToPluginRoot: boolean = false, requiresConfirmation: boolean = true): Promise<TFile | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);

        let fileToPatch: TFile;
        if (file instanceof TFile) {
            fileToPatch = file;
        } else {
            // if the file doesn't exist we may as well create it even though this is just a patch operation
            const result = await this.writeFile(filePath, "", allowAccessToPluginRoot, requiresConfirmation);
            if (result instanceof Error) {
                return result;
            }
            fileToPatch = result;
        }

        return await this.vaultService.patch(fileToPatch, oldContent, newContent, allowAccessToPluginRoot, requiresConfirmation);
    }

    public async deleteFile(filePath: string, allowAccessToPluginRoot: boolean = false, requiresConfirmation: boolean = true): Promise<Error | void> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);

        if (!file) {
            return Exception.new(`File does not exist: ${filePath}`);
        }

        return await this.vaultService.delete(file, allowAccessToPluginRoot, requiresConfirmation);
    }

    public async moveFile(sourcePath: string, destinationPath: string, allowAccessToPluginRoot: boolean = false): Promise<void | Error> {
        return await this.vaultService.move(sourcePath, destinationPath, allowAccessToPluginRoot);
    }

    public async createFolder(path: string, allowAccessToPluginRoot: boolean = false): Promise<void | Error> {
        return await this.vaultService.createDirectories(path, allowAccessToPluginRoot);
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

    public async readObjectFromFile(filePath: string, allowAccessToPluginRoot: boolean = false): Promise<Record<string, unknown> | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);
        if (file && file instanceof TFile) {
            const result = await this.vaultService.read(file, allowAccessToPluginRoot);
            return typeof result === "string" ? JSON.parse(result) as Record<string, unknown> : result;
        }
        return Exception.new(`File not found: ${filePath}`);
    }

    public async writeObjectToFile(filePath: string, data: object, allowAccessToPluginRoot: boolean = false, requiresConfirmation: boolean = true): Promise<TFile | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, allowAccessToPluginRoot);

        let result: TFile | Error;
        if (file && file instanceof TFile) {
            result = await this.vaultService.modify(file, JSON.stringify(data, null, 4), allowAccessToPluginRoot, requiresConfirmation);
        }
        else {
            result = await this.vaultService.create(filePath, JSON.stringify(data, null, 4), allowAccessToPluginRoot, requiresConfirmation);
        }

        return result;
    }

    public async searchVaultFiles(searchTerm: string, allowAccessToPluginRoot: boolean = false): Promise<ISearchMatch[]> {
        return await this.vaultService.searchVaultFiles(searchTerm, allowAccessToPluginRoot);
    }
}
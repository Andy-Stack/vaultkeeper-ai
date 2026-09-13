import { TAbstractFile, TFile, TFolder } from "obsidian";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { IVaultOptions, VaultService } from "./VaultService";
import type { ISearchResult } from "../Types/SearchTypes";
import { Exception } from "Helpers/Exception";

export class FileSystemService {
    
    private readonly vaultService: VaultService;

    public constructor() {
        this.vaultService = Resolve<VaultService>(Services.VaultService);
    }

    public getMarkdownFiles(options?: IVaultOptions): TFile[] {
        return this.vaultService.getMarkdownFiles(options);
    }

    public isExclusion(filePath: string, options?: IVaultOptions): boolean {
        return this.vaultService.isExclusion(filePath, options);
    }

    public async exists(filePath: string, options?: IVaultOptions): Promise<boolean> {
        return await this.vaultService.exists(filePath, options);
    }

    public async readFile(file: TFile, options?: IVaultOptions): Promise<{ content: string, nextIndex: number | undefined } | Error> {
        return await this.vaultService.read(file, options);
    }

    public async readFilePath(filePath: string, options?: IVaultOptions): Promise<{ content: string, nextIndex: number | undefined } | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, options);
        if (file == null) {
            return Exception.new(`File does not exist: ${filePath}`);
        }
        if (file instanceof TFile) {
            return await this.vaultService.read(file, options);
        }
        return Exception.new(`Path is a folder, not a file: ${filePath}`);
    }

    public async readBinaryFile(filePath: string, options?: IVaultOptions): Promise<ArrayBuffer | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, options);
        if (file == null) {
            return Exception.new(`File does not exist: ${filePath}`);    
        }
        if (file instanceof TFile) {
            const arrayBuffer = await this.vaultService.readBinaryData(file, options);
            if (!arrayBuffer) {
                return Exception.new(`Failed to read binary data for: ${filePath}`);
            }
            return arrayBuffer;
        }
        return Exception.new(`Path is a folder, not a file: ${filePath}`);
    }

    public async writeToFile(file: TFile, content: string, options?: IVaultOptions): Promise<TFile | Error> {
        return await this.vaultService.modify(file, content, options);
    }

    public async writeToFilePath(filePath: string, content: string, options?: IVaultOptions): Promise<TFile | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, options);
        if (file == null || !(file instanceof TFile)) {
            return await this.vaultService.create(filePath, content, options);
        }
        return await this.vaultService.modify(file, content, options);
    }

    public async writeBinaryFile(filePath: string, data: ArrayBuffer, options?: IVaultOptions): Promise<TFile | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, options);
        if (file == null || !(file instanceof TFile)) {
            return await this.vaultService.createBinary(filePath, data, options);
        }
        return await this.vaultService.modifyBinary(file, data, options);
    }

    public async patchFile(file: TFile, oldContent: string[], newContent: string[], options?: IVaultOptions): Promise<TFile | Error> {
        return await this.vaultService.patch(file, oldContent, newContent, options);
    }

    public async updateFrontmatter(file: TFile, mutate: (frontmatter: Record<string, unknown>) => void, options?: IVaultOptions): Promise<TFile | Error> {
        return await this.vaultService.updateFrontmatter(file, mutate, options);
    }
    
    public async patchFileAtPath(filePath: string, oldContent: string[], newContent: string[], options?: IVaultOptions): Promise<TFile | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, options);

        let fileToPatch: TFile;
        if (file instanceof TFile) {
            fileToPatch = file;
        } else {
            // if the file doesn't exist we may as well create it even though this is just a patch operation
            const result = await this.writeToFilePath(filePath, "", options);
            if (result instanceof Error) {
                return result;
            }
            fileToPatch = result;
        }

        return await this.vaultService.patch(fileToPatch, oldContent, newContent, options);
    }

    public async deleteFile(filePath: string, options?: IVaultOptions): Promise<Error | void> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, options);

        if (!file || !(file instanceof TFile)) {
            return Exception.new(`File does not exist: ${filePath}`);
        }

        return await this.vaultService.delete(file, options);
    }

    public async moveFile(sourcePath: string, destinationPath: string, options?: IVaultOptions): Promise<void | Error> {
        return await this.vaultService.move(sourcePath, destinationPath, options);
    }

    public async createFolder(path: string, options?: IVaultOptions): Promise<void | Error> {
        return await this.vaultService.createDirectories(path, options);
    }

    public async deleteFolder(path: string, options?: IVaultOptions): Promise<void | Error> {
        if (this.vaultService.isExclusion(path, options)) {
            return Exception.new(`Deletion failed. The folder or its contents may be protected: ${path}`);
        }
    
        const folder: TAbstractFile | null = this.vaultService.getAbstractFileByPath(path, options);
    
        if (!folder || !(folder instanceof TFolder)) {
            return Exception.new(`Folder does not exist: ${path}`);
        }
    
        return await this.vaultService.delete(folder, options);
    }

    public async listFilesInDirectory(dirPath: string, options?: IVaultOptions): Promise<TFile[]> {
        return await this.vaultService.listFilesInDirectory(dirPath, options);
    }

    public async listFoldersInDirectory(dirPath: string, options?: IVaultOptions): Promise<TFolder[]> {
        return await this.vaultService.listFoldersInDirectory(dirPath, options);
    }

    public async listDirectoryContents(dirPath: string, options?: IVaultOptions): Promise<{ results: TAbstractFile[], nextIndex: number | undefined }> {
        return await this.vaultService.listDirectoryContents(dirPath, options);
    }

    public async readObjectFromFile(filePath: string, options?: IVaultOptions): Promise<Record<string, unknown> | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, options);
        if (file && file instanceof TFile) {
            const result = await this.vaultService.read(file, options);
            return result instanceof Error ? result : JSON.parse(result.content) as Record<string, unknown>;
        }
        return Exception.new(`File not found: ${filePath}`);
    }

    public async writeObjectToFile(filePath: string, data: object, options?: IVaultOptions): Promise<TFile | Error> {
        const file: TAbstractFile | null = this.vaultService.getAbstractFileByPath(filePath, options);

        let result: TFile | Error;
        if (file && file instanceof TFile) {
            result = await this.vaultService.modify(file, JSON.stringify(data, null, 4), options);
        }
        else {
            result = await this.vaultService.create(filePath, JSON.stringify(data, null, 4), options);
        }

        return result;
    }

    public async searchVaultFiles(searchTerm: string, options?: IVaultOptions): Promise<ISearchResult | Error> {
        return await this.vaultService.searchVaultFiles(searchTerm, options);
    }
}
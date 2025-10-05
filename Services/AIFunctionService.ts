import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { TFile } from "obsidian";

export class AIFunctionService {
    
    private fileSystemService: FileSystemService = Resolve(Services.FileSystemService);

    public async listVaultFiles(): Promise<object[]> {
        const files: TFile[] = await this.fileSystemService.listFilesInDirectory("/");
        return files.map((file) => ({
            name: file.basename,
            path: file.path,
            size_bytes: file.stat.size
        }));
    }
}
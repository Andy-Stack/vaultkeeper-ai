import { Copy, replaceCopy } from "Enums/Copy";
import { Path } from "Enums/Path";
import { Resolve } from "./DependencyService";
import type { FileSystemService } from "./FileSystemService";
import { Services } from "./Services";
import type { WorkSpaceService } from "./WorkSpaceService";

export class MemoriesService {

    private readonly maxMemoriesLength: number = 10;
    private readonly maxMemoriesLineLength: number = 200;

    private readonly fileSystemService: FileSystemService;
    private readonly workSpaceService: WorkSpaceService;

    constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
        this.workSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
    }

    public async openMemories() {
        if (!await this.fileSystemService.exists(Path.Memories, true)) {
            await this.updateMemories(""); // Create memories file if one doesn't exist
        }
        await this.workSpaceService.openNoteByPath(Path.Memories);
    }

    public async readMemories(): Promise<string> {
        const result = await this.fileSystemService.readFilePath(Path.Memories, true);

        if (result instanceof Error) {
            return Copy.MemoriesEmpty;
        }

        return result;
    }

    public async updateMemories(newMemories: string): Promise<string|Error> {
        if (!this.isValidMemoryLength(newMemories)) {
            return replaceCopy(Copy.MemoriesMaxLengthError,
                [this.maxMemoriesLength.toString(), this.maxMemoriesLineLength.toString()]);
        }

        const result = await this.fileSystemService.writeToFilePath(Path.Memories, newMemories, true, false);
        return result instanceof Error ? result : Copy.MemoriesUpdatedSuccess;
    }

    private isValidMemoryLength(memories: string): boolean {
        const lines = memories.split(/\r?\n/);
        return lines.length <= this.maxMemoriesLength && 
            lines.every(line => line.length <= this.maxMemoriesLineLength);
    }

}
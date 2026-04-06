import { Resolve } from "../DependencyService";
import { Services } from "../Services";
import type { FileSystemService } from "../FileSystemService";
import { AITool, fromString } from "Enums/AITool";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import type { AIToolCall } from "AIClasses/AIToolCall";
import type { ISearchMatch } from "../../Types/SearchTypes";
import { AbortService } from "../AbortService";
import { normalizePath, TAbstractFile, TFile } from "obsidian";
import { Exception } from "Helpers/Exception";
import { Copy } from "Enums/Copy";
import { pathExtname } from "Helpers/Helpers";
import type { MemoriesService } from "Services/MemoriesService";
import { 
    SearchVaultFilesArgsSchema,
    ReadVaultFilesArgsSchema,
    WriteVaultFileArgsSchema,
    DeleteVaultFilesArgsSchema,
    MoveVaultFilesArgsSchema,
    ListVaultFilesArgsSchema,
    PatchVaultFileArgsSchema,
    ReadMemoriesArgsSchema,
    UpdateMemoriesArgsSchema,
    CreateVaultFolderSchema
} from "AIClasses/Schemas/AIToolSchemas";
import type { SettingsService } from "Services/SettingsService";

export class AIToolService {

    private readonly fileSystemService: FileSystemService;
    private readonly memoriesService: MemoriesService;
    private readonly settingsService: SettingsService;
    private readonly abortService: AbortService;

    private lastToolReadMemories: boolean = false;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
        this.memoriesService = Resolve<MemoriesService>(Services.MemoriesService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.abortService = Resolve<AbortService>(Services.AbortService);
    }

    public async performAITool(toolCall: AIToolCall): Promise<AIToolResponse> {

        if (toolCall.name !== AITool.ReadMemories && toolCall.name !== AITool.UpdateMemories) {
            this.lastToolReadMemories = false;
        }

        return await this.abortService.abortableOperation(async () => {
            switch (toolCall.name) {
                case AITool.SearchVaultFiles: {
                    const parseResult = SearchVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.SearchVaultFiles}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.searchVaultFiles(parseResult.data.search_terms), toolCall.toolId);
                }
    
                case AITool.ReadVaultFiles: {
                    const parseResult = ReadVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.ReadVaultFiles}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.readVaultFiles(parseResult.data.file_paths), toolCall.toolId);
                }
    
                case AITool.WriteVaultFile: {
                    const parseResult = WriteVaultFileArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.WriteVaultFile}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.writeVaultFile(parseResult.data.file_path, parseResult.data.content), toolCall.toolId);
                }

                case AITool.PatchVaultFile: {
                    const parseResult = PatchVaultFileArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.PatchVaultFile}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.patchVaultFile(parseResult.data.file_path, parseResult.data.oldContent, parseResult.data.newContent), toolCall.toolId);
                }
    
                case AITool.DeleteVaultFiles: {
                    const parseResult = DeleteVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.DeleteVaultFiles}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.deleteVaultFiles(parseResult.data.file_paths, parseResult.data.confirm_deletion), toolCall.toolId);
                }
    
                case AITool.MoveVaultFiles: {
                    const parseResult = MoveVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.MoveVaultFiles}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.moveVaultFiles(parseResult.data.source_paths, parseResult.data.destination_paths), toolCall.toolId);
                }

                case AITool.CreateVaultFolder: {
                    const parseResult = CreateVaultFolderSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.CreateVaultFolder}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.createVaultFolder(parseResult.data.path), toolCall.toolId);
                }
    
                case AITool.ListVaultFiles: {
                    const parseResult = ListVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.ListVaultFiles}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.listVaultFiles(parseResult.data.path, parseResult.data.recursive), toolCall.toolId);
                }

                case AITool.ReadMemories: {
                    const parseResult = ReadMemoriesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.ReadMemories}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.readMemories(), toolCall.toolId);
                }

                case AITool.UpdateMemories: {
                    const parseResult = UpdateMemoriesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            { error: `Invalid arguments for ${AITool.UpdateMemories}: ${parseResult.error.message}` },
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.updateMemories(parseResult.data.content), toolCall.toolId);
                }
    
                // This is only used by gemini
                case AITool.RequestWebSearch:
                    return new AIToolResponse(toolCall.name, {}, toolCall.toolId)

                // multi-agent functions are handled elsewhere - this shouldn't really ever get hit
                case AITool.ExecuteWorkflow:
                case AITool.ContinuePlanExecution:
                case AITool.SubmitPlan:
                case AITool.AskUserQuestionPlanning:
                case AITool.AskUserQuestionExecution:
                case AITool.CompleteTask:
                case AITool.CompleteStep:
                case AITool.SkipStep:
                case AITool.ReviseStep:
                case AITool.RevisePlan:
                case AITool.CompletePlan:
                case AITool.CancelPlan: {
                    Exception.log(`Multi-agent function ${toolCall.name} should not be handled by AIToolService`);
                    return new AIToolResponse(
                        toolCall.name,
                        { error: `Failed to execute ${toolCall.name}.` },
                        toolCall.toolId
                    );
                }

                case AITool.Unknown:
                default: {
                    const toolCallName = fromString(toolCall.name);
                    const error = `Unknown function request ${toolCallName}`
                    Exception.log(error);
                    return new AIToolResponse(
                        toolCallName,
                        { error: error },
                        toolCall.toolId
                    );
                }
            }
        });
    }

    private async searchVaultFiles(searchTerms: string[]): Promise<object> {
        const results: { searchTerm: string, results: object[] }[] = [];

        for (const searchTerm of searchTerms) {
            const matches: ISearchMatch[] = await this.fileSystemService.searchVaultFiles(searchTerm);
            results.push({
                searchTerm: searchTerm,
                results: matches.map(match => ({
                    path: match.file.path,
                    snippets: match.snippets.map((snippet) => ({
                        text: snippet.text,
                        pageNumber: snippet.pageNumber,
                        matchPosition: snippet.matchIndex
                    }))
                }))
            });
        }

        return results;
    }

    private async readVaultFiles(filePaths: string[]): Promise<object> {
        const results = await Promise.all(
            filePaths.map(async (filePath) => {
                const result = await this.fileSystemService.readFile(filePath);
                if (result instanceof Error) {
                    return { path: filePath, error: result.message };
                }
                return {
                    type: pathExtname(filePath),
                    path: filePath,
                    contents: result
                };
            })
        );
        return { results };
    }

    private async writeVaultFile(filePath: string, content: string): Promise<object> {
        const result = await this.fileSystemService.writeFile(normalizePath(filePath), content);
        if (result instanceof Error) {
            return { success: false, error: result.message };
        }
        return { success: true };
    }

    private async patchVaultFile(filePath: string, oldContent: string[], newContent: string[]): Promise<object> {
        const result = await this.fileSystemService.patchFile(normalizePath(filePath), oldContent, newContent);
        if (result instanceof Error) {
            return { success: false, error: result.message };
        }
        return { success: true };
    }

    private async deleteVaultFiles(filePaths: string[], confirmation: boolean): Promise<object> {
        if (!confirmation) {
            return { error: "Confirmation was false, no action taken" };
        }

        const results = await Promise.all(filePaths.map(async filePath => {
            const result = await this.fileSystemService.deleteFile(filePath);
            if (result instanceof Error) {
                return { path: filePath, success: false, error: result.message };
            }
            return { path: filePath, success: true };
        }));

        return { results };
    }

    private async moveVaultFiles(sourcePaths: string[], destinationPaths: string[]): Promise<object> {
        if (sourcePaths.length !== destinationPaths.length) {
            return { error: "Source paths array length does not equal destination paths array length" };
        }

        const results = await Promise.all(sourcePaths.map(async (sourcePath, index) => {
            const destinationPath = destinationPaths[index];
            const result = await this.fileSystemService.moveFile(sourcePath, destinationPath);
            if (result instanceof Error) {
                return { path: destinationPath, success: false, error: result.message };
            }
            return { path: destinationPath, success: true };
        }));

        return { results };
    }

    private async createVaultFolder(path: string): Promise<object> {
        const result = await this.fileSystemService.createFolder(path);
        if (result instanceof Error) {
            return { path: path, success: false, error: result.message };
        }
        return { path: path, success: true };
    }

    private async listVaultFiles(path: string, recursive: boolean): Promise<object> {
        const files: TAbstractFile[] = await this.fileSystemService.listDirectoryContents(path, recursive);
        return files.map(file => ({
            type: file instanceof TFile ? "file" : "directory",
            path: file.path
        }));
    }

    private async readMemories(): Promise<object> {
        if (!this.settingsService.settings.enableMemories) {
            return { error: Copy.MemoriesDisabledError }
        }
        this.lastToolReadMemories = true;
        return { memories: await this.memoriesService.readMemories() };
    }

    private async updateMemories(content: string): Promise<object> {
        if (!this.settingsService.settings.allowUpdatingMemories) {
            return { error: Copy.MemoriesUpdatingDisabledError };
        }

        if (!this.lastToolReadMemories) {
            return {
                error: Copy.UpdateMemoriesWithoutReadError
            };
        }
        this.lastToolReadMemories = false;

        return { result: await this.memoriesService.updateMemories(content) };
    }
}
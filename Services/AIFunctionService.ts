import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { AIFunction, fromString } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { ISearchMatch } from "../Helpers/SearchTypes";
import { AbortService } from "./AbortService";
import { normalizePath, TAbstractFile, TFile } from "obsidian";
import { Exception } from "Helpers/Exception";
import { pathExtname } from "Helpers/Helpers";
import { 
    SearchVaultFilesArgsSchema,
    ReadVaultFilesArgsSchema,
    WriteVaultFileArgsSchema,
    DeleteVaultFilesArgsSchema,
    MoveVaultFilesArgsSchema,
    ListVaultFilesArgsSchema,
    PatchVaultFileArgsSchema
} from "AIClasses/Schemas/AIFunctionSchemas";

export class AIFunctionService {

    private readonly fileSystemService: FileSystemService;
    private readonly abortService: AbortService;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
        this.abortService = Resolve<AbortService>(Services.AbortService);
    }

    public async performAIFunction(functionCall: AIFunctionCall): Promise<AIFunctionResponse> {
        return await this.abortService.abortableOperation(async () => {
            switch (functionCall.name) {
                case AIFunction.SearchVaultFiles: {
                    const parseResult = SearchVaultFilesArgsSchema.safeParse(functionCall.arguments);
                    if (!parseResult.success) {
                        return new AIFunctionResponse(
                            functionCall.name,
                            { error: `Invalid arguments for ${AIFunction.SearchVaultFiles}: ${parseResult.error.message}` },
                            functionCall.toolId
                        );
                    }
                    return new AIFunctionResponse(functionCall.name, await this.searchVaultFiles(parseResult.data.search_terms), functionCall.toolId);
                }
    
                case AIFunction.ReadVaultFiles: {
                    const parseResult = ReadVaultFilesArgsSchema.safeParse(functionCall.arguments);
                    if (!parseResult.success) {
                        return new AIFunctionResponse(
                            functionCall.name,
                            { error: `Invalid arguments for ${AIFunction.ReadVaultFiles}: ${parseResult.error.message}` },
                            functionCall.toolId
                        );
                    }
                    return new AIFunctionResponse(functionCall.name, await this.readVaultFiles(parseResult.data.file_paths), functionCall.toolId);
                }
    
                case AIFunction.WriteVaultFile: {
                    const parseResult = WriteVaultFileArgsSchema.safeParse(functionCall.arguments);
                    if (!parseResult.success) {
                        return new AIFunctionResponse(
                            functionCall.name,
                            { error: `Invalid arguments for ${AIFunction.WriteVaultFile}: ${parseResult.error.message}` },
                            functionCall.toolId
                        );
                    }
                    return new AIFunctionResponse(functionCall.name, await this.writeVaultFile(parseResult.data.file_path, parseResult.data.content), functionCall.toolId);
                }

                case AIFunction.PatchVaultFile: {
                    const parseResult = PatchVaultFileArgsSchema.safeParse(functionCall.arguments);
                    if (!parseResult.success) {
                        return new AIFunctionResponse(
                            functionCall.name,
                            { error: `Invalid arguments for ${AIFunction.PatchVaultFile}: ${parseResult.error.message}` },
                            functionCall.toolId
                        );
                    }
                    return new AIFunctionResponse(functionCall.name, await this.patchVaultFile(parseResult.data.file_path, parseResult.data.oldContent, parseResult.data.newContent), functionCall.toolId);
                }
    
                case AIFunction.DeleteVaultFiles: {
                    const parseResult = DeleteVaultFilesArgsSchema.safeParse(functionCall.arguments);
                    if (!parseResult.success) {
                        return new AIFunctionResponse(
                            functionCall.name,
                            { error: `Invalid arguments for ${AIFunction.DeleteVaultFiles}: ${parseResult.error.message}` },
                            functionCall.toolId
                        );
                    }
                    return new AIFunctionResponse(functionCall.name, await this.deleteVaultFiles(parseResult.data.file_paths, parseResult.data.confirm_deletion), functionCall.toolId);
                }
    
                case AIFunction.MoveVaultFiles: {
                    const parseResult = MoveVaultFilesArgsSchema.safeParse(functionCall.arguments);
                    if (!parseResult.success) {
                        return new AIFunctionResponse(
                            functionCall.name,
                            { error: `Invalid arguments for ${AIFunction.MoveVaultFiles}: ${parseResult.error.message}` },
                            functionCall.toolId
                        );
                    }
                    return new AIFunctionResponse(functionCall.name, await this.moveVaultFiles(parseResult.data.source_paths, parseResult.data.destination_paths), functionCall.toolId);
                }
    
                case AIFunction.ListVaultFiles: {
                    const parseResult = ListVaultFilesArgsSchema.safeParse(functionCall.arguments);
                    if (!parseResult.success) {
                        return new AIFunctionResponse(
                            functionCall.name,
                            { error: `Invalid arguments for ${AIFunction.ListVaultFiles}: ${parseResult.error.message}` },
                            functionCall.toolId
                        );
                    }
                    return new AIFunctionResponse(functionCall.name, await this.ListVaultFiles(parseResult.data.path, parseResult.data.recursive), functionCall.toolId);
                }
    
                // This is only used by gemini
                case AIFunction.RequestWebSearch:
                    return new AIFunctionResponse(functionCall.name, {}, functionCall.toolId)

                // multi-agent functions are handled elsewhere - this shouldn't really ever get hit
                case AIFunction.CreatePlan:
                case AIFunction.Replan:
                case AIFunction.SubmitPlan:
                case AIFunction.CompleteStep:
                case AIFunction.CancelPlan: {
                    Exception.log(`Multi-agent function ${functionCall.name} should not be handled by AIFunctionService`);
                    return new AIFunctionResponse(
                        functionCall.name,
                        { error: `Failed to execute ${functionCall.name}.` },
                        functionCall.toolId
                    );
                }

                default: {
                    const functionCallName = fromString(functionCall.name);
                    const error = `Unknown function request ${functionCallName}`
                    Exception.log(error);
                    return new AIFunctionResponse(
                        functionCallName,
                        { error: error },
                        functionCall.toolId
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
                    return { path: filePath, error: result.message }
                }
                return {
                    type: pathExtname(filePath),
                    path: filePath,
                    contents: result
                }
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

    private async patchVaultFile(filePath: string, oldContent: string, newContent: string): Promise<object> {
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
                return { path: filePath, success: false, error: result.message }
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
                return { path: destinationPath, success: false, error: result.message }
            }
            return { path: destinationPath, success: true };
        }));

        return { results };
    }

    private async ListVaultFiles(path: string, recursive: boolean): Promise<object> {
        const files: TAbstractFile[] = await this.fileSystemService.listDirectoryContents(path, recursive);
        return files.map(file => ({
            type: file instanceof TFile ? "file" : "directory",
            path: file.path
        }));
    }
}
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { AIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { ISearchMatch } from "../Helpers/SearchTypes";
import { normalizePath, TAbstractFile, TFile } from "obsidian";
import { 
    SearchVaultFilesArgsSchema,
    ReadVaultFilesArgsSchema,
    WriteVaultFileArgsSchema,
    DeleteVaultFilesArgsSchema,
    MoveVaultFilesArgsSchema,
    ListVaultFilesArgsSchema
} from "AIClasses/Schemas/AIFunctionSchemas";

export class AIFunctionService {

    private fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    public async performAIFunction(functionCall: AIFunctionCall): Promise<AIFunctionResponse> {
        switch (functionCall.name) {
            case AIFunction.SearchVaultFiles: {
                const parseResult = SearchVaultFilesArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    return new AIFunctionResponse(
                        functionCall.name,
                        { error: `Invalid arguments for SearchVaultFiles: ${parseResult.error.message}` },
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
                        { error: `Invalid arguments for ReadVaultFiles: ${parseResult.error.message}` },
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
                        { error: `Invalid arguments for WriteVaultFile: ${parseResult.error.message}` },
                        functionCall.toolId
                    );
                }
                return new AIFunctionResponse(functionCall.name, await this.writeVaultFile(parseResult.data.file_path, parseResult.data.content), functionCall.toolId);
            }

            case AIFunction.DeleteVaultFiles: {
                const parseResult = DeleteVaultFilesArgsSchema.safeParse(functionCall.arguments);
                if (!parseResult.success) {
                    return new AIFunctionResponse(
                        functionCall.name,
                        { error: `Invalid arguments for DeleteVaultFiles: ${parseResult.error.message}` },
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
                        { error: `Invalid arguments for MoveVaultFiles: ${parseResult.error.message}` },
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
                        { error: `Invalid arguments for ListVaultFiles: ${parseResult.error.message}` },
                        functionCall.toolId
                    );
                }
                return new AIFunctionResponse(functionCall.name, await this.ListVaultFiles(parseResult.data.path, parseResult.data.recursive), functionCall.toolId);
            }

            // this is only used by gemini
            case AIFunction.RequestWebSearch:
                return new AIFunctionResponse(functionCall.name, {}, functionCall.toolId)

            default: {
                const error = `Unknown function request ${functionCall.name}`
                console.error(error);
                return new AIFunctionResponse(
                    functionCall.name,
                    { error: error },
                    functionCall.toolId
                );
            }
        }
    }

    private async searchVaultFiles(searchTerms: string[]): Promise<object> {
        const results: { searchTerm: string, results: object[] }[] = [];

        for (const searchTerm of searchTerms) {
            const matches: ISearchMatch[] = searchTerm.trim() === "" ? [] : await this.fileSystemService.searchVaultFiles(searchTerm);
            results.push({
                searchTerm: searchTerm,
                results: matches.map(match => ({
                    path: match.file.path,
                    snippets: match.snippets.map((snippet) => ({
                        text: snippet.text,
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
                const content = await this.fileSystemService.readFile(filePath);
                if (content === null) {
                    return { path: filePath, success: false as const, error: `File not found: ${filePath}` };
                }
                return { path: filePath, success: true as const, content };
            })
        );
        return { results };
    }

    private async writeVaultFile(filePath: string, content: string): Promise<object> {
        const result: boolean | unknown = await this.fileSystemService.writeFile(normalizePath(filePath), content);
        return typeof result === "boolean" ? { success: result } : { success: false, error: result };
    }

    private async deleteVaultFiles(filepaths: string[], confirmation: boolean): Promise<object> {
        if (!confirmation) {
            return { error: "Confirmation was false, no action taken" };
        }

        const results = await Promise.all(filepaths.map(async filePath => {
            const result = await this.fileSystemService.deleteFile(filePath);
            if (result.success) {
                return { path: filePath, success: true as const };
            } else {
                return { path: filePath, success: false as const, error: result.error };
            }
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
            if (result.success) {
                return { path: destinationPath, success: true as const };
            } else {
                return { path: destinationPath, success: false as const, error: result.error };
            }
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
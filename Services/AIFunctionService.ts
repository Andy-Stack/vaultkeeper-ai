import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { AIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { ISearchMatch } from "../Helpers/SearchTypes";
import { normalizePath, TFile } from "obsidian";
import { Path } from "Enums/Path";

export class AIFunctionService {

    private fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    public async performAIFunction(functionCall: AIFunctionCall): Promise<AIFunctionResponse> {
        switch (functionCall.name) {
            case AIFunction.SearchVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.searchVaultFiles(functionCall.arguments.search_term), functionCall.toolId);

            case AIFunction.ReadVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.readVaultFiles(functionCall.arguments.file_paths), functionCall.toolId);

            case AIFunction.WriteVaultFile:
                return new AIFunctionResponse(functionCall.name, await this.writeVaultFile(functionCall.arguments.file_path, functionCall.arguments.content), functionCall.toolId);

            case AIFunction.DeleteVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.deleteVaultFiles(functionCall.arguments.file_paths, functionCall.arguments.confirm_deletion), functionCall.toolId);

            case AIFunction.MoveVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.moveVaultFiles(functionCall.arguments.source_paths, functionCall.arguments.destination_paths), functionCall.toolId);

            // this is only used by gemini
            case AIFunction.RequestWebSearch:
                return new AIFunctionResponse(functionCall.name, {}, functionCall.toolId)

            default:
                const error = `Unknown function request ${functionCall.name}`
                console.error(error);
                return new AIFunctionResponse(
                    functionCall.name,
                    { error: error },
                    functionCall.toolId
                );
        }
    }

    private async searchVaultFiles(searchTerm: string): Promise<object> {
        const matches: ISearchMatch[] = searchTerm.trim() === "" ? [] : await this.fileSystemService.searchVaultFiles(searchTerm);

        if (matches.length === 0) {
            const files: TFile[] = await this.fileSystemService.listFilesInDirectory(Path.Root);
            return files.map((file) => ({
                name: file.basename,
                path: file.path
            }));
        }

        return matches.map((match) => ({
            name: match.file.basename,
            path: match.file.path,
            snippets: match.snippets.map((snippet) => ({
                text: snippet.text,
                matchPosition: snippet.matchIndex
            }))
        }));
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
        const result: any = await this.fileSystemService.writeFile(normalizePath(filePath), content);
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
}
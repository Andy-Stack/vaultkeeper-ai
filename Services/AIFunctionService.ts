import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { AIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { SearchMatch } from "../Helpers/SearchTypes";
import { normalizePath, TFile } from "obsidian";
import { Path } from "Enums/Path";

export class AIFunctionService {

    private fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    public async performAIFunction(functionCall: AIFunctionCall): Promise<AIFunctionResponse> {
        switch (functionCall.name) {
            case AIFunction.SearchVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.searchVaultFiles(functionCall.arguments.search_term));

            case AIFunction.ReadVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.readVaultFiles(functionCall.arguments.file_paths));

            case AIFunction.WriteVaultFile:
                return new AIFunctionResponse(functionCall.name, await this.writeVaultFile(functionCall.arguments.file_path, functionCall.arguments.content));

            case AIFunction.DeleteVaultFile:
                return new AIFunctionResponse(functionCall.name, await this.deleteVaultFile(functionCall.arguments.file_path, functionCall.arguments.confirm_deletion));

            // this is only used by gemini
            case AIFunction.RequestWebSearch:
                return new AIFunctionResponse(functionCall.name, {})

            default:
                const error = `Unknown function request ${functionCall.name}`
                console.error(error);
                return new AIFunctionResponse(
                    functionCall.name,
                    { error: error }
                );
        }
    }

    private async searchVaultFiles(searchTerm: string): Promise<object> {
        const matches: SearchMatch[] = searchTerm.trim() === "" ? [] : await this.fileSystemService.searchVaultFiles(searchTerm);

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
        const files = await Promise.all(
            filePaths.map(async (filePath) => {
                const content = await this.fileSystemService.readFile(filePath);
                if (content === null) {
                    return { path: filePath, error: `File not found: ${filePath}` };
                }
                return { path: filePath, content };
            })
        );
        return { files };
    }

    private async writeVaultFile(filePath: string, content: string): Promise<object> {
        const result: any = await this.fileSystemService.writeFile(normalizePath(filePath), content);
        return isBoolean(result) ? { success: result } : { success: false, error: result };
    }

    private async deleteVaultFile(filepath: string, confirmation: boolean): Promise<object> {
        if (!confirmation) {
            return { error: "Confirmation was false, no action taken" };
        }

        const result: any = await this.fileSystemService.deleteFile(filepath);
        return isBoolean(result) ? { success: result } : { success: false, error: result };
    }
}
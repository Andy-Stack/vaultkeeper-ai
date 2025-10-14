import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { AIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { SearchMatch } from "../Helpers/SearchTypes";
import { normalizePath, TFile } from "obsidian";

export class AIFunctionService {

    private fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    public async performAIFunction(functionCall: AIFunctionCall): Promise<AIFunctionResponse> {
        switch (functionCall.name) {
            case AIFunction.SearchVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.searchVaultFiles(functionCall.arguments.search_term));

            case AIFunction.ReadVaultFile:
                return new AIFunctionResponse(functionCall.name, await this.readVaultFile(functionCall.arguments.file_path));

            case AIFunction.WriteVaultFile:
                return new AIFunctionResponse(functionCall.name, await this.writeVaultFile(functionCall.arguments.file_path, functionCall.arguments.content));

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
        const matches: SearchMatch[] = await this.fileSystemService.searchVaultFiles(searchTerm);
        
        if (matches.length === 0) {
            const files: TFile[] = await this.fileSystemService.listFilesInDirectory("/");
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

    private async readVaultFile(filePath: string): Promise<object> {
        const content = await this.fileSystemService.readFile(filePath);
        if (content === null) {
            return { error: `File not found: ${filePath}` };
        }
        return { content };
    }

    private async writeVaultFile(filePath: string, content: string): Promise<object> {
        const result: boolean = await this.fileSystemService.writeFile(normalizePath(filePath), content);
        return isBoolean(result) ? { success: result } : { success: false, error: result }
    }
}
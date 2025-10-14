import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { AIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { SearchMatch } from "../Helpers/SearchTypes";

export class AIFunctionService {
    
    private fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    public async performAIFunction(functionCall: AIFunctionCall): Promise<AIFunctionResponse> {
        switch (functionCall.name) {
            case AIFunction.SearchVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.searchVaultFiles(functionCall.arguments.search_term));

            case AIFunction.ReadFile:
                return new AIFunctionResponse(functionCall.name, await this.readFile(functionCall.arguments.file_path));

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
        return matches.map((match) => ({
            name: match.file.basename,
            path: match.file.path,
            snippets: match.snippets.map((snippet) => ({
                text: snippet.text,
                matchPosition: snippet.matchIndex
            }))
        }));
    }

    private async readFile(filePath: string): Promise<object> {
        const content = await this.fileSystemService.readFile(filePath);
        if (content === null) {
            return { error: `File not found: ${filePath}` };
        }
        return { content };
    }
}
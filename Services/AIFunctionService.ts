import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { TFile } from "obsidian";
import { AIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";

export class AIFunctionService {
    
    private fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    public async performAIFunction(functionCall: AIFunctionCall): Promise<AIFunctionResponse> {
        switch (functionCall.name) {
            case AIFunction.ListVaultFiles:
                return new AIFunctionResponse(functionCall.name, await this.listVaultFiles());

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

    private async listVaultFiles(): Promise<object> {
        const files: TFile[] = await this.fileSystemService.listFilesInDirectory("/");
        return files.map((file) => ({
            name: file.basename,
            path: file.path,
            size_bytes: file.stat.size
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
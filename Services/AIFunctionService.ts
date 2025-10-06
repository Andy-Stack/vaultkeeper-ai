import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { FileSystemService } from "./FileSystemService";
import { TFile } from "obsidian";
import { AIFunction } from "Enums/AIFunction";
import { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";

export class AIFunctionService {
    
    private fileSystemService: FileSystemService = Resolve(Services.FileSystemService);

    public async performAIFunction(functionCall: AIFunctionCall): Promise<AIFunctionResponse> {
        switch (functionCall.name) {
            case AIFunction.ListVaultFiles:
                return new AIFunctionResponse(
                    functionCall.name,
                    await this.listVaultFiles()
                );
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
}
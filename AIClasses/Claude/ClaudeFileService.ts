import { BaseAIFileService } from "AIClasses/BaseAIFileService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import { StringTools } from "Helpers/StringTools";
import { ApiError } from "Types/ApiError";

export class ClaudeFileService extends BaseAIFileService {

    private readonly betaHeader = "files-api-2025-04-14";

    public constructor() {
        super(AIProvider.Claude);
    }

    protected async listFilesFromAPI(): Promise<string[]> {
        return this.withRetry("List files", async () => {
            const response = await fetch(AIFileServiceURL.Claude, {
                method: "GET",
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": this.betaHeader
                },
                signal: this.abortService.signal()
            });

            if (!response.ok) {
                const responseBody = await response.text();
                throw ApiError.fromResponse(response.status, response.statusText, responseBody);
            }

            const data = await response.json() as ClaudeListFilesResponse;

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(file => file.id);
        });
    }

    protected async uploadFileToAPI(data: string, mimeType: string, displayName?: string): Promise<string> {
        return this.withRetry("Upload file", async () => {
            const bytes = StringTools.toBytes(data);
            const blob = this.createBlob(bytes, mimeType);

            const formData = new FormData();
            formData.append("file", blob, displayName || "file");

            const response = await fetch(AIFileServiceURL.Claude, {
                method: "POST",
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": this.betaHeader
                },
                body: formData,
                signal: this.abortService.signal()
            });

            if (!response.ok) {
                const responseBody = await response.text();
                throw ApiError.fromResponse(response.status, response.statusText, responseBody);
            }

            const responseData = await response.json() as ClaudeFile;

            return responseData.id;
        });
    }

    protected async deleteFileFromAPI(id: string): Promise<void> {
        return this.withRetry("Delete file", async () => {
            const response = await fetch(`${AIFileServiceURL.Claude}/${id}`, {
                method: "DELETE",
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": this.betaHeader
                },
                signal: this.abortService.signal()
            });

            if (!response.ok && response.status !== 204 && response.status !== 404) {
                const responseBody = await response.text();
                throw ApiError.fromResponse(response.status, response.statusText, responseBody);
            }
        });
    }

}
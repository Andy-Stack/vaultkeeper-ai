import { BaseAIFileService } from "AIClasses/BaseAIFileService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import { StringTools } from "Helpers/StringTools";
import { requestUrl } from "obsidian";
import { ApiError } from "Types/ApiError";
import type { ClaudeFile, ClaudeListFilesResponse } from "./ClaudeTypes";

export class ClaudeFileService extends BaseAIFileService {

    public constructor() {
        super(AIProvider.Claude);
    }

    protected async listFilesFromAPI(): Promise<string[]> {
        return this.withRetry("List files", async () => {

            const response = await requestUrl({
                url: AIFileServiceURL.Claude,
                method: "GET",
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": "files-api-2025-04-14"
                },
                throw: false
            });

            if (response.status !== 200) {
                throw ApiError.fromResponse(response.status, "List files failed", response.text);
            }

            const data = response.json as ClaudeListFilesResponse;

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(file => file.id);
        }, []);
    }

    protected async uploadFileToAPI(data: string, mimeType: string, displayName?: string): Promise<string> {
        return this.withRetry("Upload file", async () => {
            const bytes = StringTools.toBytes(data);

            const boundary = this.createBoundary();
            const formData = this.createFormData(displayName, mimeType, boundary, bytes);

            const response = await requestUrl({
                url: AIFileServiceURL.Claude,
                method: "POST",
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": "files-api-2025-04-14",
                    "Content-Type": `multipart/form-data; boundary=${boundary}`
                },
                body: formData,
                throw: false
            });

            if (response.status !== 200 && response.status !== 201) {
                throw ApiError.fromResponse(response.status, "Upload file failed", response.text);
            }

            const responseData = response.json as ClaudeFile;

            return responseData.id;
        }, "");
    }

    protected async deleteFileFromAPI(id: string): Promise<void> {
        return this.withRetry("Delete file", async () => {
            const response = await requestUrl({
                url: `${AIFileServiceURL.Claude}/${id}`,
                method: "DELETE",
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": "files-api-2025-04-14"
                },
                throw: false
            });

            if (response.status !== 200 && response.status !== 204 && response.status !== 404) {
                throw ApiError.fromResponse(response.status, "Delete file failed", response.text);
            }
        }, undefined);
    }

}
import { BaseAIFileService } from "AIClasses/BaseAIFileService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import type { OpenAIFile, OpenAIListFilesResponse } from "./OpenAITypes";
import { StringTools } from "Helpers/StringTools";
import { requestUrl } from "obsidian";
import { ApiError } from "Types/ApiError";

export class OpenAIFileService extends BaseAIFileService {

    public constructor() {
        super(AIProvider.OpenAI);
    }

    protected async listFilesFromAPI(): Promise<string[]> {
        return this.withRetry("List files", async () => {

            const response = await requestUrl({
                url: AIFileServiceURL.OpenAI,
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                },
                throw: false
            });

            if (response.status !== 200) {
                throw ApiError.fromResponse(response.status, "List files failed", response.text);
            }

            const data = response.json as OpenAIListFilesResponse;

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(file => file.id);
        }, []);
    }

    protected async uploadFileToAPI(data: string, mimeType: string, displayName?: string): Promise<string> {
        return this.withRetry("Upload file", async () => {
            const bytes = StringTools.toBytes(data);

            // Use 'vision' for images, 'user_data' for other files
            const purpose = mimeType.startsWith('image/') ? 'vision' : 'user_data';

            const boundary = this.createBoundary();
            const formData = this.createFormData(displayName, mimeType, boundary, bytes, { purpose });

            const response = await requestUrl({
                url: AIFileServiceURL.OpenAI,
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": `multipart/form-data; boundary=${boundary}`
                },
                body: formData.buffer,
                throw: false
            });

            if (response.status !== 200 && response.status !== 201) {
                throw ApiError.fromResponse(response.status, "Upload file failed", response.text);
            }

            const responseData = response.json as OpenAIFile;

            return responseData.id;
        }, "");
    }

    protected async deleteFileFromAPI(id: string): Promise<void> {
        return this.withRetry("Delete file", async () => {
            const response = await requestUrl({
                url: `${AIFileServiceURL.OpenAI}/${id}`,
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                },
                throw: false
            });

            if (response.status !== 200 && response.status !== 204 && response.status !== 404) {
                throw ApiError.fromResponse(response.status, "Delete file failed", response.text);
            }
        }, undefined);
    }

}
import { BaseAIFileService } from "AIClasses/BaseAIFileService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import type { OpenAIFile, OpenAIListFilesResponse } from "./OpenAITypes";
import { StringTools } from "Helpers/StringTools";
import { ApiError } from "Types/ApiError";

export class OpenAIFileService extends BaseAIFileService {

    public constructor() {
        super(AIProvider.OpenAI);
    }

    protected async listFilesFromAPI(): Promise<string[]> {
        return this.withRetry("List files", async () => {
            const response = await fetch(AIFileServiceURL.OpenAI, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                },
                signal: this.abortService.signal()
            });

            if (!response.ok) {
                const responseBody = await response.text();
                throw ApiError.fromResponse(response.status, response.statusText, responseBody);
            }

            const data = await response.json() as OpenAIListFilesResponse;

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

            // Use 'vision' for images, 'user_data' for other files
            const purpose = mimeType.startsWith('image/') ? 'vision' : 'user_data';
            formData.append("purpose", purpose);

            const response = await fetch(AIFileServiceURL.OpenAI, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: formData,
                signal: this.abortService.signal()
            });

            if (!response.ok) {
                const responseBody = await response.text();
                throw ApiError.fromResponse(response.status, response.statusText, responseBody);
            }

            const responseData = await response.json() as OpenAIFile;

            return responseData.id;
        });
    }

    protected async deleteFileFromAPI(id: string): Promise<void> {
        return this.withRetry("Delete file", async () => {
            const response = await fetch(`${AIFileServiceURL.OpenAI}/${id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
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
import { BaseAIFileService } from "AIClasses/BaseAIFileService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import { StringTools } from "Helpers/StringTools";
import { requestUrl } from "obsidian";
import { ApiError } from "Types/ApiError";
import type { MistralFile, MistralListFilesResponse, MistralSignedUrlResponse } from "./MistralTypes";

export class MistralFileService extends BaseAIFileService {

    // Cache of file ID -> signed URL for use in chat messages
    private signedUrls: Map<string, string> = new Map();

    public constructor() {
        super(AIProvider.Mistral);
    }

    /**
     * Returns the signed URL for a given file ID.
     * Used by Mistral.formatBinaryFiles() to reference uploaded documents in chat.
     */
    public getSignedUrl(fileId: string): string | undefined {
        return this.signedUrls.get(fileId);
    }

    protected async listFilesFromAPI(): Promise<string[]> {
        return this.withRetry("List files", async () => {

            const response = await requestUrl({
                url: AIFileServiceURL.Mistral,
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                },
                throw: false
            });

            if (response.status !== 200) {
                throw ApiError.fromResponse(response.status, "List files failed", response.text);
            }

            const data = response.json as MistralListFilesResponse;

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
            const formData = this.createFormData(displayName, mimeType, boundary, bytes, { purpose: "ocr" });

            const response = await requestUrl({
                url: AIFileServiceURL.Mistral,
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": `multipart/form-data; boundary=${boundary}`
                },
                body: formData,
                throw: false
            });

            if (response.status !== 200 && response.status !== 201) {
                throw ApiError.fromResponse(response.status, "Upload file failed", response.text);
            }

            const responseData = response.json as MistralFile;
            const fileId = responseData.id;

            // Get a signed URL for use in chat messages
            const signedUrl = await this.getSignedUrlFromAPI(fileId);
            if (signedUrl) {
                this.signedUrls.set(fileId, signedUrl);
            }

            return fileId;
        }, "");
    }

    protected async deleteFileFromAPI(id: string): Promise<void> {
        return this.withRetry("Delete file", async () => {
            const response = await requestUrl({
                url: `${AIFileServiceURL.Mistral}/${id}`,
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                },
                throw: false
            });

            if (response.status !== 200 && response.status !== 204 && response.status !== 404) {
                throw ApiError.fromResponse(response.status, "Delete file failed", response.text);
            }

            this.signedUrls.delete(id);
        }, undefined);
    }

    private async getSignedUrlFromAPI(fileId: string): Promise<string | undefined> {
        return this.withRetry("Get signed URL", async () => {
            const response = await requestUrl({
                url: `${AIFileServiceURL.Mistral}/${fileId}/url?expiry=24`,
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                },
                throw: false
            });

            if (response.status !== 200) {
                throw ApiError.fromResponse(response.status, "Get signed URL failed", response.text);
            }

            const data = response.json as MistralSignedUrlResponse;
            return data.url;
        }, undefined);
    }
}

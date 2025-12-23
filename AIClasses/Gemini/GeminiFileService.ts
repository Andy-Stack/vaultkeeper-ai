import { BaseAIFileService } from "AIClasses/BaseAIFileService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import { StringTools } from "Helpers/StringTools";
import { requestUrl } from "obsidian";
import { ApiError } from "Types/ApiError";
import type { GeminiListFilesResponse, GeminiUploadResponse } from "./GeminiTypes";

export class GeminiFileService extends BaseAIFileService {

    public constructor() {
        super(AIProvider.Gemini);
    }

    protected async listFilesFromAPI(): Promise<string[]> {
        return this.withRetry("List files", async () => {

            const response = await requestUrl({
                url: `${AIFileServiceURL.Gemini}/files?key=${this.apiKey}`,
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                },
                throw: false
            });

            if (response.status !== 200) {
                throw ApiError.fromResponse(response.status, "List files failed", response.text);
            }

            const data = response.json as GeminiListFilesResponse;

            if (!data.files || data.files.length === 0) {
                return [];
            }

            return data.files.map(file => file.name);
        }, []);
    }

    protected async uploadFileToAPI(data: string, mimeType: string, displayName?: string): Promise<string> {
        return this.withRetry("Upload file", async () => {
            const bytes = StringTools.toBytes(data);
            const numBytes = bytes.byteLength;

            const metadata = displayName ? { file: { displayName } } : {};

            // Step 1: Initiate resumable upload
            const initiateResponse = await requestUrl({
                url: `${AIFileServiceURL.GeminiUpload}/files?key=${this.apiKey}`,
                method: "POST",
                headers: {
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": numBytes.toString(),
                    "X-Goog-Upload-Header-Content-Type": mimeType,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(metadata),
                throw: false
            });

            if (initiateResponse.status !== 200) {
                throw ApiError.fromResponse(initiateResponse.status, "Upload file failed", initiateResponse.text);
            }

            const uploadUrl = initiateResponse.headers["x-goog-upload-url"];
            if (!uploadUrl) {
                Exception.throw("No upload URL received from initiate request");
            }

            // Step 2: Upload file data
            const uploadResponse = await requestUrl({
                url: uploadUrl,
                method: "POST",
                headers: {
                    "Content-Type": mimeType,
                    "X-Goog-Upload-Offset": "0",
                    "X-Goog-Upload-Command": "upload, finalize"
                },
                body: this.bytesToBuffer(bytes),
                throw: false
            });

            if (uploadResponse.status !== 200 && uploadResponse.status !== 201) {
                throw ApiError.fromResponse(uploadResponse.status, "Upload file failed", uploadResponse.text);
            }

            const responseData = uploadResponse.json as GeminiUploadResponse;

            return responseData.file.uri;
        }, "");
    }

    protected async deleteFileFromAPI(name: string): Promise<void> {
        return this.withRetry("Delete file", async () => {
            const response = await requestUrl({
                url: `${AIFileServiceURL.Gemini}/${name}?key=${this.apiKey}`,
                method: "DELETE",
                throw: false
            });

            if (response.status !== 200 && response.status !== 204 && response.status !== 404) {
                throw ApiError.fromResponse(response.status, "Delete file failed", response.text);
            }
        }, undefined);
    }

}
import { BaseAIFileService } from "AIClasses/BaseAIFileService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import { StringTools } from "Helpers/StringTools";
import { ApiError } from "Types/ApiError";

export class GeminiFileService extends BaseAIFileService {

    public constructor() {
        super(AIProvider.Gemini);
    }

    protected async listFilesFromAPI(): Promise<string[]> {
        return this.withRetry("List files", async () => {
            const response = await fetch(`${AIFileServiceURL.Gemini}/files?key=${this.apiKey}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                },
                signal: this.abortService.signal()
            });

            if (!response.ok) {
                const responseBody = await response.text();
                throw ApiError.fromResponse(response.status, response.statusText, responseBody);
            }

            const data = await response.json() as GeminiListFilesResponse;

            if (!data.files || data.files.length === 0) {
                return [];
            }

            return data.files.map(file => file.name);
        });
    }

    protected async uploadFileToAPI(data: string, mimeType: string, displayName?: string): Promise<string> {
        return this.withRetry("Upload file", async () => {
            const bytes = StringTools.toBytes(data);
            const numBytes = bytes.byteLength;

            const metadata = displayName ? { file: { displayName } } : {};

            // Step 1: Initiate resumable upload
            const initiateResponse = await fetch(`${AIFileServiceURL.GeminiUpload}/files?key=${this.apiKey}`, {
                method: "POST",
                headers: {
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": numBytes.toString(),
                    "X-Goog-Upload-Header-Content-Type": mimeType,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(metadata),
                signal: this.abortService.signal()
            });

            if (!initiateResponse.ok) {
                const responseBody = await initiateResponse.text();
                throw ApiError.fromResponse(initiateResponse.status, initiateResponse.statusText, responseBody);
            }

            const uploadUrl = initiateResponse.headers.get("x-goog-upload-url");
            if (!uploadUrl) {
                Exception.throw("No upload URL received from initiate request");
            }

            // Step 2: Upload file data
            const blob = this.createBlob(bytes, mimeType);
            const uploadResponse = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                    "Content-Length": numBytes.toString(),
                    "X-Goog-Upload-Offset": "0",
                    "X-Goog-Upload-Command": "upload, finalize"
                },
                body: blob,
                signal: this.abortService.signal()
            });

            if (!uploadResponse.ok) {
                const responseBody = await uploadResponse.text();
                throw ApiError.fromResponse(uploadResponse.status, uploadResponse.statusText, responseBody);
            }

            const responseData = await uploadResponse.json() as GeminiUploadResponse;

            return responseData.file.uri;
        });
    }

    protected async deleteFileFromAPI(name: string): Promise<void> {
        return this.withRetry("Delete file", async () => {
            const response = await fetch(`${AIFileServiceURL.Gemini}/${name}?key=${this.apiKey}`, {
                method: "DELETE",
                signal: this.abortService.signal()
            });

            if (!response.ok && response.status !== 204 && response.status !== 403) {
                const responseBody = await response.text();
                throw ApiError.fromResponse(response.status, response.statusText, responseBody);
            }
        });
    }

}
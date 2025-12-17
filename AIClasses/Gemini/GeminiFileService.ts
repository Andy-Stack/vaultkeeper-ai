import type { IAIFileService } from "AIClasses/IAIFileService";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { SettingsService } from "Services/SettingsService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import { requestUrl } from "obsidian";
import { StringTools } from "Helpers/StringTools";

export class GeminiFileService implements IAIFileService {

    private readonly settingsService: SettingsService;
    private readonly apiKey: string;

    public constructor() {
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = this.settingsService.getApiKeyForProvider(AIProvider.Gemini);
    }

    public async listFiles(): Promise<string[]> {
        try {
            const response = await requestUrl({
                url: `${AIFileServiceURL.Gemini}/files?key=${this.apiKey}`,
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (response.status !== 200) {
                Exception.throw(`Failed to list files: ${response.status} ${response.text}`);
            }

            const data = response.json as GeminiListFilesResponse;

            if (!data.files || data.files.length === 0) {
                return [];
            }

            return data.files.map(file => file.name);
        } catch (error) {
            Exception.log(error);
            Exception.throw(error);
        }
    }

    public async uploadFile(data: string, mimeType: string, displayName?: string): Promise<string> {
        try {
            const bytes = StringTools.toBytes(data);
            const numBytes = bytes.byteLength;

            const metadata = displayName ? { file: { displayName } } : {};

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
                body: JSON.stringify(metadata)
            });

            if (initiateResponse.status !== 200) {
                Exception.throw(`Failed to initiate upload: ${initiateResponse.status} ${initiateResponse.text}`);
            }

            const uploadUrl = initiateResponse.headers["x-goog-upload-url"];
            if (!uploadUrl) {
                Exception.throw("No upload URL received from initiate request");
            }

            const uploadResponse = await requestUrl({
                url: uploadUrl,
                method: "POST",
                headers: {
                    "Content-Length": numBytes.toString(),
                    "X-Goog-Upload-Offset": "0",
                    "X-Goog-Upload-Command": "upload, finalize"
                },
                body: bytes.buffer,
                contentType: mimeType
            });

            if (uploadResponse.status !== 200) {
                Exception.throw(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.text}`);
            }

            const responseData = uploadResponse.json as GeminiUploadResponse;

            return responseData.file.uri;
        } catch (error) {
            Exception.log(error);
            Exception.throw(error);
        }
    }

    public async deleteFile(name: string): Promise<void> {
        try {
            const response = await requestUrl({
                url: `${AIFileServiceURL.Gemini}/${name}?key=${this.apiKey}`,
                method: "DELETE"
            });

            if (response.status !== 200 && response.status !== 204) {
                Exception.throw(`Failed to delete file: ${response.status} ${response.text}`);
            }
        } catch (error) {
            Exception.log(error);
            Exception.throw(error);
        }
    }

}
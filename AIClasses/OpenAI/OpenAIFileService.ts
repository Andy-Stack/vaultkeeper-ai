import type { IAIFileService } from "AIClasses/IAIFileService";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { SettingsService } from "Services/SettingsService";
import { AIFileServiceURL, AIProvider } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import { requestUrl } from "obsidian";
import type { OpenAIFile, OpenAIListFilesResponse } from "./OpenAITypes";
import { StringTools } from "Helpers/StringTools";

export class OpenAIFileService implements IAIFileService {

    private readonly settingsService: SettingsService;
    private readonly apiKey: string;

    public constructor() {
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = this.settingsService.getApiKeyForProvider(AIProvider.OpenAI);
    }

    public async listFiles(): Promise<string[]> {
        try {
            const response = await requestUrl({
                url: AIFileServiceURL.OpenAI,
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                }
            });

            if (response.status !== 200) {
                Exception.throw(`Failed to list files: ${response.status} ${response.text}`);
            }

            const data = response.json as OpenAIListFilesResponse;

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(file => file.id);
        } catch (error) {
            Exception.log(error);
            Exception.throw(error);
        }
    }

    public async uploadFile(data: string, mimeType: string, displayName?: string): Promise<string> {
        try {
            const bytes = StringTools.toBytes(data);
            const blob = new Blob([bytes], { type: mimeType });

            const formData = new FormData();
            formData.append("file", blob, displayName || "file");
            formData.append("purpose", "assistants"); // Default purpose for general use

            const response = await requestUrl({
                url: AIFileServiceURL.OpenAI,
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: formData as unknown as string
            });

            if (response.status !== 200 && response.status !== 201) {
                Exception.throw(`Failed to upload file: ${response.status} ${response.text}`);
            }

            const responseData = response.json as OpenAIFile;

            return responseData.id;
        } catch (error) {
            Exception.log(error);
            Exception.throw(error);
        }
    }

    public async deleteFile(id: string): Promise<void> {
        try {
            const response = await requestUrl({
                url: `${AIFileServiceURL.OpenAI}/${id}`,
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                }
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
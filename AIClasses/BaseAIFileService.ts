import type { IAIFileService } from "AIClasses/IAIFileService";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { SettingsService } from "Services/SettingsService";
import { AIProvider } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import { ApiError } from "Types/ApiError";
import { AbortService } from "Services/AbortService";
import type { Attachment } from "Conversations/Attachment";
import { sleep } from "Helpers/Helpers";

export abstract class BaseAIFileService implements IAIFileService {

	private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // ms
	private static readonly MAX_RETRIES = 3;

	protected readonly abortService: AbortService;
	protected readonly settingsService: SettingsService;
	protected readonly apiKey: string;

	private provider: AIProvider;
	private fileIDs: string[] = [];

	protected constructor(provider: AIProvider) {
		this.provider = provider;
		this.settingsService = Resolve<SettingsService>(Services.SettingsService);
		this.apiKey = this.settingsService.getApiKeyForProvider(this.provider);
		this.abortService = Resolve<AbortService>(Services.AbortService);
	}

	protected abstract listFilesFromAPI(): Promise<string[]>;
	protected abstract uploadFileToAPI(data: string, mimeType: string, displayName?: string): Promise<string>;
	protected abstract deleteFileFromAPI(id: string): Promise<void>;

	public async refreshCache() {
		this.fileIDs = await this.listFilesFromAPI();
	}

	public listFiles(): string[] {
		return [...this.fileIDs];
	}

	public async uploadFile(attachment: Attachment): Promise<void> {
		const existingFileID = attachment.getFileID(this.provider);

		if (existingFileID && this.fileIDs.includes(existingFileID)) {
			return;
		}
		attachment.deleteFileID(this.provider);

		const fileID = await this.uploadFileToAPI(await attachment.getBase64(), attachment.getMimeType(), attachment.fileName);

		if (fileID.trim() === "") {
			return; // We tried, the agent will be notified of the failure
		}

		attachment.setFileID(this.provider, fileID);

		if (!this.fileIDs.includes(fileID)) {
			this.fileIDs.push(fileID);
		}
	}

	public async deleteFile(attachment: Attachment): Promise<void> {
		const id = attachment.getFileID(this.provider);

		if (id === undefined) {
			return;
		}

		if (this.fileIDs.includes(id)) {
			await this.deleteFileFromAPI(id);
			attachment.deleteFileID(this.provider);
			const index = this.fileIDs.indexOf(id);
			if (index > -1) {
				this.fileIDs.splice(index, 1);
			}
		}
	}

	public async deleteFiles(fileIDs: Attachment[]) {
		for (const fileID of fileIDs) {
			await this.deleteFile(fileID);
		}
	}

	// Retries operation on retryable errors (500, 502, 503, 504) with exponential backoff
	protected async withRetry<T>(operationName: string, operation: () => Promise<T>, defaultValue: T): Promise<T> {
		for (let attempt = 1; attempt <= BaseAIFileService.MAX_RETRIES; attempt++) {
			try {
				return await operation();
			} catch (error) {
				if (ApiError.isApiError(error) && error.info.isRetryable) {
					if (attempt === BaseAIFileService.MAX_RETRIES) {
						Exception.log(`${operationName}: Max retries (${BaseAIFileService.MAX_RETRIES}) exhausted. Returning default value.`);
						return defaultValue;
					}

					const delay = BaseAIFileService.RETRY_DELAYS[attempt];
					Exception.warn(`${operationName}: Attempt ${attempt}/${BaseAIFileService.MAX_RETRIES} failed with ${error.info.type} (status ${error.info.statusCode}). Retrying in ${delay}ms...`);

					await sleep(delay);
				} else {
					// Non-retryable error - return default value
					Exception.log(`${operationName}: Non-retryable error. Returning default value.`);
					return defaultValue;
				}
			}
		}
		return defaultValue;
	}

	protected createBoundary(): string {
		return `----FormBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
	}

	protected createFormData(displayName: string | undefined, mimeType: string, boundary: string, bytes: Uint8Array<ArrayBuffer>, additionalFields?: Record<string, string>): ArrayBuffer {
		const parts: Uint8Array[] = [];
		const encoder = new TextEncoder();

		// Add the file field
		parts.push(
			encoder.encode(
				`--${boundary}\r\n` +
				`Content-Disposition: form-data; name="file"; filename="${displayName || 'file'}"\r\n` +
				`Content-Type: ${mimeType}\r\n\r\n`
			)
		);
		parts.push(bytes);

		// Add any additional fields
		if (additionalFields) {
			for (const [key, value] of Object.entries(additionalFields)) {
				parts.push(
					encoder.encode(
						`\r\n--${boundary}\r\n` +
						`Content-Disposition: form-data; name="${key}"\r\n\r\n` +
						value
					)
				);
			}
		}

		// Add closing boundary
		parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

		// Calculate total length and concatenate
		const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
		const result = new Uint8Array(totalLength);
		let offset = 0;
		for (const part of parts) {
			result.set(part, offset);
			offset += part.byteLength;
		}

		return this.bytesToBuffer(result);
    }

	protected bytesToBuffer(bytes: Uint8Array<ArrayBuffer>): ArrayBuffer {
		return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
	}

	protected getHeader(headerName: string, headers: Record<string, string>): string | undefined {
		const header = Object.keys(headers).find(header => header.toLowerCase() === headerName.toLowerCase());
		return header ? headers[header] : undefined;
	}

}

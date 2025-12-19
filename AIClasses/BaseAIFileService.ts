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

		if (existingFileID && this.fileIDs.contains(existingFileID)) {
			return;
		}

		const fileID = await this.uploadFileToAPI(attachment.base64, attachment.mimeType, attachment.fileName);

		if (fileID.trim() === "") {
			return; // We tried, the agent will be notified of the failure
		}

		attachment.setFileID(this.provider, fileID);

		if (!this.fileIDs.contains(fileID)) {
			this.fileIDs.push(fileID);
		}
	}

	public async deleteFile(attachment: Attachment): Promise<void> {
		const id = attachment.getFileID(this.provider);

		if (id === undefined) {
			return;
		}

		if (this.fileIDs.contains(id)) {
			await this.deleteFileFromAPI(id);
			attachment.deleteFileID(this.provider);
			this.fileIDs.remove(id);
		}
	}

	public async deleteFiles(fileIDs: Attachment[]) {
		for (const fileID of fileIDs) {
			await this.deleteFile(fileID);
		}
	}

	// Retries operation on retryable errors (500, 502, 503, 504) with exponential backoff
	protected async withRetry<T>(operationName: string, operation: () => Promise<T>, defaultValue: T): Promise<T> {
		return await this.abortService.abortableOperation(async () => {
			for (let attempt = 1; attempt <= BaseAIFileService.MAX_RETRIES; attempt++) {
				try {
					return await operation();
				} catch (error) {

					// Don't retry on abort errors - throw immediately
					if (AbortService.isAbortError(error)) {
						throw error;
					}

					if (ApiError.isApiError(error) && error.info.isRetryable) {
						if (attempt === BaseAIFileService.MAX_RETRIES) {
							Exception.log(`${operationName}: Max retries (${BaseAIFileService.MAX_RETRIES}) exhausted. Returning default value.`);
							return defaultValue;
						}

						const delay = BaseAIFileService.RETRY_DELAYS[attempt];
						Exception.warn(`${operationName}: Attempt ${attempt}/${BaseAIFileService.MAX_RETRIES} failed with ${error.info.type} (status ${error.info.statusCode}). Retrying in ${delay}ms...`);

						if (this.abortService.signal().aborted) {
							this.abortService.throw();
						}

						await sleep(delay);

						if (this.abortService.signal().aborted) {
							this.abortService.throw();
						}
					} else {
						// Non-retryable error - return default value
						Exception.log(`${operationName}: Non-retryable error. Returning default value.`);
						return defaultValue;
					}
				}
			}
			return defaultValue;
		});
	}

	protected createBoundary(): string {
		return `----FormBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
	}

	protected createFormData(displayName: string | undefined, mimeType: string, boundary: string, bytes: Uint8Array<ArrayBuffer>, additionalFields?: Record<string, string>): Buffer<ArrayBuffer> {
		const parts: Buffer[] = [];

		// Add the file field
		parts.push(
			Buffer.from(
				`--${boundary}\r\n` +
				`Content-Disposition: form-data; name="file"; filename="${displayName || 'file'}"\r\n` +
				`Content-Type: ${mimeType}\r\n\r\n`,
				'utf8'
			)
		);
		parts.push(Buffer.from(bytes));

		// Add any additional fields
		if (additionalFields) {
			for (const [key, value] of Object.entries(additionalFields)) {
				parts.push(
					Buffer.from(
						`\r\n--${boundary}\r\n` +
						`Content-Disposition: form-data; name="${key}"\r\n\r\n` +
						value,
						'utf8'
					)
				);
			}
		}

		// Add closing boundary
		parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

		return Buffer.concat(parts);
    }

	protected bytesToBuffer(bytes: Uint8Array<ArrayBuffer>): ArrayBuffer {
		return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
	}

}

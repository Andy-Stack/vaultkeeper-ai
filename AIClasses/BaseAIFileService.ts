import type { IAIFileService } from "AIClasses/IAIFileService";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { SettingsService } from "Services/SettingsService";
import { AIProvider } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import { ApiError } from "Types/ApiError";
import { AbortService } from "Services/AbortService";
import type { Attachment } from "Conversations/Attachment";

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

	public async uploadFile(attachment: Attachment): Promise<string> {
		const existingFileID = attachment.getFileID(this.provider);

		if (existingFileID && this.fileIDs.contains(existingFileID)) {
			return existingFileID;
		}

		const fileID = await this.uploadFileToAPI(attachment.base64, attachment.mimeType, attachment.fileName);
		attachment.setFileID(this.provider, fileID);

		if (!this.fileIDs.contains(fileID)) {
			this.fileIDs.push(fileID);
		}

		return fileID;
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
	protected async withRetry<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= BaseAIFileService.MAX_RETRIES; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error;

				// Don't retry on abort errors
				if (AbortService.isAbortError(error)) {
					throw error;
				}

				if (ApiError.isApiError(error) && error.info.isRetryable) {
					if (attempt === BaseAIFileService.MAX_RETRIES) {
						Exception.log(`${operationName}: Max retries (${BaseAIFileService.MAX_RETRIES}) exhausted`);
						throw error;
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
					throw error;
				}
			}
		}
		throw lastError;
	}

	protected createBlob(bytes: Uint8Array<ArrayBuffer>, mimeType: string): Blob {
		return new Blob([bytes], { type: mimeType });
	}

}

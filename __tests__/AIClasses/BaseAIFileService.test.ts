import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseAIFileService } from '../../AIClasses/BaseAIFileService';
import { AIProvider } from '../../Enums/ApiProvider';
import { Attachment } from '../../Conversations/Attachment';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AbortService } from '../../Services/AbortService';
import { StringTools } from '../../Helpers/StringTools';

/**
 * Concrete implementation for testing BaseAIFileService
 */
class TestFileService extends BaseAIFileService {
	public listFilesImpl = vi.fn<() => Promise<string[]>>();
	public uploadFileImpl = vi.fn<(data: string, mimeType: string, displayName?: string) => Promise<string>>();
	public deleteFileImpl = vi.fn<(id: string) => Promise<void>>();

	constructor() {
		super(AIProvider.Claude);
	}

	protected async listFilesFromAPI(): Promise<string[]> {
		return this.listFilesImpl();
	}

	protected async uploadFileToAPI(data: string, mimeType: string, displayName?: string): Promise<string> {
		return this.uploadFileImpl(data, mimeType, displayName);
	}

	protected async deleteFileFromAPI(id: string): Promise<void> {
		return this.deleteFileImpl(id);
	}
}

describe('BaseAIFileService', () => {
	let fileService: TestFileService;
	let abortService: AbortService;

	beforeEach(() => {
		// Mock StringTools.resizeB64Image to avoid browser environment issues in tests
		vi.spyOn(StringTools, 'resizeB64Image').mockImplementation(async (base64: string) => base64);

		// Mock SettingsService
		const mockSettingsService = {
			settings: {
				apiKeys: {
					claude: 'test-key'
				}
			},
			getApiKeyForProvider: vi.fn(() => 'test-key')
		};
		RegisterSingleton(Services.SettingsService, mockSettingsService);

		abortService = new AbortService();
		RegisterSingleton(Services.AbortService, abortService);

		fileService = new TestFileService();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.clearAllMocks();
	});

	describe('Cache Management', () => {
		it('should cache file IDs after refresh', async () => {
			fileService.listFilesImpl.mockResolvedValue(['file1', 'file2', 'file3']);

			await fileService.refreshCache();

			expect(fileService.listFiles()).toEqual(['file1', 'file2', 'file3']);
		});

		it('should return copy of cached files (immutability)', () => {
			fileService.listFilesImpl.mockResolvedValue(['file1']);

			const list1 = fileService.listFiles();
			const list2 = fileService.listFiles();

			expect(list1).not.toBe(list2);
			expect(list1).toEqual(list2);
		});

		it('should skip upload if file already cached', async () => {
			const attachment = new Attachment('test.png', 'image/png', 'base64data', {
				[AIProvider.Claude]: 'existing-file-id'
			});

			fileService.listFilesImpl.mockResolvedValue(['existing-file-id']);
			await fileService.refreshCache();

			await fileService.uploadFile(attachment);

			expect(fileService.uploadFileImpl).not.toHaveBeenCalled();
		});

		it('should upload and cache new file', async () => {
			const attachment = new Attachment('test.png', 'image/png', 'base64data');

			fileService.listFilesImpl.mockResolvedValue([]);
			fileService.uploadFileImpl.mockResolvedValue('new-file-id');
			await fileService.refreshCache();

			await fileService.uploadFile(attachment);

			expect(fileService.uploadFileImpl).toHaveBeenCalledWith('base64data', 'image/png', 'test.png');
			expect(attachment.getFileID(AIProvider.Claude)).toBe('new-file-id');
			expect(fileService.listFiles()).toContain('new-file-id');
		});

		it('should handle empty file ID from upload', async () => {
			const attachment = new Attachment('test.png', 'image/png', 'base64data');

			fileService.uploadFileImpl.mockResolvedValue('');

			await fileService.uploadFile(attachment);

			expect(attachment.getFileID(AIProvider.Claude)).toBeUndefined();
			expect(fileService.listFiles()).not.toContain('');
		});

		it('should remove file from cache after deletion', async () => {
			const attachment = new Attachment('test.png', 'image/png', 'base64data', {
				[AIProvider.Claude]: 'file-to-delete'
			});

			fileService.listFilesImpl.mockResolvedValue(['file-to-delete']);
			await fileService.refreshCache();

			await fileService.deleteFile(attachment);

			expect(fileService.deleteFileImpl).toHaveBeenCalledWith('file-to-delete');
			expect(fileService.listFiles()).not.toContain('file-to-delete');
			expect(attachment.getFileID(AIProvider.Claude)).toBeUndefined();
		});

		it('should skip deletion if file not in cache', async () => {
			const attachment = new Attachment('test.png', 'image/png', 'base64data', {
				[AIProvider.Claude]: 'non-cached-file'
			});

			fileService.listFilesImpl.mockResolvedValue(['other-file']);
			await fileService.refreshCache();

			await fileService.deleteFile(attachment);

			expect(fileService.deleteFileImpl).not.toHaveBeenCalled();
		});
	});


	describe('Form Data Creation', () => {
		it('should create form data with file only', () => {
			const boundary = 'test-boundary';
			const bytes = new Uint8Array([1, 2, 3, 4]);

			const formData = fileService['createFormData']('test.txt', 'text/plain', boundary, bytes);

			// Convert ArrayBuffer to string for inspection
			const decoder = new TextDecoder();
			const formString = decoder.decode(formData);
			expect(formString).toContain('--test-boundary');
			expect(formString).toContain('name="file"');
			expect(formString).toContain('filename="test.txt"');
			expect(formString).toContain('Content-Type: text/plain');
			expect(formString).toContain('--test-boundary--');
		});

		it('should create form data with additional fields', () => {
			const boundary = 'test-boundary';
			const bytes = new Uint8Array([1, 2, 3, 4]);
			const additionalFields = { purpose: 'vision', custom: 'value' };

			const formData = fileService['createFormData']('test.png', 'image/png', boundary, bytes, additionalFields);

			// Convert ArrayBuffer to string for inspection
			const decoder = new TextDecoder();
			const formString = decoder.decode(formData);
			expect(formString).toContain('name="purpose"');
			expect(formString).toContain('vision');
			expect(formString).toContain('name="custom"');
			expect(formString).toContain('value');
		});

		it('should generate unique boundaries', () => {
			const boundary1 = fileService['createBoundary']();
			const boundary2 = fileService['createBoundary']();

			expect(boundary1).not.toBe(boundary2);
			expect(boundary1).toContain('----FormBoundary');
			expect(boundary2).toContain('----FormBoundary');
		});
	});
});

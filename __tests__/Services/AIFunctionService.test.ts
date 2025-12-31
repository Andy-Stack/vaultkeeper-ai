import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIFunctionService } from '../../Services/AIFunctionService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIFunction } from '../../Enums/AIFunction';
import { TFile } from 'obsidian';
import { Exception } from '../../Helpers/Exception';
import { AbortService } from '../../Services/AbortService';

/**
 * INTEGRATION TESTS - AIFunctionService
 *
 * Tests the AI function dispatcher with real FileSystemService integration.
 * Mocks only the Obsidian API layer (VaultService).
 *
 * Tests all AI functions:
 * - SearchVaultFiles
 * - ReadVaultFiles
 * - WriteVaultFile
 * - PatchVaultFile
 * - DeleteVaultFiles
 * - MoveVaultFiles
 * - RequestWebSearch (Gemini only)
 */

describe('AIFunctionService - Integration Tests', () => {
	let service: AIFunctionService;
	let mockFileSystemService: any;
	let abortService: AbortService;

	beforeEach(() => {
		// Mock FileSystemService with common operations
		mockFileSystemService = {
			searchVaultFiles: vi.fn(),
			listFilesInDirectory: vi.fn(),
			readFile: vi.fn(),
			writeFile: vi.fn(),
			patchFile: vi.fn(),
			deleteFile: vi.fn(),
			moveFile: vi.fn()
		};

		// Create real AbortService instance
		abortService = new AbortService();

		// Register the mocks
		RegisterSingleton(Services.FileSystemService, mockFileSystemService);
		RegisterSingleton(Services.AbortService, abortService);

		// Mock Exception.log
		vi.spyOn(Exception, 'log').mockImplementation(() => {});

		// Create service - it will resolve the mock FileSystemService and real AbortService
		service = new AIFunctionService();
	});

	afterEach(() => {
		// Clear singleton registry to prevent memory leaks
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	// Helper to create mock TFile
	function createMockFile(path: string, basename: string): TFile {
		const file = new TFile();
		file.path = path;
		file.basename = basename;
		file.name = basename + '.md';
		file.extension = 'md';
		return file;
	}

	describe('performAIFunction - SearchVaultFiles', () => {
		it('should return search results with snippets', async () => {
			const mockMatches = [
				{
					file: createMockFile('notes/test.md', 'test'),
					snippets: [
						{ text: 'This is a test note', matchIndex: 10 },
						{ text: 'Another test match', matchIndex: 5 }
					]
				},
				{
					file: createMockFile('docs/guide.md', 'guide'),
					snippets: [
						{ text: 'Guide for testing', matchIndex: 0 }
					]
				}
			];

			mockFileSystemService.searchVaultFiles.mockResolvedValue(mockMatches);

			const result = await service.performAIFunction({
				name: AIFunction.SearchVaultFiles,
				arguments: { search_terms: ['test'], user_message: 'test search' },
				toolId: 'tool_1'
			} as any);

			expect(result.name).toBe(AIFunction.SearchVaultFiles);
			expect(result.toolId).toBe('tool_1');
			expect(result.response).toEqual([{searchTerm: 'test', results: [
				{
					path: 'notes/test.md',
					snippets: [
						{ text: 'This is a test note', matchPosition: 10 },
						{ text: 'Another test match', matchPosition: 5 }
					]
				},
				{
					path: 'docs/guide.md',
					snippets: [
						{ text: 'Guide for testing', matchPosition: 0 }
					]
				}
			]}]);
		});

		it('should return empty array when search term is empty', async () => {
			// Mock returns empty array for empty search term
			mockFileSystemService.searchVaultFiles.mockResolvedValue([]);

			const result = await service.performAIFunction({
				name: AIFunction.SearchVaultFiles,
				arguments: { search_terms: [''], user_message: 'test search' },
				toolId: 'tool_2'
			} as any);

			// Empty search terms return empty results
			expect(result.response).toEqual([{searchTerm: '', results: []}]);
		});

		it('should return empty array when search term is whitespace', async () => {
			// Mock returns empty array for whitespace search term
			mockFileSystemService.searchVaultFiles.mockResolvedValue([]);

			const result = await service.performAIFunction({
				name: AIFunction.SearchVaultFiles,
				arguments: { search_terms: ['   '], user_message: 'test search' },
				toolId: 'tool_3'
			} as any);

			// Whitespace search terms return empty results (after trim)
			expect(result.response).toEqual([{searchTerm: '   ', results: []}]);
		});

		it('should return empty array when no matches found', async () => {
			mockFileSystemService.searchVaultFiles.mockResolvedValue([]);

			const result = await service.performAIFunction({
				name: AIFunction.SearchVaultFiles,
				arguments: { search_terms: ['nonexistent'], user_message: 'test search' },
				toolId: 'tool_4'
			} as any);

			// No matches returns empty results
			expect(result.response).toEqual([{searchTerm: 'nonexistent', results: []}]);
		});

		it('should handle single match', async () => {
			const mockMatches = [
				{
					file: createMockFile('single.md', 'single'),
					snippets: [{ text: 'Single result', matchIndex: 0 }]
				}
			];

			mockFileSystemService.searchVaultFiles.mockResolvedValue(mockMatches);

			const result = await service.performAIFunction({
				name: AIFunction.SearchVaultFiles,
				arguments: { search_terms: ['single'], user_message: 'test search' },
				toolId: 'tool_5'
			} as any);

			expect(result.response).toHaveLength(1);
			expect((result.response as any)[0].searchTerm).toBe('single');
			expect((result.response as any)[0].results).toHaveLength(1);
			expect((result.response as any)[0].results[0].path).toBe('single.md');
		});
	});

	describe('performAIFunction - ReadVaultFiles', () => {
		it('should read multiple files successfully', async () => {
			mockFileSystemService.readFile
				.mockResolvedValueOnce('Content of file 1')
				.mockResolvedValueOnce('Content of file 2')
				.mockResolvedValueOnce('Content of file 3');

			const result = await service.performAIFunction({
				name: AIFunction.ReadVaultFiles,
				arguments: { file_paths: ['file1.md', 'file2.md', 'file3.md'], user_message: 'test search' },
				toolId: 'tool_6'
			} as any);

			expect(result.response).toEqual({
				results: [
					{ type: 'md', path: 'file1.md', contents: 'Content of file 1' },
					{ type: 'md', path: 'file2.md', contents: 'Content of file 2' },
					{ type: 'md', path: 'file3.md', contents: 'Content of file 3' }
				]
			});
		});

		it('should handle missing files with error messages', async () => {
			const error1 = new Error('File not found');
			const error2 = new Error('File not found');

			mockFileSystemService.readFile
				.mockResolvedValueOnce('Existing content')
				.mockResolvedValueOnce(error1)
				.mockResolvedValueOnce(error2);

			const result = await service.performAIFunction({
				name: AIFunction.ReadVaultFiles,
				arguments: { file_paths: ['exists.md', 'missing1.md', 'missing2.md'], user_message: 'test search' },
				toolId: 'tool_7'
			} as any);

			expect(result.response).toEqual({
				results: [
					{ type: 'md', path: 'exists.md', contents: 'Existing content' },
					{ path: 'missing1.md', error: 'File not found' },
					{ path: 'missing2.md', error: 'File not found' }
				]
			});
		});

		it('should handle mixed success and failure', async () => {
			mockFileSystemService.readFile
				.mockResolvedValueOnce('Content A')
				.mockResolvedValueOnce(new Error('File not found'))
				.mockResolvedValueOnce('Content B');

			const result = await service.performAIFunction({
				name: AIFunction.ReadVaultFiles,
				arguments: { file_paths: ['a.md', 'missing.md', 'b.md'], user_message: 'test search' },
				toolId: 'tool_8'
			} as any);

			const results = (result.response as any).results;
			expect(results[0].contents).toBe('Content A');
			expect(results[1].error).toBe('File not found');
			expect(results[2].contents).toBe('Content B');
		});

		it('should handle empty file list', async () => {
			const result = await service.performAIFunction({
				name: AIFunction.ReadVaultFiles,
				arguments: { file_paths: [], user_message: 'test search' },
				toolId: 'tool_9'
			} as any);

			expect(result.response).toEqual({ results: [] });
		});

		it('should handle single file read', async () => {
			mockFileSystemService.readFile.mockResolvedValue('Single file content');

			const result = await service.performAIFunction({
				name: AIFunction.ReadVaultFiles,
				arguments: { file_paths: ['single.md'], user_message: 'test search' },
				toolId: 'tool_10'
			} as any);

			expect((result.response as any).results).toHaveLength(1);
			expect((result.response as any).results[0].contents).toBe('Single file content');
		});
	});

	describe('performAIFunction - WriteVaultFile', () => {
		it('should write file successfully', async () => {
			mockFileSystemService.writeFile.mockResolvedValue(undefined);

			const result = await service.performAIFunction({
				name: AIFunction.WriteVaultFile,
				arguments: {
					file_path: 'notes/new-note.md',
					content: '# New Note\n\nContent here',
					user_message: 'test search'
				},
				toolId: 'tool_11'
			} as any);

			expect(mockFileSystemService.writeFile).toHaveBeenCalledWith(
				'notes/new-note.md',
				'# New Note\n\nContent here'
			);
			expect(result.response).toEqual({ success: true });
		});

		it('should handle write failure', async () => {
			const error = new Error('Permission denied');
			mockFileSystemService.writeFile.mockResolvedValue(error);

			const result = await service.performAIFunction({
				name: AIFunction.WriteVaultFile,
				arguments: {
					file_path: 'protected.md',
					content: 'Content',
					user_message: 'test search'
				},
				toolId: 'tool_12'
			} as any);

			expect((result.response as any).success).toBe(false);
			expect((result.response as any).error).toBeDefined();
		});

		it('should normalize file path', async () => {
			mockFileSystemService.writeFile.mockResolvedValue(undefined);

			await service.performAIFunction({
				name: AIFunction.WriteVaultFile,
				arguments: {
					file_path: 'folder\\subfolder\\file.md',
					content: 'Content',
					user_message: 'test search'
				},
				toolId: 'tool_13'
			} as any);

			// normalizePath should convert backslashes to forward slashes
			expect(mockFileSystemService.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('/'),
				'Content'
			);
		});

		it('should handle empty content', async () => {
			mockFileSystemService.writeFile.mockResolvedValue(undefined);

			const result = await service.performAIFunction({
				name: AIFunction.WriteVaultFile,
				arguments: {
					file_path: 'empty.md',
					content: '',
					user_message: 'test search'
				},
				toolId: 'tool_14'
			} as any);

			expect(mockFileSystemService.writeFile).toHaveBeenCalledWith('empty.md', '');
			expect((result.response as any).success).toBe(true);
		});
	});

	describe('performAIFunction - PatchVaultFile', () => {
		it('should apply patch successfully', async () => {
			mockFileSystemService.patchFile.mockResolvedValue(createMockFile('notes/test.md', 'test'));

			const oldContent = 'old content';
			const newContent = 'new content';

			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'notes/test.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Updating test note'
				},
				toolId: 'tool_patch_1'
			} as any);

			expect(mockFileSystemService.patchFile).toHaveBeenCalledWith('notes/test.md', oldContent, newContent);
			expect(result.response).toEqual({ success: true });
		});

		it('should handle patch failure', async () => {
			const error = new Error('Content to replace was not found in the file');
			mockFileSystemService.patchFile.mockResolvedValue(error);

			const oldContent = 'old content';
			const newContent = 'new content';

			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'notes/test.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Updating note'
				},
				toolId: 'tool_patch_2'
			} as any);

			expect((result.response as any).success).toBe(false);
			expect((result.response as any).error).toBe('Content to replace was not found in the file');
		});

		it('should normalize file path', async () => {
			mockFileSystemService.patchFile.mockResolvedValue(createMockFile('folder/file.md', 'file'));

			const oldContent = 'old';
			const newContent = 'new';

			await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'folder\\subfolder\\file.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Patching file'
				},
				toolId: 'tool_patch_3'
			} as any);

			// normalizePath should convert backslashes to forward slashes
			expect(mockFileSystemService.patchFile).toHaveBeenCalledWith(
				expect.stringContaining('/'),
				oldContent,
				newContent
			);
		});

		it('should handle file not found error', async () => {
			const error = new Error('File does not exist: missing.md');
			mockFileSystemService.patchFile.mockResolvedValue(error);

			const oldContent = 'old';
			const newContent = 'new';

			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'missing.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Patching missing file'
				},
				toolId: 'tool_patch_4'
			} as any);

			expect((result.response as any).success).toBe(false);
			expect((result.response as any).error).toContain('File does not exist');
		});

		it('should handle complex multi-line replacement', async () => {
			mockFileSystemService.patchFile.mockResolvedValue(createMockFile('complex.md', 'complex'));

			const oldContent = '# Title\nOld line 1\nContext line';
			const newContent = '# Title\nNew line 1\nContext line';

			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'complex.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Applying complex patch'
				},
				toolId: 'tool_patch_5'
			} as any);

			expect(mockFileSystemService.patchFile).toHaveBeenCalledWith('complex.md', oldContent, newContent);
			expect((result.response as any).success).toBe(true);
		});

		it('should handle adding new content', async () => {
			mockFileSystemService.patchFile.mockResolvedValue(createMockFile('additions.md', 'additions'));

			const oldContent = '# Title\nExisting content';
			const newContent = '# Title\nExisting content\nNew line 1\nNew line 2';

			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'additions.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Adding new lines'
				},
				toolId: 'tool_patch_6'
			} as any);

			expect((result.response as any).success).toBe(true);
		});

		it('should handle removing content', async () => {
			mockFileSystemService.patchFile.mockResolvedValue(createMockFile('deletions.md', 'deletions'));

			const oldContent = '# Title\nLine to remove 1\nLine to remove 2\nRemaining content';
			const newContent = '# Title\nRemaining content';

			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'deletions.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Removing lines'
				},
				toolId: 'tool_patch_7'
			} as any);

			expect((result.response as any).success).toBe(true);
		});

		it('should handle permission denied error', async () => {
			const error = new Error('Permission denied');
			mockFileSystemService.patchFile.mockResolvedValue(error);

			const oldContent = 'old';
			const newContent = 'new';

			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'protected.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Patching protected file'
				},
				toolId: 'tool_patch_8'
			} as any);

			expect((result.response as any).success).toBe(false);
			expect((result.response as any).error).toBe('Permission denied');
		});

		it('should return correct toolId in response', async () => {
			mockFileSystemService.patchFile.mockResolvedValue(createMockFile('test.md', 'test'));

			const oldContent = 'old';
			const newContent = 'new';

			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'test.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Test patch'
				},
				toolId: 'unique_tool_id_123'
			} as any);

			expect(result.toolId).toBe('unique_tool_id_123');
			expect(result.name).toBe(AIFunction.PatchVaultFile);
		});

		it('should handle invalid arguments', async () => {
			const result = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					// missing required fields
					file_path: 'test.md'
					// oldContent, newContent and user_message are missing
				},
				toolId: 'tool_patch_invalid'
			} as any);

			expect((result.response as any).error).toContain('Invalid arguments for patch_vault_file');
			expect(mockFileSystemService.patchFile).not.toHaveBeenCalled();
		});
	});

	describe('performAIFunction - DeleteVaultFiles', () => {
		it('should delete multiple files successfully', async () => {
			mockFileSystemService.deleteFile
				.mockResolvedValueOnce({ success: true })
				.mockResolvedValueOnce({ success: true })
				.mockResolvedValueOnce({ success: true });

			const result = await service.performAIFunction({
				name: AIFunction.DeleteVaultFiles,
				arguments: {
					file_paths: ['file1.md', 'file2.md', 'file3.md'],
					confirm_deletion: true,
					user_message: 'test search'
				},
				toolId: 'tool_15'
			} as any);

			expect(result.response).toEqual({
				results: [
					{ path: 'file1.md', success: true },
					{ path: 'file2.md', success: true },
					{ path: 'file3.md', success: true }
				]
			});
		});

		it('should reject deletion when confirmation is false', async () => {
			const result = await service.performAIFunction({
				name: AIFunction.DeleteVaultFiles,
				arguments: {
					file_paths: ['file1.md', 'file2.md'],
					confirm_deletion: false,
					user_message: 'test search'
				},
				toolId: 'tool_16'
			} as any);

			expect(result.response).toEqual({
				error: 'Confirmation was false, no action taken'
			});
			expect(mockFileSystemService.deleteFile).not.toHaveBeenCalled();
		});

		it('should handle mixed success and failure', async () => {
			const error = new Error('File not found');

			mockFileSystemService.deleteFile
				.mockResolvedValueOnce(undefined) // void = success
				.mockResolvedValueOnce(error)
				.mockResolvedValueOnce(undefined); // void = success

			const result = await service.performAIFunction({
				name: AIFunction.DeleteVaultFiles,
				arguments: {
					file_paths: ['a.md', 'missing.md', 'c.md'],
					confirm_deletion: true,
					user_message: 'test search'
				},
				toolId: 'tool_17'
			} as any);

			expect((result.response as any).results).toEqual([
				{ path: 'a.md', success: true },
				{ path: 'missing.md', success: false, error: 'File not found' },
				{ path: 'c.md', success: true }
			]);
		});

		it('should handle all failures', async () => {
			mockFileSystemService.deleteFile
				.mockResolvedValueOnce(new Error('Error 1'))
				.mockResolvedValueOnce(new Error('Error 2'));

			const result = await service.performAIFunction({
				name: AIFunction.DeleteVaultFiles,
				arguments: {
					file_paths: ['file1.md', 'file2.md'],
					confirm_deletion: true,
					user_message: 'test search'
				},
				toolId: 'tool_18'
			} as any);

			const results = (result.response as any).results;
			expect(results[0].success).toBe(false);
			expect(results[1].success).toBe(false);
		});

		it('should handle empty file list with confirmation', async () => {
			const result = await service.performAIFunction({
				name: AIFunction.DeleteVaultFiles,
				arguments: {
					file_paths: [],
					confirm_deletion: true,
					user_message: 'test search'
				},
				toolId: 'tool_19'
			} as any);

			expect((result.response as any).results).toEqual([]);
		});
	});

	describe('performAIFunction - MoveVaultFiles', () => {
		it('should move multiple files successfully', async () => {
			mockFileSystemService.moveFile
				.mockResolvedValueOnce({ success: true })
				.mockResolvedValueOnce({ success: true })
				.mockResolvedValueOnce({ success: true });

			const result = await service.performAIFunction({
				name: AIFunction.MoveVaultFiles,
				arguments: {
					source_paths: ['a.md', 'b.md', 'c.md'],
					destination_paths: ['dest/a.md', 'dest/b.md', 'dest/c.md'],
					user_message: 'test search'
				},
				toolId: 'tool_20'
			} as any);

			expect(result.response).toEqual({
				results: [
					{ path: 'dest/a.md', success: true },
					{ path: 'dest/b.md', success: true },
					{ path: 'dest/c.md', success: true }
				]
			});
		});

		it('should reject when array lengths dont match', async () => {
			const result = await service.performAIFunction({
				name: AIFunction.MoveVaultFiles,
				arguments: {
					source_paths: ['a.md', 'b.md'],
					destination_paths: ['dest/a.md'],
					user_message: 'test search'
				},
				toolId: 'tool_21'
			} as any);

			expect(result.response).toEqual({
				error: 'Source paths array length does not equal destination paths array length'
			});
			expect(mockFileSystemService.moveFile).not.toHaveBeenCalled();
		});

		it('should handle mixed success and failure', async () => {
			const error = new Error('Destination exists');

			mockFileSystemService.moveFile
				.mockResolvedValueOnce(undefined) // void = success
				.mockResolvedValueOnce(error)
				.mockResolvedValueOnce(undefined); // void = success

			const result = await service.performAIFunction({
				name: AIFunction.MoveVaultFiles,
				arguments: {
					source_paths: ['a.md', 'b.md', 'c.md'],
					destination_paths: ['new/a.md', 'existing.md', 'new/c.md'],
					user_message: 'test search'
				},
				toolId: 'tool_22'
			} as any);

			expect((result.response as any).results).toEqual([
				{ path: 'new/a.md', success: true },
				{ path: 'existing.md', success: false, error: 'Destination exists' },
				{ path: 'new/c.md', success: true }
			]);
		});

		it('should call moveFile with correct parameters', async () => {
			mockFileSystemService.moveFile.mockResolvedValue(undefined); // void = success

			await service.performAIFunction({
				name: AIFunction.MoveVaultFiles,
				arguments: {
					source_paths: ['old/file.md'],
					destination_paths: ['new/file.md'],
					user_message: 'test search'
				},
				toolId: 'tool_23'
			} as any);

			expect(mockFileSystemService.moveFile).toHaveBeenCalledWith('old/file.md', 'new/file.md');
		});

		it('should handle empty arrays', async () => {
			const result = await service.performAIFunction({
				name: AIFunction.MoveVaultFiles,
				arguments: {
					source_paths: [],
					destination_paths: [],
					user_message: 'test search'
				},
				toolId: 'tool_24'
			} as any);

			expect((result.response as any).results).toEqual([]);
		});
	});

	describe('performAIFunction - RequestWebSearch', () => {
		it('should return empty object for Gemini web search', async () => {
			const result = await service.performAIFunction({
				name: AIFunction.RequestWebSearch,
				arguments: {},
				toolId: 'tool_25'
			} as any);

			expect(result.name).toBe(AIFunction.RequestWebSearch);
			expect(result.response).toEqual({});
			expect(result.toolId).toBe('tool_25');
		});

		it('should handle web search without arguments', async () => {
			const result = await service.performAIFunction({
				name: AIFunction.RequestWebSearch,
				arguments: {},
				toolId: 'tool_26'
			} as any);

			expect(result.response).toEqual({});
		});
	});

	describe('performAIFunction - Unknown Function', () => {
		it('should throw error for unknown function', async () => {
			await expect(service.performAIFunction({
				name: 'UnknownFunction' as any,
				arguments: {},
				toolId: 'tool_27'
			} as any)).rejects.toThrow('Unknown function name: UnknownFunction');
		});

		it('should throw error for invalid function', async () => {
			await expect(service.performAIFunction({
				name: 'InvalidFunction' as any,
				arguments: {},
				toolId: 'tool_error'
			} as any)).rejects.toThrow('Unknown function name: InvalidFunction');
		});
	});

	describe('Integration - Complete Workflows', () => {
		it('should handle search -> read workflow', async () => {
			// First search
			const mockMatches = [
				{
					file: createMockFile('found.md', 'found'),
					snippets: [{ text: 'Found content', matchIndex: 0 }]
				}
			];
			mockFileSystemService.searchVaultFiles.mockResolvedValue(mockMatches);

			const searchResult = await service.performAIFunction({
				name: AIFunction.SearchVaultFiles,
				arguments: { search_terms: ['test'], user_message: 'test search' },
				toolId: 'search_1'
			} as any);

			const foundPath = (searchResult.response as any)[0].results[0].path;

			// Then read
			mockFileSystemService.readFile.mockResolvedValue('File content here');

			const readResult = await service.performAIFunction({
				name: AIFunction.ReadVaultFiles,
				arguments: { file_paths: [foundPath], user_message: 'test search' },
				toolId: 'read_1'
			} as any);

			expect((readResult.response as any).results[0].contents).toBe('File content here');
			expect((readResult.response as any).results[0].error).toBeUndefined();
		});

		it('should handle write -> move workflow', async () => {
			// First write
			mockFileSystemService.writeFile.mockResolvedValue(undefined);

			const writeResult = await service.performAIFunction({
				name: AIFunction.WriteVaultFile,
				arguments: {
					file_path: 'temp.md',
					content: 'Temporary content',
					user_message: 'test search'
				},
				toolId: 'write_1'
			} as any);

			expect((writeResult.response as any).success).toBe(true);

			// Then move
			mockFileSystemService.moveFile.mockResolvedValue({ success: true });

			const moveResult = await service.performAIFunction({
				name: AIFunction.MoveVaultFiles,
				arguments: {
					source_paths: ['temp.md'],
					destination_paths: ['archive/temp.md'],
					user_message: 'test search'
				},
				toolId: 'move_1'
			} as any);

			expect((moveResult.response as any).results[0].success).toBe(true);
		});

		it('should handle read -> patch workflow', async () => {
			// First read the file
			mockFileSystemService.readFile.mockResolvedValue('# Original Title\n\nOriginal content');

			const readResult = await service.performAIFunction({
				name: AIFunction.ReadVaultFiles,
				arguments: { file_paths: ['document.md'], user_message: 'Reading file' },
				toolId: 'read_2'
			} as any);

			expect((readResult.response as any).results[0].contents).toContain('Original');

			// Then patch it
			mockFileSystemService.patchFile.mockResolvedValue(createMockFile('document.md', 'document'));

			const oldContent = '# Original Title';
			const newContent = '# Updated Title';

			const patchResult = await service.performAIFunction({
				name: AIFunction.PatchVaultFile,
				arguments: {
					file_path: 'document.md',
					oldContent: oldContent,
					newContent: newContent,
					user_message: 'Updating title'
				},
				toolId: 'patch_1'
			} as any);

			expect((patchResult.response as any).success).toBe(true);
			expect(mockFileSystemService.patchFile).toHaveBeenCalledWith('document.md', oldContent, newContent);
		});
	});
});

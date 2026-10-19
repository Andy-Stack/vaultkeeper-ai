import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIToolService } from '../../Services/AIServices/AIToolService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AITool } from '../../Enums/AITool';
import { Copy } from '../../Enums/Copy';
import { TFile, TFolder } from 'obsidian';
import { Exception } from '../../Helpers/Exception';
import { AbortService } from '../../Services/AbortService';
import { ChatMode } from '../../Enums/ChatMode';
import { Artifact } from '../../Conversations/Artifact';
import { ArtifactAction } from '../../Enums/ArtifactAction';
import { FileEvent } from '../../Enums/FileEvent';
import { Event } from '../../Enums/Event';
import { AIToolResponse } from '../../AIClasses/ToolDefinitions/AIToolResponse';
import type { IVaultChangeRequest } from '../../Services/TemporaryVaultService';

/**
 * INTEGRATION TESTS - AIToolService
 *
 * Tests the AI tool dispatcher against an in-memory vault. The FileSystemService is a
 * fake backed by a Map of path -> content, and the DiffService is a fake that lets each
 * test decide how the user reviews the proposed changes.
 *
 * Tools covered:
 * - SearchVaultFiles, ReadVaultFiles, ListVaultFiles, CreateVaultFolder, GetWebViewerContent
 * - ReadMemories, UpdateMemories
 * - WriteVaultFile, PatchVaultFile, DeleteVaultFiles, DeleteVaultFolder
 * - MoveVaultFiles, MoveVaultFolder
 * - RequestWebSearch (Gemini only)
 */

type ReviewDecision = (request: IVaultChangeRequest<TFile>, index: number) => 'accept' | 'reject' | string;

describe('AIToolService - Integration Tests', () => {
	let service: AIToolService;
	let mockFileSystemService: any;
	let mockDiffService: any;
	let mockEventService: any;
	let mockSettings: any;
	let mockMemoriesService: any;
	let mockWebViewerService: any;
	let abortService: AbortService;

	// In-memory vault used by the fake FileSystemService
	let vaultFiles: Map<string, string>;
	let vaultFolders: Set<string>;
	let protectedPaths: Set<string>;
	let reviewDecision: ReviewDecision;

	function createMockFile(path: string, basename?: string): TFile {
		const file = new TFile();
		file.path = path;
		file.name = path.split('/').pop() ?? path;
		file.basename = basename ?? file.name.replace(/\.[^.]+$/, '');
		file.extension = file.name.includes('.') ? file.name.split('.').pop()! : '';
		return file;
	}

	function createMockFolder(path: string): TFolder {
		const folder = new TFolder();
		folder.path = path;
		folder.name = path.split('/').pop() ?? path;
		folder.children = [];
		return folder;
	}

	function filesInFolder(folderPath: string): string[] {
		return [...vaultFiles.keys()].filter(path => path.startsWith(`${folderPath}/`));
	}

	function toolCall(name: AITool, args: Record<string, unknown>, toolId: string) {
		return { name, arguments: args, toolId } as any;
	}

	async function perform(call: any): Promise<AIToolResponse> {
		return (await service.performAITool([call]))[0];
	}

	function lastProposedRequests(): IVaultChangeRequest<TFile>[] {
		return mockDiffService.proposeChanges.mock.calls[0][0];
	}

	beforeEach(() => {
		vaultFiles = new Map();
		vaultFolders = new Set();
		protectedPaths = new Set();
		reviewDecision = () => 'accept';

		mockFileSystemService = {
			searchVaultFiles: vi.fn(),
			listDirectoryContents: vi.fn(),
			readFilePath: vi.fn().mockResolvedValue({ content: '', nextIndex: undefined }),
			readBinaryFile: vi.fn(),
			createFolder: vi.fn().mockImplementation(async (path: string) => {
				vaultFolders.add(path);
			}),
			getFile: vi.fn((path: string) => vaultFiles.has(path) ? createMockFile(path) : undefined),
			getFolder: vi.fn((path: string) => vaultFolders.has(path) ? createMockFolder(path) : undefined),
			exists: vi.fn(async (path: string) => vaultFiles.has(path) || vaultFolders.has(path)),
			isExclusion: vi.fn((path: string) => protectedPaths.has(path)),
			containsExclusions: vi.fn((path: string) => [...protectedPaths].some(protectedPath => protectedPath.startsWith(`${path}/`))),
			readFile: vi.fn(async (file: TFile) => vaultFiles.has(file.path)
				? { content: vaultFiles.get(file.path)!, nextIndex: undefined }
				: new Error(`File does not exist: ${file.path}`)),
			writeToFilePath: vi.fn(async (path: string, content: string) => {
				vaultFiles.set(path, content);
				return { result: createMockFile(path) };
			}),
			deleteFile: vi.fn(async (path: string) => {
				vaultFiles.delete(path);
				return { result: createMockFile(path) };
			}),
			deleteFolder: vi.fn(async (path: string) => {
				vaultFolders.delete(path);
				return { result: createMockFolder(path) };
			}),
			moveFile: vi.fn(async (source: string, destination: string) => {
				vaultFiles.set(destination, vaultFiles.get(source)!);
				vaultFiles.delete(source);
				return {};
			}),
			listFilesInDirectory: vi.fn(async (path: string) => filesInFolder(path).map(filePath => createMockFile(filePath))),
			listFoldersInDirectory: vi.fn(async () => [])
		};

		// The user reviews every proposed change; the fake applies the accepted ones like the real DiffService
		mockDiffService = {
			proposeChanges: vi.fn(async (requests: IVaultChangeRequest<TFile>[]) => {
				const results = [];
				for (const [index, request] of requests.entries()) {
					const decision = reviewDecision(request, index);
					if (decision === 'accept') {
						results.push(await request.changeAction());
					} else if (decision === 'reject') {
						results.push({ error: new Error(AIToolResponse.UserRejectionMessage) });
					} else {
						results.push({ error: new Error(`${AIToolResponse.UserSuggestionMessage}\n${decision}`) });
					}
				}
				return { results };
			})
		};

		mockEventService = { trigger: vi.fn(), on: vi.fn() };
		mockSettings = {
			settings: { enableMemories: false, allowUpdatingMemories: false, chatMode: ChatMode.Edit, contextSizeLimit: 100000 }
		};
		mockMemoriesService = {
			readMemories: vi.fn().mockResolvedValue('remembered'),
			updateMemories: vi.fn().mockResolvedValue(undefined)
		};
		mockWebViewerService = {
			getWebViewContent: vi.fn(),
			takeScreenshot: vi.fn()
		};

		abortService = new AbortService();

		RegisterSingleton(Services.FileSystemService, mockFileSystemService);
		RegisterSingleton(Services.DiffService, mockDiffService);
		RegisterSingleton(Services.EventService, mockEventService);
		RegisterSingleton(Services.SanitiserService, { sanitize: (path: string) => path });
		RegisterSingleton(Services.AbortService, abortService);
		RegisterSingleton(Services.MemoriesService, mockMemoriesService);
		RegisterSingleton(Services.SettingsService, mockSettings);
		RegisterSingleton(Services.WebViewerService, mockWebViewerService);

		vi.spyOn(Exception, 'log').mockImplementation(() => {});

		service = new AIToolService();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('performAITool - SearchVaultFiles', () => {
		it('should return search results with snippets', async () => {
			const mockResult = {
				fileNameMatches: [],
				fileContentMatches: [
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
				],
				nextFileNamesIndex: undefined,
				nextFileContentsIndex: undefined
			};

			mockFileSystemService.searchVaultFiles.mockResolvedValue(mockResult);

			const result = await perform({
				name: AITool.SearchVaultFiles,
				arguments: { search_terms: [{ search_term: 'test' }], user_message: 'test search' },
				toolId: 'tool_1'
			} as any);

			expect(result.name).toBe(AITool.SearchVaultFiles);
			expect(result.toolId).toBe('tool_1');
			expect(result.payload.response).toEqual([{
				searchTerm: 'test',
				fileNameMatches: [],
				fileContentMatches: [
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
				],
				nextFileNamesIndex: undefined,
				nextFileContentsIndex: undefined
			}]);
		});

		it('should return empty array when search term is empty', async () => {
			// Mock returns empty results for empty search term
			mockFileSystemService.searchVaultFiles.mockResolvedValue({
				fileNameMatches: [],
				fileContentMatches: [],
				nextFileNamesIndex: undefined,
				nextFileContentsIndex: undefined
			});

			const result = await perform({
				name: AITool.SearchVaultFiles,
				arguments: { search_terms: [{ search_term: '' }], user_message: 'test search' },
				toolId: 'tool_2'
			} as any);

			// Empty search terms return empty results
			expect(result.payload.response).toEqual([{
				searchTerm: '', fileNameMatches: [], fileContentMatches: [],
				nextFileNamesIndex: undefined, nextFileContentsIndex: undefined
			}]);
		});

		it('should return empty array when search term is whitespace', async () => {
			// Mock returns empty results for whitespace search term
			mockFileSystemService.searchVaultFiles.mockResolvedValue({
				fileNameMatches: [],
				fileContentMatches: [],
				nextFileNamesIndex: undefined,
				nextFileContentsIndex: undefined
			});

			const result = await perform({
				name: AITool.SearchVaultFiles,
				arguments: { search_terms: [{ search_term: '   ' }], user_message: 'test search' },
				toolId: 'tool_3'
			} as any);

			// Whitespace search terms return empty results (after trim)
			expect(result.payload.response).toEqual([{
				searchTerm: '   ', fileNameMatches: [], fileContentMatches: [],
				nextFileNamesIndex: undefined, nextFileContentsIndex: undefined
			}]);
		});

		it('should return empty array when no matches found', async () => {
			mockFileSystemService.searchVaultFiles.mockResolvedValue({
				fileNameMatches: [],
				fileContentMatches: [],
				nextFileNamesIndex: undefined,
				nextFileContentsIndex: undefined
			});

			const result = await perform({
				name: AITool.SearchVaultFiles,
				arguments: { search_terms: [{ search_term: 'nonexistent' }], user_message: 'test search' },
				toolId: 'tool_4'
			} as any);

			// No matches returns empty results
			expect(result.payload.response).toEqual([{
				searchTerm: 'nonexistent', fileNameMatches: [], fileContentMatches: [],
				nextFileNamesIndex: undefined, nextFileContentsIndex: undefined
			}]);
		});

		it('should handle single match', async () => {
			const mockResult = {
				fileNameMatches: [],
				fileContentMatches: [
					{
						file: createMockFile('single.md', 'single'),
						snippets: [{ text: 'Single result', matchIndex: 0 }]
					}
				],
				nextFileNamesIndex: undefined,
				nextFileContentsIndex: undefined
			};

			mockFileSystemService.searchVaultFiles.mockResolvedValue(mockResult);

			const result = await perform({
				name: AITool.SearchVaultFiles,
				arguments: { search_terms: [{ search_term: 'single' }], user_message: 'test search' },
				toolId: 'tool_5'
			} as any);

			expect(result.payload.response).toHaveLength(1);
			expect((result.payload.response as any)[0].searchTerm).toBe('single');
			expect((result.payload.response as any)[0].fileContentMatches).toHaveLength(1);
			expect((result.payload.response as any)[0].fileContentMatches[0].path).toBe('single.md');
		});
	});

	describe('performAITool - ReadVaultFiles', () => {
		it('should read multiple files successfully', async () => {
			mockFileSystemService.readFilePath
				.mockResolvedValueOnce({ content: 'Content of file 1', nextIndex: undefined })
				.mockResolvedValueOnce({ content: 'Content of file 2', nextIndex: undefined })
				.mockResolvedValueOnce({ content: 'Content of file 3', nextIndex: undefined });

			const result = await perform({
				name: AITool.ReadVaultFiles,
				arguments: { files: [{ file_path: 'file1.md' }, { file_path: 'file2.md' }, { file_path: 'file3.md' }], user_message: 'test search' },
				toolId: 'tool_6'
			} as any);

			expect(result.payload.response).toEqual({
				results: [
					{ type: 'md', path: 'file1.md', contents: 'Content of file 1', nextIndex: undefined },
					{ type: 'md', path: 'file2.md', contents: 'Content of file 2', nextIndex: undefined },
					{ type: 'md', path: 'file3.md', contents: 'Content of file 3', nextIndex: undefined }
				]
			});
		});

		it('should handle missing files with error messages', async () => {
			const error1 = new Error('File not found');
			const error2 = new Error('File not found');

			mockFileSystemService.readFilePath
				.mockResolvedValueOnce({ content: 'Existing content', nextIndex: undefined })
				.mockResolvedValueOnce(error1)
				.mockResolvedValueOnce(error2);

			const result = await perform({
				name: AITool.ReadVaultFiles,
				arguments: { files: [{ file_path: 'exists.md' }, { file_path: 'missing1.md' }, { file_path: 'missing2.md' }], user_message: 'test search' },
				toolId: 'tool_7'
			} as any);

			expect(result.payload.response).toEqual({
				results: [
					{ type: 'md', path: 'exists.md', contents: 'Existing content', nextIndex: undefined },
					{ path: 'missing1.md', error: 'File not found' },
					{ path: 'missing2.md', error: 'File not found' }
				]
			});
		});

		it('should handle mixed success and failure', async () => {
			mockFileSystemService.readFilePath
				.mockResolvedValueOnce({ content: 'Content A', nextIndex: undefined })
				.mockResolvedValueOnce(new Error('File not found'))
				.mockResolvedValueOnce({ content: 'Content B', nextIndex: undefined });

			const result = await perform({
				name: AITool.ReadVaultFiles,
				arguments: { files: [{ file_path: 'a.md' }, { file_path: 'missing.md' }, { file_path: 'b.md' }], user_message: 'test search' },
				toolId: 'tool_8'
			} as any);

			const results = (result.payload.response as any).results;
			expect(results.find((r: any) => r.contents === 'Content A')).toBeDefined();
			expect(results.find((r: any) => r.contents === 'Content B')).toBeDefined();
			expect(results.find((r: any) => r.error === 'File not found')).toBeDefined();
		});

		it('should handle empty file list', async () => {
			const result = await perform({
				name: AITool.ReadVaultFiles,
				arguments: { files: [], user_message: 'test search' },
				toolId: 'tool_9'
			} as any);

			expect((result.payload.response as any).count).toBe(0);
			expect((result.payload.response as any).message).toContain('attached to the conversation');
		});

		it('should handle single file read', async () => {
			mockFileSystemService.readFilePath.mockResolvedValue({ content: 'Single file content', nextIndex: undefined });

			const result = await perform({
				name: AITool.ReadVaultFiles,
				arguments: { files: [{ file_path: 'single.md' }], user_message: 'test search' },
				toolId: 'tool_10'
			} as any);

			expect((result.payload.response as any).results).toHaveLength(1);
			expect((result.payload.response as any).results[0].contents).toBe('Single file content');
		});

		it('should return nextIndex when a text file is truncated and resume from it on a follow-up call', async () => {
			mockFileSystemService.readFilePath.mockResolvedValueOnce({ content: 'first chunk', nextIndex: 5000 });

			const firstResult = await perform({
				name: AITool.ReadVaultFiles,
				arguments: { files: [{ file_path: 'large.md' }], user_message: 'test search' },
				toolId: 'tool_11'
			} as any);

			expect((firstResult.payload.response as any).results[0]).toEqual({
				type: 'md', path: 'large.md', contents: 'first chunk', nextIndex: 5000
			});

			mockFileSystemService.readFilePath.mockResolvedValueOnce({ content: 'second chunk', nextIndex: undefined });

			const secondResult = await perform({
				name: AITool.ReadVaultFiles,
				arguments: { files: [{ file_path: 'large.md', index: 5000 }], user_message: 'test search' },
				toolId: 'tool_12'
			} as any);

			expect((secondResult.payload.response as any).results[0]).toEqual({
				type: 'md', path: 'large.md', contents: 'second chunk', nextIndex: undefined
			});
			expect(mockFileSystemService.readFilePath).toHaveBeenLastCalledWith('large.md', expect.objectContaining({ primaryIndex: 5000 }));
		});
	});

	describe('performAITool - ListVaultFiles', () => {
		it('should list files and directories with their types', async () => {
			mockFileSystemService.listDirectoryContents.mockResolvedValue({
				results: [createMockFile('notes/a.md'), createMockFolder('notes/sub')],
				nextIndex: 25
			});

			const result = await perform(toolCall(AITool.ListVaultFiles, { path: 'notes', recursive: false, index: 5 }, 'tool_list'));

			expect(mockFileSystemService.listDirectoryContents).toHaveBeenCalledWith('notes', { primaryIndex: 5, recursive: false });
			expect(result.payload.response).toEqual({
				contents: [
					{ type: 'file', path: 'notes/a.md' },
					{ type: 'directory', path: 'notes/sub' }
				],
				nextIndex: 25
			});
		});

		it('should return an error for invalid arguments', async () => {
			const result = await perform(toolCall(AITool.ListVaultFiles, { path: 'notes' }, 'tool_list_invalid'));

			expect((result.payload.response as any).error).toContain('Invalid arguments for list_vault_files');
			expect(mockFileSystemService.listDirectoryContents).not.toHaveBeenCalled();
		});
	});

	describe('performAITool - CreateVaultFolder', () => {
		it('should create the folder', async () => {
			const result = await perform(toolCall(AITool.CreateVaultFolder, { path: 'projects/new' }, 'tool_mkdir'));

			expect(mockFileSystemService.createFolder).toHaveBeenCalledWith('projects/new');
			expect(result.payload.response).toEqual({ path: 'projects/new', success: true });
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should report a failure to create the folder', async () => {
			mockFileSystemService.createFolder.mockResolvedValue(new Error('Folder is protected'));

			const result = await perform(toolCall(AITool.CreateVaultFolder, { path: 'protected' }, 'tool_mkdir_fail'));

			expect(result.payload.response).toEqual({ path: 'protected', success: false, error: 'Folder is protected' });
		});
	});

	describe('performAITool - GetWebViewerContent', () => {
		it('should return the text content of the web view', async () => {
			mockWebViewerService.getWebViewContent.mockResolvedValue({ content: 'Page text', nextIndex: 100 });

			const result = await perform(toolCall(AITool.GetWebViewerContent, { format: 'text', url_hint: 'example.com' }, 'tool_web_1'));

			expect(mockWebViewerService.getWebViewContent).toHaveBeenCalledWith('example.com', 0);
			expect(result.payload.response).toEqual({ content: 'Page text', nextIndex: 100 });
		});

		it('should return an error when no web view is open', async () => {
			mockWebViewerService.getWebViewContent.mockResolvedValue(undefined);

			const result = await perform(toolCall(AITool.GetWebViewerContent, { format: 'text' }, 'tool_web_2'));

			expect((result.payload.response as any).error).toContain('No open web view was found');
		});

		it('should return an error when no web view matches the url hint', async () => {
			mockWebViewerService.getWebViewContent.mockResolvedValue(undefined);

			const result = await perform(toolCall(AITool.GetWebViewerContent, { format: 'text', url_hint: 'missing.com' }, 'tool_web_3'));

			expect((result.payload.response as any).error).toContain('missing.com');
		});

		it('should attach a screenshot', async () => {
			mockWebViewerService.takeScreenshot.mockResolvedValue('base64-image');

			const result = await perform(toolCall(AITool.GetWebViewerContent, { format: 'screenshot' }, 'tool_web_4'));

			expect(result.payload.response).toEqual({ success: true });
			expect(result.payload.attachments).toHaveLength(1);
			expect(result.payload.attachments[0].fileName).toBe('screenshot.png');
		});

		it('should return an error when a screenshot cannot be taken', async () => {
			mockWebViewerService.takeScreenshot.mockResolvedValue(undefined);

			const result = await perform(toolCall(AITool.GetWebViewerContent, { format: 'screenshot' }, 'tool_web_5'));

			expect((result.payload.response as any).error).toContain('No open web view was found');
			expect(result.payload.attachments).toEqual([]);
		});
	});

	describe('performAITool - Memories', () => {
		it('should refuse to read memories when they are disabled', async () => {
			const result = await perform(toolCall(AITool.ReadMemories, {}, 'tool_mem_1'));

			expect((result.payload.response as any).error).toContain('memories have been disabled');
			expect(mockMemoriesService.readMemories).not.toHaveBeenCalled();
		});

		it('should read memories when enabled', async () => {
			mockSettings.settings.enableMemories = true;

			const result = await perform(toolCall(AITool.ReadMemories, {}, 'tool_mem_2'));

			expect(result.payload.response).toEqual({ memories: 'remembered' });
		});

		it('should refuse to update memories when updating is disabled', async () => {
			const result = await perform(toolCall(AITool.UpdateMemories, { content: 'new' }, 'tool_mem_3'));

			expect((result.payload.response as any).error).toContain('updating memories has been disabled');
			expect(mockMemoriesService.updateMemories).not.toHaveBeenCalled();
		});

		it('should refuse to update memories that have not been read', async () => {
			mockSettings.settings.allowUpdatingMemories = true;

			const result = await perform(toolCall(AITool.UpdateMemories, { content: 'new' }, 'tool_mem_4'));

			expect((result.payload.response as any).error).toContain('Memories must be read before they can be updated');
			expect(mockMemoriesService.updateMemories).not.toHaveBeenCalled();
		});

		it('should update memories after they were read in an earlier turn', async () => {
			mockSettings.settings.enableMemories = true;
			mockSettings.settings.allowUpdatingMemories = true;

			await perform(toolCall(AITool.ReadMemories, {}, 'tool_mem_5a'));
			const result = await perform(toolCall(AITool.UpdateMemories, { content: 'updated' }, 'tool_mem_5b'));

			expect(mockMemoriesService.updateMemories).toHaveBeenCalledWith('updated');
			expect((result.payload.response as any).error).toBeUndefined();
		});

		it('should not allow updating memories that were only read in the same batch', async () => {
			mockSettings.settings.enableMemories = true;
			mockSettings.settings.allowUpdatingMemories = true;

			const responses = await service.performAITool([
				toolCall(AITool.ReadMemories, {}, 'tool_mem_6a'),
				toolCall(AITool.UpdateMemories, { content: 'updated' }, 'tool_mem_6b')
			]);

			expect((responses[1].payload.response as any).error).toContain('Memories must be read before they can be updated');
			expect(mockMemoriesService.updateMemories).not.toHaveBeenCalled();
		});

		it('should require memories to be read again after a turn that did not read them', async () => {
			mockSettings.settings.enableMemories = true;
			mockSettings.settings.allowUpdatingMemories = true;

			await perform(toolCall(AITool.ReadMemories, {}, 'tool_mem_7a'));
			await perform(toolCall(AITool.RequestWebSearch, {}, 'tool_mem_7b'));
			const result = await perform(toolCall(AITool.UpdateMemories, { content: 'updated' }, 'tool_mem_7c'));

			expect((result.payload.response as any).error).toContain('Memories must be read before they can be updated');
		});
	});

	describe('performAITool - WriteVaultFile', () => {
		it('should propose creating a new file and report success once accepted', async () => {
			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'notes/new-note.md', content: '# New Note\n\nContent here' }, 'tool_11'));

			const [request] = lastProposedRequests();
			expect(request.changeType).toBe(FileEvent.Create);
			expect(request.oldPath).toBeUndefined();
			expect(request.newPath).toBe('notes/new-note.md');
			expect(request.newContent).toBe('# New Note\n\nContent here');
			expect(mockFileSystemService.writeToFilePath).toHaveBeenCalledWith('notes/new-note.md', '# New Note\n\nContent here');
			expect(result.name).toBe(AITool.WriteVaultFile);
			expect(result.toolId).toBe('tool_11');
			expect(result.payload.response).toEqual({ results: [{ path: 'notes/new-note.md', success: true }] });
		});

		it('should propose modifying an existing file with its current content', async () => {
			vaultFiles.set('notes/existing.md', 'Old content');

			await perform(toolCall(AITool.WriteVaultFile, { file_path: 'notes/existing.md', content: 'New content' }, 'tool_11a'));

			const [request] = lastProposedRequests();
			expect(request.changeType).toBe(FileEvent.Modify);
			expect(request.oldPath).toBe('notes/existing.md');
			expect(request.oldContent).toBe('Old content');
			expect(request.newContent).toBe('New content');
			expect(vaultFiles.get('notes/existing.md')).toBe('New content');
		});

		it('should not write anything until the user has reviewed the change', async () => {
			let contentDuringReview: string | undefined;
			mockDiffService.proposeChanges.mockImplementation(async (requests: IVaultChangeRequest<TFile>[]) => {
				contentDuringReview = vaultFiles.get('notes/pending.md');
				return { results: [await requests[0].changeAction()] };
			});

			await perform(toolCall(AITool.WriteVaultFile, { file_path: 'notes/pending.md', content: 'Content' }, 'tool_11b'));

			expect(contentDuringReview).toBeUndefined();
			expect(vaultFiles.get('notes/pending.md')).toBe('Content');
		});

		it('should produce a create artifact with empty original content for a new file', async () => {
			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'brand-new.md', content: 'Brand new content' }, 'tool_11c'));

			expect(result.payload.artifacts).toHaveLength(1);
			const artifact = result.payload.artifacts[0];
			expect(artifact).toBeInstanceOf(Artifact);
			expect(artifact.action).toBe(ArtifactAction.Create);
			expect(artifact.filePath).toBe('brand-new.md');
			expect(artifact.originalContent).toBe('');
			expect(artifact.updatedContent).toBe('Brand new content');
		});

		it('should produce a modify artifact tracking the before/after content', async () => {
			vaultFiles.set('notes/existing.md', 'Old content');

			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'notes/existing.md', content: '# New Note\n\nContent here' }, 'tool_11d'));

			const artifact = result.payload.artifacts[0];
			expect(artifact.action).toBe(ArtifactAction.Modify);
			expect(artifact.originalContent).toBe('Old content');
			expect(artifact.updatedContent).toBe('# New Note\n\nContent here');
		});

		it('should report the rejection and leave the file alone when the user rejects the change', async () => {
			reviewDecision = () => 'reject';
			vaultFiles.set('notes/existing.md', 'Old content');

			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'notes/existing.md', content: 'New content' }, 'tool_11e'));

			expect(vaultFiles.get('notes/existing.md')).toBe('Old content');
			expect(mockFileSystemService.writeToFilePath).not.toHaveBeenCalled();
			expect((result.payload.response as any).results[0]).toEqual({
				path: 'notes/existing.md',
				success: false,
				error: AIToolResponse.UserRejectionMessage
			});
			expect(result.payload.artifacts).toEqual([]);
		});

		it('should pass the users suggestion back to the agent', async () => {
			reviewDecision = () => 'use a heading instead';

			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'notes/a.md', content: 'text' }, 'tool_11f'));

			const writeResult = (result.payload.response as any).results[0];
			expect(writeResult.success).toBe(false);
			expect(writeResult.error).toContain('use a heading instead');
			expect(mockFileSystemService.writeToFilePath).not.toHaveBeenCalled();
		});

		it('should handle a write failure after the change was accepted', async () => {
			mockFileSystemService.writeToFilePath.mockResolvedValue({ error: new Error('Permission denied') });

			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'protected.md', content: 'Content' }, 'tool_12'));

			expect((result.payload.response as any).results).toEqual([
				{ path: 'protected.md', success: false, error: 'Permission denied' }
			]);
			expect(result.payload.artifacts).toEqual([]);
		});

		it('should not propose a change when the existing file cannot be read', async () => {
			vaultFiles.set('notes/locked.md', 'Content');
			mockFileSystemService.readFile.mockResolvedValue(new Error('read error'));

			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'notes/locked.md', content: 'New' }, 'tool_12a'));

			expect((result.payload.response as any).results[0].error).toBe('Unable to read existing file, no changes have been made: read error');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should normalize the file path used for writing', async () => {
			await perform(toolCall(AITool.WriteVaultFile, { file_path: 'folder\\subfolder\\file.md', content: 'Content' }, 'tool_13'));

			expect(mockFileSystemService.writeToFilePath).toHaveBeenCalledWith('folder/subfolder/file.md', 'Content');
		});

		it('should handle empty content', async () => {
			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'empty.md', content: '' }, 'tool_14'));

			expect(mockFileSystemService.writeToFilePath).toHaveBeenCalledWith('empty.md', '');
			expect((result.payload.response as any).results[0].success).toBe(true);
		});

		it('should return an error for invalid arguments', async () => {
			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'only-a-path.md' }, 'tool_14a'));

			expect((result.payload.response as any).error).toContain('Invalid arguments for write_vault_file');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});
	});

	describe('performAITool - PatchVaultFile', () => {
		beforeEach(() => {
			vaultFiles.set('notes/test.md', '# Title\nold content\nfooter');
		});

		it('should apply a single edit', async () => {
			const result = await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/test.md',
				edits: [{ old_content: 'old content', new_content: 'new content' }]
			}, 'tool_patch_1'));

			const [request] = lastProposedRequests();
			expect(request.changeType).toBe(FileEvent.Modify);
			expect(request.oldContent).toBe('# Title\nold content\nfooter');
			expect(request.newContent).toBe('# Title\nnew content\nfooter');
			expect(vaultFiles.get('notes/test.md')).toBe('# Title\nnew content\nfooter');
			expect(result.toolId).toBe('tool_patch_1');
			expect(result.payload.response).toEqual({ results: [{ path: 'notes/test.md', success: true }] });
		});

		it('should apply multiple edits in order', async () => {
			await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/test.md',
				edits: [
					{ old_content: 'old content', new_content: 'middle' },
					{ old_content: 'middle', new_content: 'final' },
					{ old_content: '# Title', new_content: '# Heading' }
				]
			}, 'tool_patch_2'));

			expect(vaultFiles.get('notes/test.md')).toBe('# Heading\nfinal\nfooter');
		});

		it('should replace every occurrence when replace_all is set and only the first otherwise', async () => {
			vaultFiles.set('notes/repeat.md', 'foo bar foo baz foo');

			await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/repeat.md',
				edits: [{ old_content: 'foo', new_content: 'qux' }]
			}, 'tool_patch_3a'));
			expect(vaultFiles.get('notes/repeat.md')).toBe('qux bar foo baz foo');

			await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/repeat.md',
				edits: [{ old_content: 'foo', new_content: 'qux', replace_all: true }]
			}, 'tool_patch_3b'));
			expect(vaultFiles.get('notes/repeat.md')).toBe('qux bar qux baz qux');
		});

		it('should match old content with flexible whitespace', async () => {
			vaultFiles.set('notes/spaced.md', 'line one\n\n   line two');

			await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/spaced.md',
				edits: [{ old_content: 'line one line two', new_content: 'merged' }]
			}, 'tool_patch_4'));

			expect(vaultFiles.get('notes/spaced.md')).toBe('merged');
		});

		it('should support removing content', async () => {
			await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/test.md',
				edits: [{ old_content: '\nfooter', new_content: '' }]
			}, 'tool_patch_5'));

			expect(vaultFiles.get('notes/test.md')).toBe('# Title\nold content');
		});

		it('should produce a modify artifact tracking the before/after content', async () => {
			const result = await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/test.md',
				edits: [{ old_content: 'old content', new_content: 'new content' }]
			}, 'tool_patch_6'));

			expect(result.payload.artifacts).toHaveLength(1);
			const artifact = result.payload.artifacts[0];
			expect(artifact.action).toBe(ArtifactAction.Modify);
			expect(artifact.filePath).toBe('notes/test.md');
			expect(artifact.originalContent).toBe('# Title\nold content\nfooter');
			expect(artifact.updatedContent).toBe('# Title\nnew content\nfooter');
		});

		it('should fail without proposing a change when the old content is not found', async () => {
			const result = await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/test.md',
				edits: [{ old_content: 'missing content', new_content: 'new content' }]
			}, 'tool_patch_7'));

			const error = (result.payload.response as any).results[0].error;
			expect(error).toContain('Content to replace was not found in the file');
			expect(error).toContain('missing content');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
			expect(vaultFiles.get('notes/test.md')).toBe('# Title\nold content\nfooter');
			expect(result.payload.artifacts).toEqual([]);
		});

		it('should apply edits atomically, changing nothing when a later edit does not match', async () => {
			const result = await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/test.md',
				edits: [
					{ old_content: 'old content', new_content: 'new content' },
					{ old_content: 'not present', new_content: 'x' }
				]
			}, 'tool_patch_8'));

			expect((result.payload.response as any).results[0].error).toContain('not present');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
			expect(vaultFiles.get('notes/test.md')).toBe('# Title\nold content\nfooter');
		});

		it('should fail when the file does not exist', async () => {
			const result = await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/missing.md',
				edits: [{ old_content: 'a', new_content: 'b' }]
			}, 'tool_patch_9'));

			expect((result.payload.response as any).results[0].error).toBe('Patch failed, file does not exist: notes/missing.md');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should refuse to patch binary files', async () => {
			vaultFiles.set('images/photo.png', 'binary');

			const result = await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'images/photo.png',
				edits: [{ old_content: 'a', new_content: 'b' }]
			}, 'tool_patch_10'));

			expect((result.payload.response as any).results[0].error).toBe('Patching png files is not supported');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should fail when the file cannot be read', async () => {
			mockFileSystemService.readFile.mockResolvedValue(new Error('Permission denied'));

			const result = await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/test.md',
				edits: [{ old_content: 'a', new_content: 'b' }]
			}, 'tool_patch_11'));

			expect((result.payload.response as any).results[0].error).toBe('Permission denied');
		});

		it('should leave the file untouched and report the rejection when the user rejects the patch', async () => {
			reviewDecision = () => 'reject';

			const result = await perform(toolCall(AITool.PatchVaultFile, {
				file_path: 'notes/test.md',
				edits: [{ old_content: 'old content', new_content: 'new content' }]
			}, 'tool_patch_12'));

			expect(vaultFiles.get('notes/test.md')).toBe('# Title\nold content\nfooter');
			expect((result.payload.response as any).results[0].error).toBe(AIToolResponse.UserRejectionMessage);
			expect(result.payload.artifacts).toEqual([]);
		});

		it('should return an error for invalid arguments', async () => {
			const result = await perform(toolCall(AITool.PatchVaultFile, { file_path: 'notes/test.md' }, 'tool_patch_invalid'));

			expect((result.payload.response as any).error).toContain('Invalid arguments for patch_vault_file');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});
	});

	describe('performAITool - DeleteVaultFiles', () => {
		it('should delete multiple files successfully', async () => {
			['file1.md', 'file2.md', 'file3.md'].forEach(path => vaultFiles.set(path, `content of ${path}`));

			const result = await perform(toolCall(AITool.DeleteVaultFiles, {
				file_paths: ['file1.md', 'file2.md', 'file3.md'],
				confirm_deletion: true
			}, 'tool_15'));

			expect(lastProposedRequests().every(request => request.changeType === FileEvent.Delete)).toBe(true);
			expect(result.payload.response).toEqual({
				results: [
					{ path: 'file1.md', success: true },
					{ path: 'file2.md', success: true },
					{ path: 'file3.md', success: true }
				]
			});
			expect(vaultFiles.size).toBe(0);
		});

		it('should take no action when confirmation is false', async () => {
			vaultFiles.set('notes/keep.md', 'content');

			const result = await perform(toolCall(AITool.DeleteVaultFiles, { file_paths: ['notes/keep.md'], confirm_deletion: false }, 'tool_16'));

			expect(result.payload.response).toEqual({ results: [{ error: 'Confirmation was false, no action taken' }] });
			expect(result.payload.artifacts).toEqual([]);
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
			expect(vaultFiles.has('notes/keep.md')).toBe(true);
		});

		it('should report files that do not exist alongside the ones that were deleted', async () => {
			vaultFiles.set('exists.md', 'content');

			const result = await perform(toolCall(AITool.DeleteVaultFiles, { file_paths: ['exists.md', 'missing.md'], confirm_deletion: true }, 'tool_17'));

			expect((result.payload.response as any).results).toEqual([
				{ path: 'missing.md', success: false, error: 'File does not exist: missing.md' },
				{ path: 'exists.md', success: true }
			]);
		});

		it('should handle all files failing without opening a review', async () => {
			const result = await perform(toolCall(AITool.DeleteVaultFiles, { file_paths: ['a.md', 'b.md'], confirm_deletion: true }, 'tool_18'));

			expect((result.payload.response as any).results).toEqual([
				{ path: 'a.md', success: false, error: 'File does not exist: a.md' },
				{ path: 'b.md', success: false, error: 'File does not exist: b.md' }
			]);
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should handle an empty file list with confirmation', async () => {
			const result = await perform(toolCall(AITool.DeleteVaultFiles, { file_paths: [], confirm_deletion: true }, 'tool_19'));

			expect(result.payload.response).toEqual({ results: [] });
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should report an unreadable file as not deleted', async () => {
			vaultFiles.set('locked.md', 'content');
			mockFileSystemService.readFile.mockResolvedValue(new Error('read error'));

			const result = await perform(toolCall(AITool.DeleteVaultFiles, { file_paths: ['locked.md'], confirm_deletion: true }, 'tool_19a'));

			expect((result.payload.response as any).results[0].error).toBe('Unable to read file, it has not been deleted: read error');
			expect(vaultFiles.has('locked.md')).toBe(true);
		});

		it('should produce artifacts capturing the content of deleted text files', async () => {
			vaultFiles.set('notes/gone.md', 'Content before deletion');

			const result = await perform(toolCall(AITool.DeleteVaultFiles, { file_paths: ['notes/gone.md'], confirm_deletion: true }, 'tool_19b'));

			expect(result.payload.artifacts).toHaveLength(1);
			const artifact = result.payload.artifacts[0];
			expect(artifact).toBeInstanceOf(Artifact);
			expect(artifact.action).toBe(ArtifactAction.Delete);
			expect(artifact.filePath).toBe('notes/gone.md');
			expect(artifact.originalContent).toBe('Content before deletion');
			expect(artifact.updatedContent).toBe('');
		});

		it('should produce base64 artifacts capturing the content of deleted binary files', async () => {
			vaultFiles.set('images/gone.png', 'binary');
			mockFileSystemService.readBinaryFile.mockResolvedValue(new TextEncoder().encode('binary-bytes').buffer);

			const result = await perform(toolCall(AITool.DeleteVaultFiles, { file_paths: ['images/gone.png'], confirm_deletion: true }, 'tool_19c'));

			expect(result.payload.artifacts).toHaveLength(1);
			const artifact = result.payload.artifacts[0];
			expect(artifact.filePath).toBe('images/gone.png');
			expect(artifact.base64).toBeDefined();
			expect(mockFileSystemService.readFile).not.toHaveBeenCalled();
			expect(lastProposedRequests()[0].oldContent).toBe('[Binary file: gone.png]');
		});

		it('should keep rejected files and only report the ones the user approved', async () => {
			['a.md', 'b.md'].forEach(path => vaultFiles.set(path, 'content'));
			reviewDecision = (_request, index) => index === 0 ? 'reject' : 'accept';

			const result = await perform(toolCall(AITool.DeleteVaultFiles, { file_paths: ['a.md', 'b.md'], confirm_deletion: true }, 'tool_19d'));

			expect((result.payload.response as any).results).toEqual([
				{ path: 'a.md', success: false, error: AIToolResponse.UserRejectionMessage },
				{ path: 'b.md', success: true }
			]);
			expect(vaultFiles.has('a.md')).toBe(true);
			expect(vaultFiles.has('b.md')).toBe(false);
			expect(result.payload.artifacts).toHaveLength(1);
			expect(result.payload.artifacts[0].filePath).toBe('b.md');
		});
	});

	describe('performAITool - DeleteVaultFolder', () => {
		beforeEach(() => {
			vaultFolders.add('folder');
			vaultFiles.set('folder/a.md', 'Content A');
			vaultFiles.set('folder/b.md', 'Content B');
		});

		it('should delete the files in the folder then the folder itself', async () => {
			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'folder', confirm_deletion: true }, 'tool_folder_1'));

			expect(lastProposedRequests().map(request => request.oldPath)).toEqual(['folder/a.md', 'folder/b.md']);
			expect(mockFileSystemService.deleteFolder).toHaveBeenCalledWith('folder');
			expect(result.payload.response).toEqual({
				results: [
					{ path: 'folder/a.md', success: true },
					{ path: 'folder/b.md', success: true }
				],
				folder: { path: 'folder', success: true }
			});
			expect(vaultFolders.has('folder')).toBe(false);
		});

		it('should produce artifacts for the deleted contents', async () => {
			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'folder', confirm_deletion: true }, 'tool_folder_1a'));

			expect(result.payload.artifacts).toHaveLength(2);
			expect(result.payload.artifacts.map((artifact: Artifact) => artifact.filePath)).toEqual(['folder/a.md', 'folder/b.md']);
			expect(result.payload.artifacts[0].originalContent).toBe('Content A');
			expect(result.payload.artifacts.every((artifact: Artifact) => artifact.action === ArtifactAction.Delete)).toBe(true);
		});

		it('should delete an empty folder without opening a review', async () => {
			vaultFolders.add('empty');

			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'empty', confirm_deletion: true }, 'tool_folder_1b'));

			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
			expect(mockFileSystemService.deleteFolder).toHaveBeenCalledWith('empty');
			expect((result.payload.response as any).folder).toEqual({ path: 'empty', success: true });
		});

		it('should take no action when confirmation is false', async () => {
			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'folder', confirm_deletion: false }, 'tool_folder_2'));

			expect(result.payload.response).toEqual({ results: [{ error: 'Confirmation was false, no action taken' }] });
			expect(mockFileSystemService.deleteFolder).not.toHaveBeenCalled();
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should keep the folder when the user rejects deleting one of its files', async () => {
			reviewDecision = (_request, index) => index === 0 ? 'reject' : 'accept';

			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'folder', confirm_deletion: true }, 'tool_folder_3'));

			expect(mockFileSystemService.deleteFolder).not.toHaveBeenCalled();
			expect((result.payload.response as any).folder.success).toBe(false);
			expect(vaultFiles.has('folder/a.md')).toBe(true);
			expect(vaultFiles.has('folder/b.md')).toBe(false);
		});

		it('should report a failure to delete the folder while still returning its artifacts', async () => {
			mockFileSystemService.deleteFolder.mockResolvedValue({ error: new Error('Permission denied') });

			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'folder', confirm_deletion: true }, 'tool_folder_4'));

			expect((result.payload.response as any).folder).toEqual({ path: 'folder', success: false, error: 'Permission denied' });
			expect(result.payload.artifacts).toHaveLength(2);
		});

		it('should fail when the folder does not exist', async () => {
			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'nope', confirm_deletion: true }, 'tool_folder_5'));

			expect((result.payload.response as any).results[0].error).toBe('Folder does not exist or is protected: nope');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should fail when the folder is protected', async () => {
			protectedPaths.add('folder');

			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'folder', confirm_deletion: true }, 'tool_folder_6'));

			expect((result.payload.response as any).results[0].error).toBe('Folder does not exist or is protected: folder');
			expect(mockFileSystemService.deleteFolder).not.toHaveBeenCalled();
		});

		it('should refuse when the folder contains protected files', async () => {
			protectedPaths.add('folder/secret.md');

			const result = await perform(toolCall(AITool.DeleteVaultFolder, { path: 'folder', confirm_deletion: true }, 'tool_folder_7'));

			expect((result.payload.response as any).results[0].error).toBe('Deletion failed. The folder or its contents may be protected: folder');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
			expect(vaultFiles.size).toBe(2);
		});

		it('should skip files that are already being deleted by another call in the same batch', async () => {
			const responses = await service.performAITool([
				toolCall(AITool.DeleteVaultFolder, { path: 'folder', confirm_deletion: true }, 'tool_folder_8a'),
				toolCall(AITool.DeleteVaultFiles, { file_paths: ['folder/a.md'], confirm_deletion: true }, 'tool_folder_8b')
			]);

			const requests = lastProposedRequests();
			expect(requests.map(request => request.oldPath).sort()).toEqual(['folder/a.md', 'folder/b.md']);
			expect(mockDiffService.proposeChanges).toHaveBeenCalledTimes(1);
			expect((responses[0].payload.response as any).results).toEqual([{ path: 'folder/b.md', success: true }]);
			expect((responses[1].payload.response as any).results).toEqual([{ path: 'folder/a.md', success: true }]);
			expect((responses[0].payload.response as any).folder).toEqual({ path: 'folder', success: true });
		});
	});

	describe('performAITool - MoveVaultFiles', () => {
		it('should move multiple files successfully', async () => {
			['a.md', 'b.md', 'c.md'].forEach(path => vaultFiles.set(path, `content ${path}`));

			const result = await perform(toolCall(AITool.MoveVaultFiles, {
				source_paths: ['a.md', 'b.md', 'c.md'],
				destination_paths: ['dest/a.md', 'dest/b.md', 'dest/c.md']
			}, 'tool_20'));

			expect(result.payload.response).toEqual({
				results: [
					{ path: 'dest/a.md', success: true },
					{ path: 'dest/b.md', success: true },
					{ path: 'dest/c.md', success: true }
				]
			});
			expect([...vaultFiles.keys()].sort()).toEqual(['dest/a.md', 'dest/b.md', 'dest/c.md']);
		});

		it('should propose a rename for each move', async () => {
			vaultFiles.set('a.md', 'content');

			await perform(toolCall(AITool.MoveVaultFiles, { source_paths: ['a.md'], destination_paths: ['dest/a.md'] }, 'tool_20a'));

			const [request] = lastProposedRequests();
			expect(request.changeType).toBe(FileEvent.Rename);
			expect(request.oldPath).toBe('a.md');
			expect(request.newPath).toBe('dest/a.md');
			expect(request.oldContent).toBe('content');
			expect(request.newContent).toBe('content');
		});

		it('should call moveFile with the correct parameters', async () => {
			vaultFiles.set('old/path.md', 'content');

			await perform(toolCall(AITool.MoveVaultFiles, { source_paths: ['old/path.md'], destination_paths: ['new/path.md'] }, 'tool_21'));

			expect(mockFileSystemService.moveFile).toHaveBeenCalledWith('old/path.md', 'new/path.md');
		});

		it('should produce a move artifact that records the previous path', async () => {
			vaultFiles.set('old/path.md', 'content');

			const result = await perform(toolCall(AITool.MoveVaultFiles, { source_paths: ['old/path.md'], destination_paths: ['new/path.md'] }, 'tool_21a'));

			expect(result.payload.artifacts).toHaveLength(1);
			const artifact = result.payload.artifacts[0];
			expect(artifact.action).toBe(ArtifactAction.Move);
			expect(artifact.filePath).toBe('new/path.md');
			expect(artifact.previousPath).toBe('old/path.md');
		});

		it('should reject when the array lengths do not match', async () => {
			const result = await perform(toolCall(AITool.MoveVaultFiles, { source_paths: ['a.md', 'b.md'], destination_paths: ['x.md'] }, 'tool_22'));

			expect((result.payload.response as any).results[0].error).toBe('Source paths array length does not equal destination paths array length');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should report moves that cannot be made alongside the ones that can', async () => {
			vaultFiles.set('good.md', 'content');
			vaultFiles.set('taken.md', 'content');
			vaultFiles.set('occupied.md', 'content');
			protectedPaths.add('Vaultkeeper AI/x.md');

			const result = await perform(toolCall(AITool.MoveVaultFiles, {
				source_paths: ['good.md', 'missing.md', 'taken.md', 'occupied.md'],
				destination_paths: ['moved/good.md', 'moved/missing.md', 'Vaultkeeper AI/x.md', 'good.md']
			}, 'tool_23'));

			expect((result.payload.response as any).results).toEqual([
				{ path: 'moved/missing.md', success: false, error: 'Move failed as source does not exist: missing.md' },
				{ path: 'Vaultkeeper AI/x.md', success: false, error: 'Operation failed. The destination path may be protected: Vaultkeeper AI/x.md' },
				{ path: 'good.md', success: false, error: 'Move failed as destination already exists: good.md' },
				{ path: 'moved/good.md', success: true }
			]);
		});

		it('should report a failure from the move itself', async () => {
			vaultFiles.set('a.md', 'content');
			mockFileSystemService.moveFile.mockResolvedValue({ error: new Error('Move failed') });

			const result = await perform(toolCall(AITool.MoveVaultFiles, { source_paths: ['a.md'], destination_paths: ['b.md'] }, 'tool_23a'));

			expect((result.payload.response as any).results).toEqual([{ path: 'b.md', success: false, error: 'Move failed' }]);
			expect(result.payload.artifacts).toEqual([]);
		});

		it('should not move files the user rejected', async () => {
			vaultFiles.set('a.md', 'content');
			reviewDecision = () => 'reject';

			const result = await perform(toolCall(AITool.MoveVaultFiles, { source_paths: ['a.md'], destination_paths: ['b.md'] }, 'tool_23b'));

			expect(vaultFiles.has('a.md')).toBe(true);
			expect(mockFileSystemService.moveFile).not.toHaveBeenCalled();
			expect((result.payload.response as any).results[0].error).toBe(AIToolResponse.UserRejectionMessage);
		});

		it('should handle empty arrays', async () => {
			const result = await perform(toolCall(AITool.MoveVaultFiles, { source_paths: [], destination_paths: [] }, 'tool_24'));

			expect(result.payload.response).toEqual({ results: [] });
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});
	});

	describe('performAITool - MoveVaultFolder', () => {
		beforeEach(() => {
			vaultFolders.add('source');
			vaultFiles.set('source/a.md', 'Content A');
			vaultFiles.set('source/nested/b.md', 'Content B');
		});

		it('should move every file, create the destination and remove the source folder', async () => {
			const result = await perform(toolCall(AITool.MoveVaultFolder, { source_path: 'source', destination_path: 'target' }, 'tool_mvfolder_1'));

			expect(lastProposedRequests().map(request => [request.oldPath, request.newPath])).toEqual([
				['source/a.md', 'target/a.md'],
				['source/nested/b.md', 'target/nested/b.md']
			]);
			expect(mockFileSystemService.createFolder).toHaveBeenCalledWith('target');
			expect(mockFileSystemService.deleteFolder).toHaveBeenCalledWith('source');
			expect(result.payload.response).toEqual({
				results: [
					{ path: 'target/a.md', success: true },
					{ path: 'target/nested/b.md', success: true }
				],
				folder: { path: 'target', success: true }
			});
			expect([...vaultFiles.keys()].sort()).toEqual(['target/a.md', 'target/nested/b.md']);
		});

		it('should recreate empty folders at the destination', async () => {
			mockFileSystemService.listFoldersInDirectory.mockResolvedValue([createMockFolder('source/empty')]);

			await perform(toolCall(AITool.MoveVaultFolder, { source_path: 'source', destination_path: 'target' }, 'tool_mvfolder_2'));

			expect(mockFileSystemService.createFolder).toHaveBeenCalledWith('target/empty');
		});

		it('should keep the source folder when the user rejects moving one of its files', async () => {
			reviewDecision = (_request, index) => index === 0 ? 'reject' : 'accept';

			const result = await perform(toolCall(AITool.MoveVaultFolder, { source_path: 'source', destination_path: 'target' }, 'tool_mvfolder_3'));

			expect(mockFileSystemService.deleteFolder).not.toHaveBeenCalled();
			expect((result.payload.response as any).folder).toEqual({
				path: 'source',
				success: false,
				error: 'Move failed. The folder or its contents may be protected: source'
			});
		});

		it('should report a failure to create the destination folder', async () => {
			mockFileSystemService.createFolder.mockResolvedValue(new Error('cannot create'));

			const result = await perform(toolCall(AITool.MoveVaultFolder, { source_path: 'source', destination_path: 'target' }, 'tool_mvfolder_4'));

			expect((result.payload.response as any).folder).toEqual({ path: 'target', success: false, error: 'cannot create' });
			expect(mockFileSystemService.deleteFolder).not.toHaveBeenCalled();
		});

		it.each([
			['the source does not exist', 'missing', 'target', 'Move failed as source folder does not exist: missing'],
			['the destination already exists', 'source', 'source/nested', 'Move failed as destination already exists: source/nested'],
			['the folder would move inside itself', 'source', 'source/inner', 'Move failed as a folder cannot be moved inside itself: source/inner'],
			['the vault root is moved', '/', 'target', 'Move failed as the vault root cannot be moved']
		])('should fail when %s', async (_description, sourcePath, destinationPath, expectedError) => {
			vaultFolders.add('source/nested');

			const result = await perform(toolCall(AITool.MoveVaultFolder, { source_path: sourcePath, destination_path: destinationPath }, 'tool_mvfolder_fail'));

			expect((result.payload.response as any).results[0].error).toBe(expectedError);
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should fail when the source or destination is protected', async () => {
			protectedPaths.add('target');

			const result = await perform(toolCall(AITool.MoveVaultFolder, { source_path: 'source', destination_path: 'target' }, 'tool_mvfolder_5'));

			expect((result.payload.response as any).results[0].error).toBe('Move failed. The folder or its contents may be protected: source');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});

		it('should fail when the source folder contains protected files', async () => {
			protectedPaths.add('source/secret.md');

			const result = await perform(toolCall(AITool.MoveVaultFolder, { source_path: 'source', destination_path: 'target' }, 'tool_mvfolder_6'));

			expect((result.payload.response as any).results[0].error).toBe('Move failed. The folder or its contents may be protected: source');
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
		});
	});

	describe('performAITool - batched tool calls', () => {
		it('should review every edit from one turn together in a single diff', async () => {
			vaultFiles.set('existing.md', 'old');
			vaultFiles.set('remove.md', 'bye');

			const responses = await service.performAITool([
				toolCall(AITool.WriteVaultFile, { file_path: 'created.md', content: 'new' }, 'batch_1'),
				toolCall(AITool.PatchVaultFile, { file_path: 'existing.md', edits: [{ old_content: 'old', new_content: 'patched' }] }, 'batch_2'),
				toolCall(AITool.DeleteVaultFiles, { file_paths: ['remove.md'], confirm_deletion: true }, 'batch_3')
			]);

			expect(mockDiffService.proposeChanges).toHaveBeenCalledTimes(1);
			expect(lastProposedRequests().map(request => request.changeType)).toEqual([FileEvent.Create, FileEvent.Modify, FileEvent.Delete]);
			expect(responses.map(response => response.toolId)).toEqual(['batch_1', 'batch_2', 'batch_3']);
			responses.forEach(response => expect((response.payload.response as any).results[0].success).toBe(true));
		});

		it('should respond to every call in the order they were made', async () => {
			vaultFiles.set('a.md', 'content');
			mockFileSystemService.readFilePath.mockResolvedValue({ content: 'read me', nextIndex: undefined });

			const responses = await service.performAITool([
				toolCall(AITool.WriteVaultFile, { file_path: 'a.md', content: 'changed' }, 'order_1'),
				toolCall(AITool.ReadVaultFiles, { files: [{ file_path: 'a.md' }] }, 'order_2'),
				toolCall(AITool.RequestWebSearch, {}, 'order_3')
			]);

			expect(responses.map(response => response.name)).toEqual([AITool.WriteVaultFile, AITool.ReadVaultFiles, AITool.RequestWebSearch]);
		});

		it('should run reads before the edits are reviewed', async () => {
			mockFileSystemService.readFilePath.mockResolvedValue({ content: 'before the edit', nextIndex: undefined });

			await service.performAITool([
				toolCall(AITool.WriteVaultFile, { file_path: 'a.md', content: 'x' }, 'reads_1'),
				toolCall(AITool.ReadVaultFiles, { files: [{ file_path: 'a.md' }] }, 'reads_2')
			]);

			expect(mockFileSystemService.readFilePath.mock.invocationCallOrder[0])
				.toBeLessThan(mockDiffService.proposeChanges.mock.invocationCallOrder[0]);
		});

		it('should still respond to calls that fail validation while reviewing the valid ones', async () => {
			const responses = await service.performAITool([
				toolCall(AITool.WriteVaultFile, { file_path: 'bad.md' }, 'valid_1'),
				toolCall(AITool.WriteVaultFile, { file_path: 'good.md', content: 'x' }, 'valid_2')
			]);

			expect((responses[0].payload.response as any).error).toContain('Invalid arguments');
			expect((responses[1].payload.response as any).results[0].success).toBe(true);
			expect(lastProposedRequests()).toHaveLength(1);
		});

		it('should attach the continuity report to only the first response', async () => {
			mockDiffService.proposeChanges.mockImplementation(async (requests: IVaultChangeRequest<TFile>[]) => ({
				results: await Promise.all(requests.map(request => request.changeAction())),
				report: { toString: () => 'Broken link in a.md' }
			}));

			const responses = await service.performAITool([
				toolCall(AITool.WriteVaultFile, { file_path: 'a.md', content: 'x' }, 'report_1'),
				toolCall(AITool.WriteVaultFile, { file_path: 'b.md', content: 'y' }, 'report_2')
			]);

			expect((responses[0].payload.response as any).unresolvedContinuityIssues).toBe(`${Copy.ContinuityReportPreamble}\nBroken link in a.md`);
			expect((responses[1].payload.response as any)).not.toHaveProperty('unresolvedContinuityIssues');
		});

		it('should omit the continuity report when it has no issues', async () => {
			mockDiffService.proposeChanges.mockImplementation(async (requests: IVaultChangeRequest<TFile>[]) => ({
				results: await Promise.all(requests.map(request => request.changeAction())),
				report: { toString: () => '\n' }
			}));

			const responses = await service.performAITool([
				toolCall(AITool.WriteVaultFile, { file_path: 'a.md', content: 'x' }, 'report_1')
			]);

			expect((responses[0].payload.response as any)).not.toHaveProperty('unresolvedContinuityIssues');
		});

		it('should refuse edits when the chat mode does not allow them', async () => {
			mockSettings.settings.chatMode = ChatMode.ReadOnly;

			const responses = await service.performAITool([
				toolCall(AITool.WriteVaultFile, { file_path: 'a.md', content: 'x' }, 'mode_1'),
				toolCall(AITool.RequestWebSearch, {}, 'mode_2')
			]);

			expect((responses[0].payload.response as any).error).toBe('Invalid tool call: write_vault_file. The user has not allowed edits to be made.');
			expect(responses[1].payload.response).toEqual({});
			expect(mockDiffService.proposeChanges).not.toHaveBeenCalled();
			expect(vaultFiles.size).toBe(0);
		});

		it('should allow edits in planning mode', async () => {
			mockSettings.settings.chatMode = ChatMode.Planning;

			const result = await perform(toolCall(AITool.WriteVaultFile, { file_path: 'a.md', content: 'x' }, 'mode_3'));

			expect((result.payload.response as any).results[0].success).toBe(true);
		});

		it('should reject and write nothing when the operation is aborted during review', async () => {
			mockDiffService.proposeChanges.mockImplementation(() => new Promise(() => {}));

			const pending = service.performAITool([toolCall(AITool.WriteVaultFile, { file_path: 'a.md', content: 'x' }, 'abort_1')]);
			await vi.waitFor(() => expect(mockDiffService.proposeChanges).toHaveBeenCalled());
			abortService.abort();

			await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
			expect(vaultFiles.size).toBe(0);
		});

		it('should not apply accepted changes once the operation has been aborted', async () => {
			mockDiffService.proposeChanges.mockImplementation(async (requests: IVaultChangeRequest<TFile>[]) => {
				abortService.abort();
				return { results: [await requests[0].changeAction()] };
			});

			await expect(service.performAITool([toolCall(AITool.WriteVaultFile, { file_path: 'a.md', content: 'x' }, 'abort_2')]))
				.rejects.toMatchObject({ name: 'AbortError' });

			expect(mockFileSystemService.writeToFilePath).not.toHaveBeenCalled();
		});

		it('should surface what the tool is doing through thought updates and clear it afterwards', async () => {
			mockFileSystemService.readFilePath.mockResolvedValue({ content: '', nextIndex: undefined });

			await perform(toolCall(AITool.ReadVaultFiles, { files: [{ file_path: 'notes/a.md' }] }, 'thought_1'));

			expect(mockEventService.trigger).toHaveBeenCalledWith(Event.ThoughtUpdate, expect.stringContaining('a.md'));
			expect(mockEventService.trigger).toHaveBeenLastCalledWith(Event.ThoughtUpdate);
		});
	});

	describe('performAITool - RequestWebSearch', () => {
		it('should return empty object for Gemini web search', async () => {
			const result = await perform({
				name: AITool.RequestWebSearch,
				arguments: {},
				toolId: 'tool_25'
			} as any);

			expect(result.name).toBe(AITool.RequestWebSearch);
			expect(result.payload.response).toEqual({});
			expect(result.toolId).toBe('tool_25');
		});

		it('should handle web search without arguments', async () => {
			const result = await perform({
				name: AITool.RequestWebSearch,
				arguments: {},
				toolId: 'tool_26'
			} as any);

			expect(result.payload.response).toEqual({});
		});
	});

	describe('performAITool - Unknown Function', () => {
		it('should return unknown response for unknown function', async () => {
			const result = await perform({
				name: 'UnknownFunction' as any,
				arguments: {},
				toolId: 'tool_27'
			} as any);
			expect(result.name).toBe('unknown');
			expect(result.toolId).toBe('tool_27');
			expect(result.payload.response).toEqual({ error: 'Unknown function request unknown' });
		});

		it('should return unknown response for invalid function', async () => {
			const result = await perform({
				name: 'InvalidFunction' as any,
				arguments: {},
				toolId: 'tool_error'
			} as any);
			expect(result.name).toBe('unknown');
			expect(result.toolId).toBe('tool_error');
			expect(result.payload.response).toEqual({ error: 'Unknown function request unknown' });
		});
	});
});

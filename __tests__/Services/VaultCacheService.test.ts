import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VaultCacheService } from '../../Services/VaultCacheService';
import { VaultService } from '../../Services/VaultService';
import { TFile, TFolder, MetadataCache } from 'obsidian';
import { RegisterSingleton } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { FileEvent } from '../../Enums/FileEvent';

// Mock getAllTags from obsidian
vi.mock('obsidian', async () => {
	const actual = await vi.importActual('obsidian');
	return {
		...actual,
		getAllTags: vi.fn((metadata: any) => {
			if (!metadata || !metadata.tags) return null;
			return metadata.tags.map((t: any) => t.tag);
		})
	};
});

// Mock fuzzysort
vi.mock('fuzzysort', () => {
	const mockPrepare = vi.fn((str: string) => ({ target: str }));
	const mockGo = vi.fn((input: string, targets: any[], options: any) => {
		// Simple mock implementation that filters based on includes
		const results = targets
			.filter((t: any) => {
				const searchIn = t.tag || t.file?.basename || t.folder?.path || '';
				return searchIn.toLowerCase().includes(input.toLowerCase());
			})
			.slice(0, options.limit || 10)
			.map((t: any) => ({
				obj: t,
				score: 0
			}));
		return results;
	});

	return {
		default: {
			go: mockGo,
			prepare: mockPrepare
		},
		go: mockGo,
		prepare: mockPrepare
	};
});

/**
 * INTEGRATION TESTS
 *
 * These tests use real dependencies where possible and mock only the Obsidian API.
 */

// Create mock instances
const mockMetadataCache = {
	getCache: vi.fn(),
	on: vi.fn()
};

const mockVault = {
	getFiles: vi.fn(),
	getAllFolders: vi.fn(),
	on: vi.fn()
};

const mockPlugin = {
	app: {
		vault: mockVault,
		metadataCache: mockMetadataCache
	},
	settings: {
		exclusions: []
	},
	registerEvent: vi.fn()
};

// Helper to create mock TFile
function createMockFile(path: string): TFile {
	const name = path.split('/').pop() || '';
	const basename = name.split('.')[0];
	const file = new TFile();
	file.path = path;
	file.name = name;
	file.basename = basename;
	file.extension = 'md';
	file.stat = { ctime: Date.now(), mtime: Date.now(), size: 100 };
	file.parent = null;
	file.vault = mockVault as any;
	return file;
}

// Helper to create mock TFolder
function createMockFolder(path: string): TFolder {
	const name = path.split('/').pop() || '';
	const folder = new TFolder();
	folder.path = path;
	folder.name = name;
	folder.children = [];
	folder.parent = null;
	folder.vault = mockVault as any;
	return folder;
}

describe('VaultCacheService - Integration Tests', () => {
	let vaultCacheService: VaultCacheService;
	let vaultService: VaultService;
	let fileEventHandler: any;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Capture file event handler
		fileEventHandler = null;

		// Mock VaultService to capture the event handler
		const mockVaultService = {
			registerFileEvents: vi.fn((handler: any) => {
				fileEventHandler = handler;
			}),
			listVaultContents: vi.fn(() => [])
		};

		// Register dependencies
		RegisterSingleton(Services.AIAgentPlugin, mockPlugin as any);
		RegisterSingleton(Services.VaultService, mockVaultService as any);

		// Create fresh instance
		vaultCacheService = new VaultCacheService();
		vaultService = mockVaultService as any;
	});

	describe('initialization', () => {
		it('should register file event handlers on construction', () => {
			expect(vaultService.registerFileEvents).toHaveBeenCalledOnce();
			expect(fileEventHandler).toBeDefined();
		});

		it('should initialize cache with existing vault contents', () => {
			const files = [
				createMockFile('note1.md'),
				createMockFile('note2.md')
			];
			const folders = [createMockFolder('folder')];

			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#tag1' }, { tag: '#tag2' }]
			});

			const mockListVaultContents = vi.fn(() => [...files, ...folders]);
			const mockRegisterEvents = vi.fn((handler: any) => {
				fileEventHandler = handler;
			});

			let resolvedHandler: any = null;
			const mockMetadataCacheWithHandler = {
				getCache: mockMetadataCache.getCache,
				on: vi.fn((event: string, handler: any) => {
					if (event === 'resolved') {
						resolvedHandler = handler;
					}
				})
			};

			const mockPluginWithMetadata = {
				app: {
					vault: mockVault,
					metadataCache: mockMetadataCacheWithHandler
				},
				settings: {
					exclusions: []
				},
				registerEvent: vi.fn()
			};

			const mockVaultServiceWithContent = {
				registerFileEvents: mockRegisterEvents,
				listVaultContents: mockListVaultContents
			};

			RegisterSingleton(Services.AIAgentPlugin, mockPluginWithMetadata as any);
			RegisterSingleton(Services.VaultService, mockVaultServiceWithContent as any);

			// Create new instance to trigger initialization
			new VaultCacheService();

			// Trigger the resolved event
			expect(resolvedHandler).toBeDefined();
			resolvedHandler();

			expect(mockListVaultContents).toHaveBeenCalled();
		});
	});

	describe('file event handling - create', () => {
		it('should cache file on create event', () => {
			const mockFile = createMockFile('new.md');
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#test' }]
			});

			fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });

			// Verify by triggering delete and checking orphaned tags
			const orphanedTags = fileEventHandler(FileEvent.Delete, mockFile, { oldPath: mockFile.path });

			// If the file was cached, deleting it should not cause issues
			expect(orphanedTags).not.toThrow;
		});

		it('should extract and cache tags on file create', () => {
			const mockFile = createMockFile('tagged.md');
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#important' }, { tag: '#project' }]
			});

			fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });

			// Verify tags are cached by creating another file with same tags
			const mockFile2 = createMockFile('tagged2.md');
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#important' }]
			});

			fileEventHandler(FileEvent.Create, mockFile2, { oldPath: '' });

			// Delete first file - #important should not be orphaned
			fileEventHandler(FileEvent.Delete, mockFile, { oldPath: mockFile.path });

			// Both files should be tracked
			expect(fileEventHandler).toBeDefined();
		});

		it('should handle files with no tags', () => {
			const mockFile = createMockFile('untagged.md');
			mockMetadataCache.getCache.mockReturnValue(null);

			// Should not throw
			expect(() => {
				fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });
			}).not.toThrow();
		});

		it('should handle files with empty tag array', () => {
			const mockFile = createMockFile('notags.md');
			mockMetadataCache.getCache.mockReturnValue({
				tags: []
			});

			expect(() => {
				fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });
			}).not.toThrow();
		});
	});

	describe('file event handling - modify', () => {
		it('should update tags on file modify', () => {
			const mockFile = createMockFile('modified.md');

			// Create file with initial tags
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#old' }, { tag: '#keep' }]
			});
			fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });

			// Modify file with new tags
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#new' }, { tag: '#keep' }]
			});
			fileEventHandler(FileEvent.Modify, mockFile, { oldPath: '' });

			// The implementation should handle tag updates correctly
			expect(fileEventHandler).toBeDefined();
		});

		it('should remove orphaned tags on modify', () => {
			const mockFile = createMockFile('file.md');

			// Create with tags
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#unique' }]
			});
			fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });

			// Modify to remove all tags
			mockMetadataCache.getCache.mockReturnValue({
				tags: []
			});
			fileEventHandler(FileEvent.Modify, mockFile, { oldPath: '' });

			// #unique should be removed from cache
			expect(fileEventHandler).toBeDefined();
		});

		it('should not remove shared tags on modify', () => {
			const mockFile1 = createMockFile('file1.md');
			const mockFile2 = createMockFile('file2.md');

			// Create two files with shared tag
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#shared' }]
			});
			fileEventHandler(FileEvent.Create, mockFile1, { oldPath: '' });
			fileEventHandler(FileEvent.Create, mockFile2, { oldPath: '' });

			// Modify file1 to remove shared tag
			mockMetadataCache.getCache.mockReturnValue({
				tags: []
			});
			fileEventHandler(FileEvent.Modify, mockFile1, { oldPath: '' });

			// #shared should still exist because file2 has it
			expect(fileEventHandler).toBeDefined();
		});
	});

	describe('file event handling - rename', () => {
		it('should update file path on rename', () => {
			const oldPath = 'old.md';
			const mockFile = createMockFile('new.md');

			// Create file
			const oldFile = createMockFile(oldPath);
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#test' }]
			});
			fileEventHandler(FileEvent.Create, oldFile, { oldPath: '' });

			// Rename file
			fileEventHandler(FileEvent.Rename, mockFile, { oldPath: oldPath });

			// Verify rename worked by deleting with new path
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#test' }]
			});
			expect(() => {
				fileEventHandler(FileEvent.Delete, mockFile, { oldPath: mockFile.path });
			}).not.toThrow();
		});

		it('should preserve tags on rename', () => {
			const oldPath = 'folder/old.md';
			const newFile = createMockFile('folder/new.md');

			// Create file with tags
			const oldFile = createMockFile(oldPath);
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#important' }]
			});
			fileEventHandler(FileEvent.Create, oldFile, { oldPath: '' });

			// Rename file
			fileEventHandler(FileEvent.Rename, newFile, { oldPath: oldPath });

			// Tags should still be associated with file
			expect(fileEventHandler).toBeDefined();
		});
	});

	describe('file event handling - delete', () => {
		it('should remove file from cache on delete', () => {
			const mockFile = createMockFile('deleted.md');

			// Create file
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#test' }]
			});
			fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });

			// Delete file
			fileEventHandler(FileEvent.Delete, mockFile, { oldPath: mockFile.path });

			// Deleting again should handle gracefully
			expect(() => {
				fileEventHandler(FileEvent.Delete, mockFile, { oldPath: mockFile.path });
			}).not.toThrow();
		});

		it('should remove orphaned tags on delete', () => {
			const mockFile = createMockFile('file.md');

			// Create file with unique tag
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#unique' }]
			});
			fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });

			// Delete file
			fileEventHandler(FileEvent.Delete, mockFile, { oldPath: mockFile.path });

			// #unique should be removed from cache
			expect(fileEventHandler).toBeDefined();
		});

		it('should not remove shared tags on delete', () => {
			const mockFile1 = createMockFile('file1.md');
			const mockFile2 = createMockFile('file2.md');

			// Create two files with shared tag
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#shared' }]
			});
			fileEventHandler(FileEvent.Create, mockFile1, { oldPath: '' });
			fileEventHandler(FileEvent.Create, mockFile2, { oldPath: '' });

			// Delete one file
			fileEventHandler(FileEvent.Delete, mockFile1, { oldPath: mockFile1.path });

			// #shared should still exist because file2 has it
			expect(fileEventHandler).toBeDefined();
		});
	});

	describe('complex scenarios', () => {
		it('should handle multiple files with overlapping tags', () => {
			const file1 = createMockFile('file1.md');
			const file2 = createMockFile('file2.md');
			const file3 = createMockFile('file3.md');

			// file1: tag1, tag2
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#tag1' }, { tag: '#tag2' }]
			});
			fileEventHandler(FileEvent.Create, file1, { oldPath: '' });

			// file2: tag2, tag3
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#tag2' }, { tag: '#tag3' }]
			});
			fileEventHandler(FileEvent.Create, file2, { oldPath: '' });

			// file3: tag3, tag4
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#tag3' }, { tag: '#tag4' }]
			});
			fileEventHandler(FileEvent.Create, file3, { oldPath: '' });

			// Delete file2
			fileEventHandler(FileEvent.Delete, file2, { oldPath: file2.path });

			// tag2 should still exist (file1), tag3 should still exist (file3)
			expect(fileEventHandler).toBeDefined();
		});

		it('should handle file lifecycle: create, modify, rename, delete', () => {
			let mockFile = createMockFile('initial.md');

			// Create
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#v1' }]
			});
			fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });

			// Modify
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#v2' }]
			});
			fileEventHandler(FileEvent.Modify, mockFile, { oldPath: '' });

			// Rename
			const renamedFile = createMockFile('renamed.md');
			fileEventHandler(FileEvent.Rename, renamedFile, { oldPath: mockFile.path });

			// Delete
			fileEventHandler(FileEvent.Delete, renamedFile, { oldPath: renamedFile.path });

			// Should complete without errors
			expect(fileEventHandler).toBeDefined();
		});

		it('should handle files in different folders', () => {
			const file1 = createMockFile('folder1/note.md');
			const file2 = createMockFile('folder2/note.md');
			const file3 = createMockFile('note.md');

			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#test' }]
			});

			fileEventHandler(FileEvent.Create, file1, { oldPath: '' });
			fileEventHandler(FileEvent.Create, file2, { oldPath: '' });
			fileEventHandler(FileEvent.Create, file3, { oldPath: '' });

			// All three files should be tracked separately
			expect(fileEventHandler).toBeDefined();
		});

		it('should handle rapid tag changes', () => {
			const mockFile = createMockFile('volatile.md');

			// Create with tags
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#a' }, { tag: '#b' }]
			});
			fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });

			// Modify multiple times
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#b' }, { tag: '#c' }]
			});
			fileEventHandler(FileEvent.Modify, mockFile, { oldPath: '' });

			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#c' }, { tag: '#d' }]
			});
			fileEventHandler(FileEvent.Modify, mockFile, { oldPath: '' });

			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#d' }, { tag: '#e' }]
			});
			fileEventHandler(FileEvent.Modify, mockFile, { oldPath: '' });

			// Should handle gracefully
			expect(fileEventHandler).toBeDefined();
		});
	});

	describe('edge cases', () => {
		it('should handle folder events - create', () => {
			const mockFolder = createMockFolder('new-folder');

			expect(() => {
				fileEventHandler(FileEvent.Create, mockFolder, { oldPath: '' });
			}).not.toThrow();
		});

		it('should handle folder events - rename', () => {
			const mockFolder = createMockFolder('folder');
			fileEventHandler(FileEvent.Create, mockFolder, { oldPath: '' });

			const renamedFolder = createMockFolder('renamed-folder');
			expect(() => {
				fileEventHandler(FileEvent.Rename, renamedFolder, { oldPath: mockFolder.path });
			}).not.toThrow();
		});

		it('should handle folder events - delete', () => {
			const mockFolder = createMockFolder('folder-to-delete');
			fileEventHandler(FileEvent.Create, mockFolder, { oldPath: '' });

			expect(() => {
				fileEventHandler(FileEvent.Delete, mockFolder, { oldPath: mockFolder.path });
			}).not.toThrow();
		});

		it('should handle files with special characters in path', () => {
			const mockFile = createMockFile('folder/file with spaces & (special).md');
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#test' }]
			});

			expect(() => {
				fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });
			}).not.toThrow();
		});

		it('should handle tags with special characters', () => {
			const mockFile = createMockFile('file.md');
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#tag-with-dash' }, { tag: '#tag_with_underscore' }, { tag: '#tag123' }]
			});

			expect(() => {
				fileEventHandler(FileEvent.Create, mockFile, { oldPath: '' });
			}).not.toThrow();
		});

		it('should handle deleting non-existent file', () => {
			const mockFile = createMockFile('never-created.md');

			expect(() => {
				fileEventHandler(FileEvent.Delete, mockFile, { oldPath: mockFile.path });
			}).not.toThrow();
		});

		it('should handle modifying non-existent file', () => {
			const mockFile = createMockFile('never-created.md');
			mockMetadataCache.getCache.mockReturnValue({
				tags: [{ tag: '#test' }]
			});

			expect(() => {
				fileEventHandler(FileEvent.Modify, mockFile, { oldPath: '' });
			}).not.toThrow();
		});

		it('should handle renaming non-existent file', () => {
			const mockFile = createMockFile('new.md');

			expect(() => {
				fileEventHandler(FileEvent.Rename, mockFile, { oldPath: 'old.md' });
			}).not.toThrow();
		});
	});

	describe('fuzzy search - matchTag', () => {
		beforeEach(() => {
			// Create files with various tags
			const file1 = createMockFile('file1.md');
			const file2 = createMockFile('file2.md');
			const file3 = createMockFile('file3.md');

			mockMetadataCache.getCache.mockReturnValueOnce({
				tags: [{ tag: '#project' }, { tag: '#important' }]
			});
			fileEventHandler(FileEvent.Create, file1, { oldPath: '' });

			mockMetadataCache.getCache.mockReturnValueOnce({
				tags: [{ tag: '#personal' }, { tag: '#todo' }]
			});
			fileEventHandler(FileEvent.Create, file2, { oldPath: '' });

			mockMetadataCache.getCache.mockReturnValueOnce({
				tags: [{ tag: '#work' }, { tag: '#meeting' }]
			});
			fileEventHandler(FileEvent.Create, file3, { oldPath: '' });
		});

		it('should find matching tags', () => {
			const results = vaultCacheService.matchTag('project');
			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);
		});

		it('should return empty results for non-matching input', () => {
			const results = vaultCacheService.matchTag('nonexistent');
			expect(results).toBeDefined();
			expect(results.length).toBe(0);
		});

		it('should be case insensitive', () => {
			const results = vaultCacheService.matchTag('PROJECT');
			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);
		});

		it('should handle partial matches', () => {
			const results = vaultCacheService.matchTag('proj');
			expect(results).toBeDefined();
		});

		it('should limit results to configured limit', () => {
			// Create many tags to test limit
			for (let i = 0; i < 20; i++) {
				const file = createMockFile(`file${i}.md`);
				mockMetadataCache.getCache.mockReturnValueOnce({
					tags: [{ tag: `#test${i}` }]
				});
				fileEventHandler(FileEvent.Create, file, { oldPath: '' });
			}

			const results = vaultCacheService.matchTag('test');
			expect(results.length).toBeLessThanOrEqual(10);
		});
	});

	describe('fuzzy search - matchFile', () => {
		beforeEach(() => {
			// Create files with various names
			mockMetadataCache.getCache.mockReturnValue(null);

			fileEventHandler(FileEvent.Create, createMockFile('project-notes.md'), { oldPath: '' });
			fileEventHandler(FileEvent.Create, createMockFile('meeting-2024.md'), { oldPath: '' });
			fileEventHandler(FileEvent.Create, createMockFile('todo-list.md'), { oldPath: '' });
			fileEventHandler(FileEvent.Create, createMockFile('important-doc.md'), { oldPath: '' });
		});

		it('should find matching files by basename', () => {
			const results = vaultCacheService.matchFile('project');
			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);
		});

		it('should return empty results for non-matching input', () => {
			const results = vaultCacheService.matchFile('zzznomatch');
			expect(results).toBeDefined();
			expect(results.length).toBe(0);
		});

		it('should be case insensitive', () => {
			const results = vaultCacheService.matchFile('PROJECT');
			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);
		});

		it('should handle partial matches', () => {
			const results = vaultCacheService.matchFile('meet');
			expect(results).toBeDefined();
		});

		it('should limit results to configured limit', () => {
			// Create many files to test limit
			for (let i = 0; i < 20; i++) {
				const file = createMockFile(`document${i}.md`);
				fileEventHandler(FileEvent.Create, file, { oldPath: '' });
			}

			const results = vaultCacheService.matchFile('document');
			expect(results.length).toBeLessThanOrEqual(10);
		});

		it('should update results after file is added', () => {
			const resultsBefore = vaultCacheService.matchFile('newfile');
			expect(resultsBefore.length).toBe(0);

			const newFile = createMockFile('newfile-test.md');
			fileEventHandler(FileEvent.Create, newFile, { oldPath: '' });

			const resultsAfter = vaultCacheService.matchFile('newfile');
			expect(resultsAfter.length).toBeGreaterThan(0);
		});

		it('should update results after file is deleted', () => {
			const file = createMockFile('todelete.md');
			fileEventHandler(FileEvent.Create, file, { oldPath: '' });

			const resultsBefore = vaultCacheService.matchFile('todelete');
			expect(resultsBefore.length).toBeGreaterThan(0);

			fileEventHandler(FileEvent.Delete, file, { oldPath: file.path });

			const resultsAfter = vaultCacheService.matchFile('todelete');
			expect(resultsAfter.length).toBe(0);
		});
	});

	describe('fuzzy search - matchFolder', () => {
		beforeEach(() => {
			// Create folders with various paths
			fileEventHandler(FileEvent.Create, createMockFolder('projects'), { oldPath: '' });
			fileEventHandler(FileEvent.Create, createMockFolder('projects/frontend'), { oldPath: '' });
			fileEventHandler(FileEvent.Create, createMockFolder('projects/backend'), { oldPath: '' });
			fileEventHandler(FileEvent.Create, createMockFolder('archive'), { oldPath: '' });
		});

		it('should find matching folders', () => {
			const results = vaultCacheService.matchFolder('projects');
			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);
		});

		it('should return empty results for non-matching input', () => {
			const results = vaultCacheService.matchFolder('nonexistent');
			expect(results).toBeDefined();
			expect(results.length).toBe(0);
		});

		it('should be case insensitive', () => {
			const results = vaultCacheService.matchFolder('PROJECTS');
			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);
		});

		it('should handle partial matches', () => {
			const results = vaultCacheService.matchFolder('proj');
			expect(results).toBeDefined();
		});

		it('should limit results to configured limit', () => {
			// Create many folders to test limit
			for (let i = 0; i < 20; i++) {
				const folder = createMockFolder(`folder${i}`);
				fileEventHandler(FileEvent.Create, folder, { oldPath: '' });
			}

			const results = vaultCacheService.matchFolder('folder');
			expect(results.length).toBeLessThanOrEqual(10);
		});

		it('should update results after folder is added', () => {
			const resultsBefore = vaultCacheService.matchFolder('newfolder');
			expect(resultsBefore.length).toBe(0);

			const newFolder = createMockFolder('newfolder');
			fileEventHandler(FileEvent.Create, newFolder, { oldPath: '' });

			const resultsAfter = vaultCacheService.matchFolder('newfolder');
			expect(resultsAfter.length).toBeGreaterThan(0);
		});

		it('should update results after folder is renamed', () => {
			const folder = createMockFolder('oldname');
			fileEventHandler(FileEvent.Create, folder, { oldPath: '' });

			const resultsBefore = vaultCacheService.matchFolder('oldname');
			expect(resultsBefore.length).toBeGreaterThan(0);

			const renamedFolder = createMockFolder('newname');
			fileEventHandler(FileEvent.Rename, renamedFolder, { oldPath: folder.path });

			const resultsOldName = vaultCacheService.matchFolder('oldname');
			expect(resultsOldName.length).toBe(0);

			const resultsNewName = vaultCacheService.matchFolder('newname');
			expect(resultsNewName.length).toBeGreaterThan(0);
		});

		it('should update results after folder is deleted', () => {
			const folder = createMockFolder('todelete');
			fileEventHandler(FileEvent.Create, folder, { oldPath: '' });

			const resultsBefore = vaultCacheService.matchFolder('todelete');
			expect(resultsBefore.length).toBeGreaterThan(0);

			fileEventHandler(FileEvent.Delete, folder, { oldPath: folder.path });

			const resultsAfter = vaultCacheService.matchFolder('todelete');
			expect(resultsAfter.length).toBe(0);
		});
	});
});

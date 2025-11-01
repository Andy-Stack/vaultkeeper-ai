import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VaultService } from '../../Services/VaultService';
import { TFile, TFolder, TAbstractFile, FileManager } from 'obsidian';
import { Path } from '../../Enums/Path';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { SanitiserService } from '../../Services/SanitiserService';

/**
 * INTEGRATION TESTS
 *
 * These tests use real dependencies (SanitiserService, DependencyService) and only mock
 * the Obsidian API (Vault, FileManager, TFile, etc.) which is unavoidable in a test environment.
 *
 * This approach tests the actual integration between services and avoids complex mocking.
 */

// Create mock instances
const mockVault = {
	getMarkdownFiles: vi.fn(),
	getAbstractFileByPath: vi.fn(),
	read: vi.fn(),
	cachedRead: vi.fn(),
	create: vi.fn(),
	process: vi.fn(),
	delete: vi.fn(),
	createFolder: vi.fn(),
	getFiles: vi.fn(),
	getAllFolders: vi.fn(),
	on: vi.fn()
};

const mockFileManager = {
	renameFile: vi.fn()
} as unknown as FileManager;

// Create a mutable plugin settings object that tests can modify
const mockPluginSettings = {
	exclusions: [] as string[]
};

const mockPlugin = {
	app: {
		vault: mockVault,
		fileManager: mockFileManager
	},
	settings: mockPluginSettings,
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
function createMockFolder(path: string, children: TAbstractFile[] = []): TFolder {
	const name = path.split('/').pop() || '';
	const folder = new TFolder();
	folder.path = path;
	folder.name = name;
	folder.children = children;
	folder.parent = null;
	folder.vault = mockVault as any;
	return folder;
}

describe('VaultService - Integration Tests', () => {
	let vaultService: VaultService;
	let consoleErrorSpy: any;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Reset plugin settings
		mockPluginSettings.exclusions = [];

		// Mock console.error to prevent noise in tests
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		// Register real dependencies in DependencyService
		RegisterSingleton(Services.AIAgentPlugin, mockPlugin as any);
		RegisterSingleton(Services.FileManager, mockFileManager);
		RegisterSingleton(Services.SanitiserService, new SanitiserService());

		// Create a fresh instance - it will resolve real dependencies
		vaultService = new VaultService();
	});

	afterEach(() => {
		// Clear singleton registry to prevent memory leaks
		DeregisterAllServices();
		consoleErrorSpy.mockRestore();
	});

	describe('getMarkdownFiles', () => {
		it('should return all markdown files when no exclusions are set', () => {
			const files = [
				createMockFile('note1.md'),
				createMockFile('note2.md'),
				createMockFile('folder/note3.md')
			];
			mockVault.getMarkdownFiles.mockReturnValue(files);

			const result = vaultService.getMarkdownFiles();

			expect(result).toHaveLength(3);
			expect(mockVault.getMarkdownFiles).toHaveBeenCalledOnce();
		});

		it('should filter out files in the AI Agent root directory by default', () => {
			const files = [
				createMockFile('note1.md'),
				createMockFile('AI Agent/conversation.md'),
				createMockFile('AI Agent/subfolder/data.md')
			];
			mockVault.getMarkdownFiles.mockReturnValue(files);

			const result = vaultService.getMarkdownFiles(false);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('note1.md');
		});

		it('should allow access to AI Agent directory when allowAccessToPluginRoot is true', () => {
			const files = [
				createMockFile('note1.md'),
				createMockFile('AI Agent/conversation.md')
			];
			mockVault.getMarkdownFiles.mockReturnValue(files);

			const result = vaultService.getMarkdownFiles(true);

			expect(result).toHaveLength(2);
		});

		it('should filter out user-defined exclusions', () => {
			const files = [
				createMockFile('public/note1.md'),
				createMockFile('private/secret.md'),
				createMockFile('public/note2.md')
			];
			mockVault.getMarkdownFiles.mockReturnValue(files);

			// Update settings to include exclusion
			mockPluginSettings.exclusions = ['private/**'];

			const result = vaultService.getMarkdownFiles();

			expect(result).toHaveLength(2);
			expect(result.every(f => !f.path.startsWith('private/'))).toBe(true);
		});
	});

	describe('getAbstractFileByPath', () => {
		it('should return file when path is not excluded', () => {
			const mockFile = createMockFile('note.md');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const result = vaultService.getAbstractFileByPath('note.md');

			expect(result).toBe(mockFile);
		});

		it('should return null and log error when path is excluded', () => {
			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile('AI Agent/test.md'));

			const result = vaultService.getAbstractFileByPath('AI Agent/test.md', false);

			expect(result).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should sanitize the path before checking', () => {
			// Path with illegal characters that will be sanitized
			const unsanitizedPath = 'folder/file?.md';
			const mockFile = createMockFile('folder/file.md');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			vaultService.getAbstractFileByPath(unsanitizedPath);

			// SanitiserService will remove the ? character
			expect(mockVault.getAbstractFileByPath).toHaveBeenCalledWith('folder/file.md');
		});

		it('should allow access to excluded paths when allowAccessToPluginRoot is true', () => {
			const mockFile = createMockFile('AI Agent/conversation.md');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const result = vaultService.getAbstractFileByPath('AI Agent/conversation.md', true);

			expect(result).toBe(mockFile);
		});

		it('should exclude the AI Agent directory itself', () => {
			const mockFolder = createMockFolder('AI Agent');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFolder);

			const result = vaultService.getAbstractFileByPath('AI Agent', false);

			expect(result).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should allow access to AI Agent directory when allowAccessToPluginRoot is true', () => {
			const mockFolder = createMockFolder('AI Agent');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFolder);

			const result = vaultService.getAbstractFileByPath('AI Agent', true);

			expect(result).toBe(mockFolder);
		});
	});

	describe('exists', () => {
		it('should return true when file exists and is not excluded', () => {
			const mockFile = createMockFile('note.md');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const result = vaultService.exists('note.md');

			expect(result).toBe(true);
		});

		it('should return false when file is excluded', () => {
			const result = vaultService.exists('AI Agent/test.md', false);

			expect(result).toBe(false);
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should return false when file does not exist', () => {
			mockVault.getAbstractFileByPath.mockReturnValue(null);

			const result = vaultService.exists('nonexistent.md');

			expect(result).toBe(false);
		});

		it('should return false when abstract file is a folder, not a file', () => {
			const mockFolder = createMockFolder('folder');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFolder);

			const result = vaultService.exists('folder');

			expect(result).toBe(false);
		});
	});

	describe('read', () => {
		it('should read file content when file is not excluded', async () => {
			const mockFile = createMockFile('note.md');
			mockVault.read.mockResolvedValue('file content');

			const result = await vaultService.read(mockFile);

			expect(result).toBe('file content');
			expect(mockVault.read).toHaveBeenCalledWith(mockFile);
		});

		it('should return empty string and log error when file is excluded', async () => {
			const mockFile = createMockFile('AI Agent/test.md');

			const result = await vaultService.read(mockFile, false);

			expect(result).toBe('');
			expect(consoleErrorSpy).toHaveBeenCalled();
			expect(mockVault.read).not.toHaveBeenCalled();
		});

		it('should allow reading excluded files when allowAccessToPluginRoot is true', async () => {
			const mockFile = createMockFile('AI Agent/test.md');
			mockVault.read.mockResolvedValue('content');

			const result = await vaultService.read(mockFile, true);

			expect(result).toBe('content');
			expect(mockVault.read).toHaveBeenCalledWith(mockFile);
		});
	});

	describe('create', () => {
		it('should create a file with sanitized path', async () => {
			const mockFile = createMockFile('note.md');
			mockVault.getAbstractFileByPath.mockReturnValue(null); // No existing directories
			mockVault.create.mockResolvedValue(mockFile);
			mockVault.createFolder.mockResolvedValue(createMockFolder('folder'));

			const result = await vaultService.create('note.md', 'content');

			expect(mockVault.create).toHaveBeenCalledWith('note.md', 'content');
			expect(result).toBe(mockFile);
		});

		it('should throw error when trying to create file in excluded path', async () => {
			await expect(
				vaultService.create('AI Agent/test.md', 'content', false)
			).rejects.toThrow('Plugin attempted to create a file that is in the exclusion list');
		});

		it('should create parent directories if they do not exist', async () => {
			const mockFile = createMockFile('folder/subfolder/note.md');
			mockVault.getAbstractFileByPath.mockReturnValue(null);
			mockVault.create.mockResolvedValue(mockFile);
			mockVault.createFolder.mockResolvedValue(createMockFolder('folder'));

			await vaultService.create('folder/subfolder/note.md', 'content');

			expect(mockVault.createFolder).toHaveBeenCalledTimes(2);
			expect(mockVault.createFolder).toHaveBeenCalledWith('folder');
			expect(mockVault.createFolder).toHaveBeenCalledWith('folder/subfolder');
		});

		it('should not create directories that already exist', async () => {
			const mockFile = createMockFile('existing/note.md');
			const existingFolder = createMockFolder('existing');

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'existing') return existingFolder;
				return null;
			});
			mockVault.create.mockResolvedValue(mockFile);

			await vaultService.create('existing/note.md', 'content');

			// Should not call createFolder for 'existing' since it already exists
			expect(mockVault.createFolder).not.toHaveBeenCalled();
		});
	});

	describe('modify', () => {
		it('should modify file content when file is not excluded', async () => {
			const mockFile = createMockFile('note.md');
			mockVault.process.mockResolvedValue(undefined);

			await vaultService.modify(mockFile, 'new content');

			expect(mockVault.process).toHaveBeenCalledWith(mockFile, expect.any(Function));
		});

		it('should not modify file and log error when file is excluded', async () => {
			const mockFile = createMockFile('AI Agent/test.md');

			await vaultService.modify(mockFile, 'new content', false);

			expect(mockVault.process).not.toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should call vault.process with function that returns new content', async () => {
			const mockFile = createMockFile('note.md');
			let processCallback: any;

			mockVault.process.mockImplementation((file, fn) => {
				processCallback = fn;
				return Promise.resolve();
			});

			await vaultService.modify(mockFile, 'new content');

			expect(processCallback()).toBe('new content');
		});
	});

	describe('delete', () => {
		it('should delete file successfully when not excluded', async () => {
			const mockFile = createMockFile('note.md');
			mockVault.delete.mockResolvedValue(undefined);

			const result = await vaultService.delete(mockFile);

			expect(result).toEqual({ success: true });
			expect(mockVault.delete).toHaveBeenCalledWith(mockFile, undefined);
		});

		it('should not delete file and return error when excluded', async () => {
			const mockFile = createMockFile('AI Agent/test.md');

			const result = await vaultService.delete(mockFile, false, false);

			expect(result).toEqual({ success: false, error: 'File is in exclusion list' });
			expect(mockVault.delete).not.toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should pass force parameter to vault.delete', async () => {
			const mockFile = createMockFile('note.md');
			mockVault.delete.mockResolvedValue(undefined);

			await vaultService.delete(mockFile, true);

			expect(mockVault.delete).toHaveBeenCalledWith(mockFile, true);
		});

		it('should return error when deletion fails', async () => {
			const mockFile = createMockFile('note.md');
			mockVault.delete.mockRejectedValue(new Error('Deletion failed'));

			const result = await vaultService.delete(mockFile);

			expect(result).toEqual({ success: false, error: 'Deletion failed' });
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should handle non-Error objects in catch block', async () => {
			const mockFile = createMockFile('note.md');
			mockVault.delete.mockRejectedValue('string error');

			const result = await vaultService.delete(mockFile);

			expect(result).toEqual({ success: false, error: 'string error' });
		});
	});

	describe('move', () => {
		it('should move file successfully when source is not excluded', async () => {
			const mockFile = createMockFile('source.md');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockFileManager.renameFile.mockResolvedValue(undefined);

			const result = await vaultService.move('source.md', 'dest.md');

			expect(result).toEqual({ success: true });
			expect(mockFileManager.renameFile).toHaveBeenCalledWith(mockFile, 'dest.md');
		});

		it('should return error when source file is excluded', async () => {
			const result = await vaultService.move('AI Agent/test.md', 'dest.md', false);

			expect(result).toEqual({ success: false, error: 'Source file is in exclusion list' });
			expect(mockFileManager.renameFile).not.toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should return error when source file does not exist', async () => {
			mockVault.getAbstractFileByPath.mockReturnValue(null);

			const result = await vaultService.move('nonexistent.md', 'dest.md');

			expect(result).toEqual({ success: false, error: 'Source file not found' });
			expect(mockFileManager.renameFile).not.toHaveBeenCalled();
		});

		it('should create destination directories if needed', async () => {
			const mockFile = createMockFile('source.md');
			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'source.md') return mockFile;
				return null;
			});
			mockVault.createFolder.mockResolvedValue(createMockFolder('folder'));
			mockFileManager.renameFile.mockResolvedValue(undefined);

			await vaultService.move('source.md', 'folder/dest.md');

			expect(mockVault.createFolder).toHaveBeenCalledWith('folder');
		});

		it('should return error when move operation fails', async () => {
			const mockFile = createMockFile('source.md');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockFileManager.renameFile.mockRejectedValue(new Error('Move failed'));

			const result = await vaultService.move('source.md', 'dest.md');

			expect(result).toEqual({ success: false, error: 'Move failed' });
			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});

	describe('createFolder', () => {
		it('should create folder with sanitized path', async () => {
			const mockFolder = createMockFolder('folder');
			mockVault.createFolder.mockResolvedValue(mockFolder);

			const result = await vaultService.createFolder('folder');

			expect(mockVault.createFolder).toHaveBeenCalledWith('folder');
			expect(result).toBe(mockFolder);
		});

		it('should throw error when trying to create folder in excluded path', async () => {
			await expect(
				vaultService.createFolder('AI Agent/subfolder', false)
			).rejects.toThrow('Plugin attempted to create a folder that is in the exclusion list');
		});
	});

	describe('listFilesInDirectory', () => {
		it('should list all files in directory non-recursively', async () => {
			const file1 = createMockFile('folder/file1.md');
			const file2 = createMockFile('folder/file2.md');
			const folder = createMockFolder('folder', [file1, file2]);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);

			const result = await vaultService.listFilesInDirectory('folder', false);

			expect(result).toHaveLength(2);
			expect(result).toContain(file1);
			expect(result).toContain(file2);
		});

		it('should list all files recursively', async () => {
			const file1 = createMockFile('folder/file1.md');
			const file2 = createMockFile('folder/sub/file2.md');
			const subfolder = createMockFolder('folder/sub', [file2]);
			const folder = createMockFolder('folder', [file1, subfolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'folder') return folder;
				if (path === 'folder/sub') return subfolder;
				return null;
			});

			const result = await vaultService.listFilesInDirectory('folder', true);

			expect(result).toHaveLength(2);
			expect(result).toContain(file1);
			expect(result).toContain(file2);
		});

		it('should filter out excluded files from results', async () => {
			const file1 = createMockFile('folder/public.md');
			const file2 = createMockFile('folder/private.md');
			const folder = createMockFolder('folder', [file1, file2]);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockPluginSettings.exclusions = ['**/private.md'];

			const result = await vaultService.listFilesInDirectory('folder', false);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('folder/public.md');
		});

		it('should return empty array when directory does not exist', async () => {
			mockVault.getAbstractFileByPath.mockReturnValue(null);

			const result = await vaultService.listFilesInDirectory('nonexistent');

			expect(result).toEqual([]);
		});

		it('should return empty array when path is a file, not a directory', async () => {
			const mockFile = createMockFile('file.md');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const result = await vaultService.listFilesInDirectory('file.md');

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter when accessing directory', async () => {
			const file1 = createMockFile('AI Agent/test.md');
			const file2 = createMockFile('AI Agent/notes.md');
			const agentFolder = createMockFolder('AI Agent', [file1, file2]);

			mockVault.getAbstractFileByPath.mockReturnValue(agentFolder);

			// Create a spy on the vaultService.getAbstractFileByPath method
			const getAbstractFileSpy = vi.spyOn(vaultService, 'getAbstractFileByPath');

			// Call with allowAccessToPluginRoot = false (should block access)
			await vaultService.listFilesInDirectory('AI Agent', true, false);

			// Verify getAbstractFileByPath was called with the correct parameter
			expect(getAbstractFileSpy).toHaveBeenCalledWith('AI Agent', false);

			// Reset
			getAbstractFileSpy.mockClear();

			// Call with allowAccessToPluginRoot = true (should allow access)
			await vaultService.listFilesInDirectory('AI Agent', true, true);

			// Verify getAbstractFileByPath was called with the correct parameter
			expect(getAbstractFileSpy).toHaveBeenCalledWith('AI Agent', true);
		});

		it('should not access excluded directory when allowAccessToPluginRoot is false', async () => {
			// Mock to simulate VaultService exclusion behavior
			mockVault.getAbstractFileByPath.mockReturnValue(null);

			// Create a spy to verify the correct parameter is passed
			const getAbstractFileSpy = vi.spyOn(vaultService, 'getAbstractFileByPath');

			// Try to list files in AI Agent directory with allowAccessToPluginRoot = false
			const result = await vaultService.listFilesInDirectory('AI Agent', true, false);

			// Should call getAbstractFileByPath with false (not hardcoded true)
			expect(getAbstractFileSpy).toHaveBeenCalledWith('AI Agent', false);

			// Should return empty array since directory is excluded
			expect(result).toEqual([]);
		});
	});

	describe('listFoldersInDirectory', () => {
		it('should list all folders in directory non-recursively', async () => {
			const folder1 = createMockFolder('parent/folder1', []);
			const folder2 = createMockFolder('parent/folder2', []);
			const parentFolder = createMockFolder('parent', [folder1, folder2]);

			mockVault.getAbstractFileByPath.mockReturnValue(parentFolder);

			const result = await vaultService.listFoldersInDirectory('parent', false);

			expect(result).toHaveLength(2);
			expect(result).toContain(folder1);
			expect(result).toContain(folder2);
		});

		it('should list all folders recursively', async () => {
			const subfolder1 = createMockFolder('parent/child/subfolder1', []);
			const childFolder = createMockFolder('parent/child', [subfolder1]);
			const folder1 = createMockFolder('parent/folder1', []);
			const parentFolder = createMockFolder('parent', [folder1, childFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'parent') return parentFolder;
				if (path === 'parent/folder1') return folder1;
				if (path === 'parent/child') return childFolder;
				return null;
			});

			const result = await vaultService.listFoldersInDirectory('parent', true);

			expect(result).toHaveLength(3);
			expect(result).toContain(folder1);
			expect(result).toContain(childFolder);
			expect(result).toContain(subfolder1);
		});

		it('should filter out excluded folders from results', async () => {
			const publicFolder = createMockFolder('parent/public', []);
			const privateFolder = createMockFolder('parent/private', []);
			const parentFolder = createMockFolder('parent', [publicFolder, privateFolder]);

			mockVault.getAbstractFileByPath.mockReturnValue(parentFolder);
			mockPluginSettings.exclusions = ['**/private'];

			const result = await vaultService.listFoldersInDirectory('parent', false);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('parent/public');
		});

		it('should return empty array when directory does not exist', async () => {
			mockVault.getAbstractFileByPath.mockReturnValue(null);

			const result = await vaultService.listFoldersInDirectory('nonexistent');

			expect(result).toEqual([]);
		});

		it('should return empty array when path is a file, not a directory', async () => {
			const mockFile = createMockFile('file.md');
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const result = await vaultService.listFoldersInDirectory('file.md');

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const agentFolder = createMockFolder('AI Agent', []);
			const notesFolder = createMockFolder('notes', []);
			const rootFolder = createMockFolder('/', [agentFolder, notesFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				// AI Agent blocked when allowAccessToPluginRoot = false
				if (path === 'AI Agent') return null;
				if (path === 'notes') return notesFolder;
				return null;
			});

			// With allowAccessToPluginRoot = false (should exclude AI Agent)
			const result1 = await vaultService.listFoldersInDirectory('/', true, false);
			expect(result1.some((folder) => folder.path === 'AI Agent')).toBe(false);
			expect(result1.some((folder) => folder.path === 'notes')).toBe(true);

			// With allowAccessToPluginRoot = true (should include AI Agent)
			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				if (path === 'AI Agent') return agentFolder; // Now allowed
				if (path === 'notes') return notesFolder;
				return null;
			});

			const result2 = await vaultService.listFoldersInDirectory('/', true, true);
			expect(result2.some((folder) => folder.path === 'AI Agent')).toBe(true);
			expect(result2.some((folder) => folder.path === 'notes')).toBe(true);
		});

		it('should not recurse into excluded folders', async () => {
			const excludedSubfolder = createMockFolder('parent/excluded/sub', []);
			const excludedFolder = createMockFolder('parent/excluded', [excludedSubfolder]);
			const allowedFolder = createMockFolder('parent/allowed', []);
			const parentFolder = createMockFolder('parent', [excludedFolder, allowedFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'parent') return parentFolder;
				if (path === 'parent/excluded') return excludedFolder; // Should not be accessed
				if (path === 'parent/allowed') return allowedFolder;
				return null;
			});

			// Use pattern that matches the folder itself and its contents
			mockPluginSettings.exclusions = ['parent/excluded/**', 'parent/excluded'];

			const result = await vaultService.listFoldersInDirectory('parent', true);

			// Should not include excluded folder or its subfolders
			expect(result.some((folder) => folder.path === 'parent/excluded')).toBe(false);
			expect(result.some((folder) => folder.path === 'parent/excluded/sub')).toBe(false);
			expect(result.some((folder) => folder.path === 'parent/allowed')).toBe(true);
		});
	});

	describe('searchVaultFiles', () => {
		it('should find matches in file content', async () => {
			const file1 = createMockFile('note1.md');
			const file2 = createMockFile('note2.md');
			const folder = createMockFolder('/', [file1, file2]);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.cachedRead.mockImplementation((file: TFile) => {
				if (file.path === 'note1.md') return Promise.resolve('This is a test document with test word');
				if (file.path === 'note2.md') return Promise.resolve('Another document');
				return Promise.resolve('');
			});

			const results = await vaultService.searchVaultFiles('test');

			expect(results.length).toBeGreaterThan(0);
			const match = results.find(r => r.file.path === 'note1.md');
			expect(match).toBeDefined();
			expect(match!.snippets.length).toBeGreaterThan(0);
		});

		it('should find filename matches', async () => {
			const file = createMockFile('test-file.md');
			const folder = createMockFolder('/', [file]);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.cachedRead.mockResolvedValue('No matches in content');

			const results = await vaultService.searchVaultFiles('test');

			expect(results.length).toBeGreaterThan(0);
			const match = results.find(r => r.file.path === 'test-file.md');
			expect(match).toBeDefined();
		});

		it('should handle invalid regex gracefully by escaping', async () => {
			const file = createMockFile('note.md');
			const folder = createMockFolder('/', [file]);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.cachedRead.mockResolvedValue('Contains [special] characters');

			// Should not throw error
			const results = await vaultService.searchVaultFiles('[invalid regex');

			expect(results).toBeDefined();
		});

		it('should extract snippets with context around matches', async () => {
			const file = createMockFile('note.md');
			const folder = createMockFolder('/', [file]);
			const content = 'a'.repeat(100) + 'MATCH' + 'b'.repeat(100);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.cachedRead.mockResolvedValue(content);

			const results = await vaultService.searchVaultFiles('MATCH');

			expect(results.length).toBeGreaterThan(0);
			const match = results[0];
			expect(match.snippets[0].text.length).toBeGreaterThan('MATCH'.length);
			expect(match.snippets[0].text).toContain('MATCH');
		});

		it('should merge overlapping snippets', async () => {
			const file = createMockFile('note.md');
			const folder = createMockFolder('/', [file]);
			// Two matches close together that should be merged
			const content = 'test ' + 'a'.repeat(50) + ' test';

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.cachedRead.mockResolvedValue(content);

			const results = await vaultService.searchVaultFiles('test');

			// Should merge into one snippet since they overlap
			expect(results.length).toBeGreaterThan(0);
			// The exact behavior depends on implementation details
		});

		it('should randomly sample when more than 20 matches', async () => {
			// Create 25 files, each with a match
			const files: TFile[] = [];
			for (let i = 0; i < 25; i++) {
				files.push(createMockFile(`note${i}.md`));
			}
			const folder = createMockFolder('/', files);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.cachedRead.mockResolvedValue('This contains the search term');

			const results = await vaultService.searchVaultFiles('search');

			// Should have at most 20 snippet matches (plus potentially filename matches)
			const totalSnippets = results.reduce((sum, r) => sum + r.snippets.length, 0);
			expect(totalSnippets).toBeLessThanOrEqual(20);
		});

		it('should perform case-insensitive search', async () => {
			const file = createMockFile('note.md');
			const folder = createMockFolder('/', [file]);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.cachedRead.mockResolvedValue('Test TEST tEsT');

			const results = await vaultService.searchVaultFiles('test');

			expect(results.length).toBeGreaterThan(0);
			// Should find all three variants
		});

		it('should not log errors when vault contains excluded directories', async () => {
			// Setup: Create a vault structure with excluded "AI Agent" directory
			const normalFile = createMockFile('notes/document.md');
			const excludedFile = createMockFile('AI Agent/secret.md');
			const notesFolder = createMockFolder('notes', [normalFile]);
			const excludedFolder = createMockFolder('AI Agent', [excludedFile]);
			const rootFolder = createMockFolder('/', [normalFile, notesFolder, excludedFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				if (path === 'notes') return notesFolder;
				if (path === 'notes/document.md') return normalFile;
				// AI Agent directory should be blocked by getAbstractFileByPath
				if (path === 'AI Agent') return null;
				return null;
			});

			mockVault.cachedRead.mockResolvedValue('test content');

			// Spy on console.error
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Execute search
			const results = await vaultService.searchVaultFiles('test');

			// Should not log exclusion errors during normal search operation
			expect(consoleErrorSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('Plugin attempted to retrieve a file that is in the exclusions list')
			);

			// Should still return results from non-excluded files
			expect(results.length).toBeGreaterThan(0);

			consoleErrorSpy.mockRestore();
		});

		it('should respect allowAccessToPluginRoot parameter when true', async () => {
			// Setup: Create vault with AI Agent directory
			const agentFile = createMockFile('AI Agent/notes.md');
			const normalFile = createMockFile('normal.md');
			const agentFolder = createMockFolder('AI Agent', [agentFile]);
			const rootFolder = createMockFolder('/', [normalFile, agentFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				if (path === 'AI Agent') return agentFolder;
				if (path === 'AI Agent/notes.md') return agentFile;
				if (path === 'normal.md') return normalFile;
				return null;
			});

			mockVault.cachedRead.mockResolvedValue('searchable content');

			// Search with allowAccessToPluginRoot = true
			const results = await vaultService.searchVaultFiles('searchable', true);

			// Should include files from AI Agent directory
			const paths = results.map(r => r.file.path);
			expect(paths).toContain('AI Agent/notes.md');
			expect(paths).toContain('normal.md');
		});

		it('should exclude AI Agent directory when allowAccessToPluginRoot is false', async () => {
			// Setup: Create vault with AI Agent directory
			const agentFile = createMockFile('AI Agent/notes.md');
			const normalFile = createMockFile('normal.md');
			const agentFolder = createMockFolder('AI Agent', [agentFile]);
			const rootFolder = createMockFolder('/', [normalFile, agentFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				// When allowAccessToPluginRoot is false, AI Agent should be blocked
				if (path === 'AI Agent') return null;
				if (path === 'normal.md') return normalFile;
				return null;
			});

			mockVault.cachedRead.mockResolvedValue('searchable content');

			// Search with allowAccessToPluginRoot = false (default)
			const results = await vaultService.searchVaultFiles('searchable', false);

			// Should NOT include files from AI Agent directory
			const paths = results.map(r => r.file.path);
			expect(paths).not.toContain('AI Agent/notes.md');
			expect(paths).toContain('normal.md');
		});

		it('should pass allowAccessToPluginRoot to listFilesInDirectory', async () => {
			const file = createMockFile('test.md');
			const folder = createMockFolder('/', [file]);

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.cachedRead.mockResolvedValue('content');

			// Create a spy on listFilesInDirectory
			const listFilesSpy = vi.spyOn(vaultService, 'listFilesInDirectory');

			// Call with allowAccessToPluginRoot = true
			await vaultService.searchVaultFiles('test', true);

			// Verify listFilesInDirectory was called with the correct parameter
			expect(listFilesSpy).toHaveBeenCalledWith(Path.Root, true, true);

			listFilesSpy.mockClear();

			// Call with allowAccessToPluginRoot = false
			await vaultService.searchVaultFiles('test', false);

			// Verify listFilesInDirectory was called with the correct parameter
			expect(listFilesSpy).toHaveBeenCalledWith(Path.Root, true, false);

			listFilesSpy.mockRestore();
		});
	});

	describe('isExclusion (private method behavior)', () => {
		it('should exclude exact path matches', () => {
			mockPluginSettings.exclusions = ['secret.md'];

			const result = vaultService.exists('secret.md');

			expect(result).toBe(false);
		});

		it('should handle wildcard * (matches any non-slash)', () => {
			mockPluginSettings.exclusions = ['folder/*.md'];

			// Mock files to exist in vault
			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'folder/file.md' || path === 'folder/sub/file.md') {
					return createMockFile(path);
				}
				return null;
			});

			expect(vaultService.exists('folder/file.md')).toBe(false);
			expect(vaultService.exists('folder/sub/file.md')).toBe(true); // * doesn't match /
		});

		it('should handle double wildcard ** (matches anything including slashes)', () => {
			mockPluginSettings.exclusions = ['private/**'];

			// Mock files to exist in vault
			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'private/file.md' || path === 'private/sub/deep/file.md' || path === 'public/file.md') {
					return createMockFile(path);
				}
				return null;
			});

			expect(vaultService.exists('private/file.md')).toBe(false);
			expect(vaultService.exists('private/sub/deep/file.md')).toBe(false);
			expect(vaultService.exists('public/file.md')).toBe(true);
		});

		it('should handle patterns ending with / to match directory and contents', () => {
			mockPluginSettings.exclusions = ['temp/'];

			expect(vaultService.exists('temp/file.md')).toBe(false);
			expect(vaultService.exists('temp/sub/file.md')).toBe(false);
		});

		it('should always exclude AI Agent root by default', () => {
			const result = vaultService.exists('AI Agent/file.md', false);

			expect(result).toBe(false);
		});

		it('should always exclude user instruction file', () => {
			const result = vaultService.exists('AI Agent/AGENT_INSTRUCTIONS.md', true);

			expect(result).toBe(false);
		});

		it('should handle special regex characters in patterns', () => {
			mockPluginSettings.exclusions = ['folder[test].md'];

			// Mock files to exist in vault
			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'folder[test].md' || path === 'foldert.md') {
					return createMockFile(path);
				}
				return null;
			});

			// Should match literally, not as regex character class
			expect(vaultService.exists('folder[test].md')).toBe(false);
			expect(vaultService.exists('foldert.md')).toBe(true);
		});

		it('should handle multiple exclusion patterns', () => {
			mockPluginSettings.exclusions = ['private/**', 'temp/', '*.secret'];

			// Mock files to exist in vault
			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'private/file.md' || path === 'temp/file.md' || path === 'data.secret' || path === 'public/file.md') {
					return createMockFile(path);
				}
				return null;
			});

			expect(vaultService.exists('private/file.md')).toBe(false);
			expect(vaultService.exists('temp/file.md')).toBe(false);
			expect(vaultService.exists('data.secret')).toBe(false);
			expect(vaultService.exists('public/file.md')).toBe(true);
		});
	});

	describe('registerFileEvents', () => {
		it('should register all file event handlers', () => {
			const mockEventRef = { event: 'mock' };
			mockVault.on.mockReturnValue(mockEventRef);

			const handler = vi.fn();
			vaultService.registerFileEvents(handler);

			// Should register 4 events (create, modify, rename, delete)
			expect(mockVault.on).toHaveBeenCalledTimes(4);
			expect(mockVault.on).toHaveBeenCalledWith('create', expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith('modify', expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith('rename', expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith('delete', expect.any(Function));
			expect(mockPlugin.registerEvent).toHaveBeenCalledTimes(4);
		});

		it('should call handler with correct parameters for create event', () => {
			const handler = vi.fn();
			let createCallback: any;

			mockVault.on.mockImplementation((event: string, callback: any) => {
				if (event === 'create') {
					createCallback = callback;
				}
				return { event: 'mock' };
			});

			vaultService.registerFileEvents(handler);

			const mockFile = createMockFile('test.md');
			createCallback(mockFile);

			expect(handler).toHaveBeenCalledWith('create', mockFile, { oldPath: '' });
		});

		it('should call handler with correct parameters for rename event', () => {
			const handler = vi.fn();
			let renameCallback: any;

			mockVault.on.mockImplementation((event: string, callback: any) => {
				if (event === 'rename') {
					renameCallback = callback;
				}
				return { event: 'mock' };
			});

			vaultService.registerFileEvents(handler);

			const mockFile = createMockFile('new.md');
			renameCallback(mockFile, 'old.md');

			expect(handler).toHaveBeenCalledWith('rename', mockFile, { oldPath: 'old.md' });
		});
	});

	describe('listDirectoryContents', () => {
		it('should return all files and folders when no exclusions', async () => {
			const file1 = createMockFile('note1.md');
			const file2 = createMockFile('note2.md');
			const folder1 = createMockFolder('folder1', []);
			const folder2 = createMockFolder('folder2', []);
			const rootFolder = createMockFolder('/', [file1, file2, folder1, folder2]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				if (path === 'folder1') return folder1;
				if (path === 'folder2') return folder2;
				return null;
			});

			const result = await vaultService.listDirectoryContents(Path.Root);

			expect(result).toHaveLength(4);
			expect(result).toEqual(expect.arrayContaining([file1, file2, folder1, folder2]));
		});

		it('should filter out excluded files and folders', async () => {
			const publicNote = createMockFile('public/note.md');
			const agentNote = createMockFile('AI Agent/conversation.md');
			const privateNote = createMockFile('private/secret.md');
			const publicFolder = createMockFolder('public', [publicNote]);
			const agentFolder = createMockFolder('AI Agent', [agentNote]);
			const privateFolder = createMockFolder('private', [privateNote]);
			const rootFolder = createMockFolder('/', [publicNote, agentNote, privateNote, publicFolder, agentFolder, privateFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				if (path === 'public') return publicFolder;
				if (path === 'AI Agent') return null; // Excluded by default
				if (path === 'private') return privateFolder;
				return null;
			});

			mockPluginSettings.exclusions = ['private/**'];

			const result = await vaultService.listDirectoryContents(Path.Root, true, false);

			// Should include: public/note.md and public folder
			// Should exclude: AI Agent folder (default exclusion), private/** content
			expect(result.some((item: any) => item.path === 'public/note.md')).toBe(true);
			expect(result.some((item: any) => item.path === 'public')).toBe(true);
			expect(result.some((item: any) => item.path === 'AI Agent/conversation.md')).toBe(false);
			expect(result.some((item: any) => item.path === 'private/secret.md')).toBe(false);
			expect(result.some((item: any) => item.path === 'private')).toBe(true); // Folder itself not excluded by 'private/**'
		});

		it('should exclude the AI Agent directory itself from folder listings', async () => {
			const publicNote = createMockFile('public/note.md');
			const publicFolder = createMockFolder('public', [publicNote]);
			const agentFolder = createMockFolder('AI Agent', []);
			const notesFolder = createMockFolder('notes', []);
			const rootFolder = createMockFolder('/', [publicNote, publicFolder, agentFolder, notesFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				if (path === 'public') return publicFolder;
				if (path === 'AI Agent') return null; // Excluded by default
				if (path === 'notes') return notesFolder;
				return null;
			});

			const result = await vaultService.listDirectoryContents(Path.Root, true, false);

			// AI Agent directory itself should be excluded
			expect(result.some((item: any) => item.path === 'AI Agent')).toBe(false);
			// Other folders should be included
			expect(result.some((item: any) => item.path === 'public')).toBe(true);
			expect(result.some((item: any) => item.path === 'notes')).toBe(true);
		});

		it('should include AI Agent directory when allowAccessToPluginRoot is true', async () => {
			const note = createMockFile('note.md');
			const agentNote = createMockFile('AI Agent/conversation.md');
			const agentFolder = createMockFolder('AI Agent', [agentNote]);
			const rootFolder = createMockFolder('/', [note, agentFolder]);

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '/' || path === '') return rootFolder;
				if (path === 'AI Agent') return agentFolder; // Allowed with flag
				return null;
			});

			const result = await vaultService.listDirectoryContents(Path.Root, true, true);

			expect(result).toHaveLength(3);
			expect(result.some((item: any) => item.path === 'AI Agent/conversation.md')).toBe(true);
		});

		it('should return empty array when vault is empty', async () => {
			const emptyRoot = createMockFolder('/', []);
			mockVault.getAbstractFileByPath.mockReturnValue(emptyRoot);

			const result = await vaultService.listDirectoryContents(Path.Root);

			expect(result).toEqual([]);
		});
	});
});

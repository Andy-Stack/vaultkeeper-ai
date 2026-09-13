import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSystemService } from '../../Services/FileSystemService';
import { VaultService } from '../../Services/VaultService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { TFile, TFolder, TAbstractFile } from 'obsidian';
import type { ISearchMatch } from '../../Types/SearchTypes';
import { Exception } from '../../Helpers/Exception';

// Helper function to create mock TFile
function createMockFile(path: string, extension: string = 'md'): TFile {
	const file = new TFile();
	file.path = path;
	file.name = path.split('/').pop() || '';
	file.basename = file.name.replace(/\.[^/.]+$/, '');
	file.extension = extension;
	file.parent = null as any;
	file.vault = null as any;
	file.stat = {
		ctime: Date.now(),
		mtime: Date.now(),
		size: 100
	};
	return file;
}

// Helper function to create mock TFolder
function createMockFolder(path: string, children: TAbstractFile[] = []): TFolder {
	const folder = new TFolder();
	folder.path = path;
	folder.name = path.split('/').pop() || '';
	folder.children = children;
	folder.parent = null as any;
	folder.vault = null as any;
	folder.isRoot = () => path === '/';
	return folder;
}

describe('FileSystemService', () => {
	let fileSystemService: FileSystemService;
	let mockVaultService: VaultService;
	let consoleErrorSpy: any;

	beforeEach(() => {
		// Create mock VaultService
		mockVaultService = {
			getMarkdownFiles: vi.fn(),
			getAbstractFileByPath: vi.fn(),
			read: vi.fn(),
			create: vi.fn(),
			modify: vi.fn(),
			patch: vi.fn(),
			delete: vi.fn(),
			move: vi.fn(),
			listFilesInDirectory: vi.fn(),
			listFoldersInDirectory: vi.fn(),
			listDirectoryContents: vi.fn(),
			searchVaultFiles: vi.fn()
		} as any;

		// Register mock VaultService
		RegisterSingleton(Services.VaultService, mockVaultService);

		// Create FileSystemService instance
		fileSystemService = new FileSystemService();

		// Spy on console.error and Exception methods
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(Exception, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		DeregisterAllServices();
		consoleErrorSpy.mockRestore();
		vi.restoreAllMocks();
	});

	describe('readFile', () => {
		it('should read file content successfully', async () => {
			const mockFile = createMockFile('test.md');
			const fileContent = 'This is test content';

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue({ content: fileContent, nextIndex: undefined });

			const result = await fileSystemService.readFilePath('test.md');

			if (result instanceof Error) throw result;
			expect(result.content).toBe(fileContent);
			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('test.md', undefined);
			expect(mockVaultService.read).toHaveBeenCalledWith(mockFile, undefined);
		});

		it('should return Error when file does not exist', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);

			const result = await fileSystemService.readFilePath('nonexistent.md');

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('File does not exist: ');
			expect(mockVaultService.read).not.toHaveBeenCalled();
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFile = createMockFile('plugin/config.json', 'json');
			const fileContent = '{"key": "value"}';

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue({ content: fileContent, nextIndex: undefined });

			await fileSystemService.readFilePath('plugin/config.json', { allowAccessToPluginRoot: true });

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/config.json', { allowAccessToPluginRoot: true });
			expect(mockVaultService.read).toHaveBeenCalledWith(mockFile, { allowAccessToPluginRoot: true });
		});

		it('should return Error when path is not a file', async () => {
			const mockFolder = createMockFolder('folder');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);

			const result = await fileSystemService.readFilePath('folder');

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('Path is a folder, not a file');
			expect(mockVaultService.read).not.toHaveBeenCalled();
		});
	});

	describe('writeFile', () => {
		it('should create new file when it does not exist', async () => {
			const mockFile = createMockFile('new.md');
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.writeToFilePath('new.md', 'content');

			expect(result).toBe(mockFile);
			expect(mockVaultService.create).toHaveBeenCalledWith('new.md', 'content', undefined);
			expect(mockVaultService.modify).not.toHaveBeenCalled();
		});

		it('should modify existing file', async () => {
			const mockFile = createMockFile('existing.md');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.modify = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.writeToFilePath('existing.md', 'new content');

			expect(result).toBe(mockFile);
			expect(mockVaultService.modify).toHaveBeenCalledWith(mockFile, 'new content', undefined);
			expect(mockVaultService.create).not.toHaveBeenCalled();
		});

		it('should respect allowAccessToPluginRoot parameter when creating', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			await fileSystemService.writeToFilePath('plugin/data.json', 'content', { allowAccessToPluginRoot: true });

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/data.json', { allowAccessToPluginRoot: true });
			expect(mockVaultService.create).toHaveBeenCalledWith('plugin/data.json', 'content', { allowAccessToPluginRoot: true });
		});

		it('should return error object when create fails', async () => {
			const error = new Error('Create failed');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(error);

			const result = await fileSystemService.writeToFilePath('error.md', 'content');

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toBe('Create failed');
		});

		it('should return error object when modify fails', async () => {
			const mockFile = createMockFile('existing.md');
			const error = new Error('Modify failed');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.modify = vi.fn().mockResolvedValue(error);

			const result = await fileSystemService.writeToFilePath('existing.md', 'content');

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toBe('Modify failed');
		});
	});

	describe('patchFile', () => {
		it('should patch existing file successfully', async () => {
			const mockFile = createMockFile('existing.md');
			const oldContent = ['old content'];
			const newContent = ['new content'];

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.patch = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.patchFileAtPath('existing.md', oldContent, newContent);

			expect(result).toBe(mockFile);
			expect(mockVaultService.patch).toHaveBeenCalledWith(mockFile, oldContent, newContent, undefined);
		});

		it('should create file with empty content when file does not exist', async () => {
			const mockFile = createMockFile('new.md');
			const oldContent = [''];
			const newContent = ['# New File\nContent here'];

			// Mock sequence: first call returns null (file doesn't exist), second call returns null (writeFile checks), then create succeeds
			mockVaultService.getAbstractFileByPath = vi.fn()
				.mockReturnValueOnce(null)  // patchFile checks if file exists
				.mockReturnValueOnce(null); // writeFile (called by patchFile) checks if file exists
			mockVaultService.create = vi.fn().mockResolvedValue(mockFile);
			mockVaultService.patch = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.patchFileAtPath('new.md', oldContent, newContent);

			// writeFile should create the file with empty content
			expect(mockVaultService.create).toHaveBeenCalledWith('new.md', '', undefined);
			expect(mockVaultService.patch).toHaveBeenCalledWith(mockFile, oldContent, newContent, undefined);
			expect(result).toBe(mockFile);
		});

		it('should return error when patch fails', async () => {
			const mockFile = createMockFile('existing.md');
			const oldContent = ['old'];
			const newContent = ['new'];
			const error = new Error('Content to replace was not found in the file');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.patch = vi.fn().mockResolvedValue(error);

			const result = await fileSystemService.patchFileAtPath('existing.md', oldContent, newContent);

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('Content to replace was not found in the file');
		});

		it('should return error when creating empty file fails', async () => {
			const oldContent = [''];
			const newContent = ['New line'];
			const error = new Error('Create failed');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(error);

			const result = await fileSystemService.patchFileAtPath('new.md', oldContent, newContent);

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toBe('Create failed');
			expect(mockVaultService.patch).not.toHaveBeenCalled();
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFile = createMockFile('plugin/config.md');
			const oldContent = ['setting=old'];
			const newContent = ['setting=new'];

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.patch = vi.fn().mockResolvedValue(mockFile);

			await fileSystemService.patchFileAtPath('plugin/config.md', oldContent, newContent, { allowAccessToPluginRoot: true });

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/config.md', { allowAccessToPluginRoot: true });
			expect(mockVaultService.patch).toHaveBeenCalledWith(mockFile, oldContent, newContent, { allowAccessToPluginRoot: true });
		});

		it('should handle complex multi-line replacement', async () => {
			const mockFile = createMockFile('document.md');
			const oldContent = ['# Title\nOld intro\nContent'];
			const newContent = ['# Title\nNew intro\nContent'];

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.patch = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.patchFileAtPath('document.md', oldContent, newContent);

			expect(result).toBe(mockFile);
			expect(mockVaultService.patch).toHaveBeenCalledWith(mockFile, oldContent, newContent, undefined);
		});

		it('should handle file creation when getAbstractFileByPath returns null after create', async () => {
			const oldContent = [''];
			const newContent = ['content'];

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(createMockFile('new.md'));
			mockVaultService.patch = vi.fn().mockResolvedValue(createMockFile('new.md'));

			await fileSystemService.patchFileAtPath('new.md', oldContent, newContent);

			// Should call patch on the created file
			expect(mockVaultService.create).toHaveBeenCalledWith('new.md', '', undefined);
			expect(mockVaultService.patch).toHaveBeenCalled();
		});

		it('should respect requiresConfirmation parameter', async () => {
			const mockFile = createMockFile('test.md');
			const oldContent = ['old'];
			const newContent = ['new'];

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.patch = vi.fn().mockResolvedValue(mockFile);

			await fileSystemService.patchFileAtPath('test.md', oldContent, newContent, { allowAccessToPluginRoot: false, requiresConfirmation: true });

			expect(mockVaultService.patch).toHaveBeenCalledWith(mockFile, oldContent, newContent, { allowAccessToPluginRoot: false, requiresConfirmation: true });
		});
	});

	describe('deleteFile', () => {
		it('should delete file successfully', async () => {
			const mockFile = createMockFile('delete-me.md');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.delete = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.deleteFile('delete-me.md');

			expect(result).toBeUndefined();
			expect(mockVaultService.delete).toHaveBeenCalledWith(mockFile, undefined);
		});

		it('should return error when file does not exist', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);

			const result = await fileSystemService.deleteFile('nonexistent.md');

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('File does not exist');
			expect(mockVaultService.delete).not.toHaveBeenCalled();
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFile = createMockFile('plugin/temp.json', 'json');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.delete = vi.fn().mockResolvedValue(undefined);

			await fileSystemService.deleteFile('plugin/temp.json', { allowAccessToPluginRoot: true });

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/temp.json', { allowAccessToPluginRoot: true });
			expect(mockVaultService.delete).toHaveBeenCalledWith(mockFile, { allowAccessToPluginRoot: true });
		});

		it('should delete folder successfully', async () => {
			const mockFolder = createMockFolder('folder');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);
			mockVaultService.isExclusion = vi.fn().mockReturnValue(false);
			mockVaultService.delete = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.deleteFolder('folder');

			expect(result).toBeUndefined();
			expect(mockVaultService.delete).toHaveBeenCalledWith(mockFolder, undefined);
		});
	});

	describe('moveFile', () => {
		it('should move file successfully', async () => {
			mockVaultService.move = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.moveFile('old/path.md', 'new/path.md');

			expect(result).toBeUndefined();
			expect(mockVaultService.move).toHaveBeenCalledWith('old/path.md', 'new/path.md', undefined);
		});

		it('should return error when move fails', async () => {
			const error = new Error('Source file not found');
			mockVaultService.move = vi.fn().mockResolvedValue(error);

			const result = await fileSystemService.moveFile('nonexistent.md', 'new.md');

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toBe('Source file not found');
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			mockVaultService.move = vi.fn().mockResolvedValue(undefined);

			await fileSystemService.moveFile('plugin/old.json', 'plugin/new.json', { allowAccessToPluginRoot: true });

			expect(mockVaultService.move).toHaveBeenCalledWith('plugin/old.json', 'plugin/new.json', { allowAccessToPluginRoot: true });
		});
	});

	describe('listFilesInDirectory', () => {
		it('should list files recursively by default', async () => {
			const mockFiles = [
				createMockFile('test-dir/file1.md'),
				createMockFile('test-dir/subfolder/file2.md')
			];

			mockVaultService.listFilesInDirectory = vi.fn().mockResolvedValue(mockFiles);

			const result = await fileSystemService.listFilesInDirectory('test-dir');

			expect(result).toEqual(mockFiles);
			expect(mockVaultService.listFilesInDirectory).toHaveBeenCalledWith('test-dir', undefined);
		});

		it('should list files non-recursively when specified', async () => {
			const mockFiles = [createMockFile('test-dir/file1.md')];

			mockVaultService.listFilesInDirectory = vi.fn().mockResolvedValue(mockFiles);

			const result = await fileSystemService.listFilesInDirectory('test-dir', { recursive: false });

			expect(result).toEqual(mockFiles);
			expect(mockVaultService.listFilesInDirectory).toHaveBeenCalledWith('test-dir', { recursive: false });
		});

		it('should return empty array when directory does not exist', async () => {
			mockVaultService.listFilesInDirectory = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.listFilesInDirectory('nonexistent');

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFiles = [createMockFile('plugin/config.json', 'json')];

			mockVaultService.listFilesInDirectory = vi.fn().mockResolvedValue(mockFiles);

			await fileSystemService.listFilesInDirectory('plugin', { recursive: true, allowAccessToPluginRoot: true });

			expect(mockVaultService.listFilesInDirectory).toHaveBeenCalledWith('plugin', { recursive: true, allowAccessToPluginRoot: true });
		});
	});

	describe('listFoldersInDirectory', () => {
		it('should list folders recursively by default', async () => {
			const mockFolders = [
				createMockFolder('test-dir/subfolder1'),
				createMockFolder('test-dir/subfolder1/nested')
			];

			mockVaultService.listFoldersInDirectory = vi.fn().mockResolvedValue(mockFolders);

			const result = await fileSystemService.listFoldersInDirectory('test-dir');

			expect(result).toEqual(mockFolders);
			expect(mockVaultService.listFoldersInDirectory).toHaveBeenCalledWith('test-dir', undefined);
		});

		it('should list folders non-recursively when specified', async () => {
			const mockFolders = [createMockFolder('test-dir/subfolder1')];

			mockVaultService.listFoldersInDirectory = vi.fn().mockResolvedValue(mockFolders);

			const result = await fileSystemService.listFoldersInDirectory('test-dir', { recursive: false });

			expect(result).toEqual(mockFolders);
			expect(mockVaultService.listFoldersInDirectory).toHaveBeenCalledWith('test-dir', { recursive: false });
		});

		it('should return empty array when directory does not exist', async () => {
			mockVaultService.listFoldersInDirectory = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.listFoldersInDirectory('nonexistent');

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFolders = [createMockFolder('plugin/subdir')];

			mockVaultService.listFoldersInDirectory = vi.fn().mockResolvedValue(mockFolders);

			await fileSystemService.listFoldersInDirectory('plugin', { recursive: true, allowAccessToPluginRoot: true });

			expect(mockVaultService.listFoldersInDirectory).toHaveBeenCalledWith('plugin', { recursive: true, allowAccessToPluginRoot: true });
		});
	});

	describe('listDirectoryContents', () => {
		it('should list both files and folders recursively by default', async () => {
			const mockContents = [
				createMockFile('test-dir/file.md'),
				createMockFolder('test-dir/subfolder')
			];

			mockVaultService.listDirectoryContents = vi.fn().mockResolvedValue({ results: mockContents, nextIndex: undefined });

			const result = await fileSystemService.listDirectoryContents('test-dir');

			expect(result.results).toEqual(mockContents);
			expect(mockVaultService.listDirectoryContents).toHaveBeenCalledWith('test-dir', undefined);
		});

		it('should list contents non-recursively when specified', async () => {
			const mockContents = [createMockFile('test-dir/file.md')];

			mockVaultService.listDirectoryContents = vi.fn().mockResolvedValue({ results: mockContents, nextIndex: undefined });

			const result = await fileSystemService.listDirectoryContents('test-dir', { recursive: false });

			expect(result.results).toEqual(mockContents);
			expect(mockVaultService.listDirectoryContents).toHaveBeenCalledWith('test-dir', { recursive: false });
		});

		it('should return empty array when directory does not exist', async () => {
			mockVaultService.listDirectoryContents = vi.fn().mockResolvedValue({ results: [], nextIndex: undefined });

			const result = await fileSystemService.listDirectoryContents('nonexistent');

			expect(result.results).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockContents = [
				createMockFile('plugin/main.js', 'js'),
				createMockFolder('plugin/modules')
			];

			mockVaultService.listDirectoryContents = vi.fn().mockResolvedValue({ results: mockContents, nextIndex: undefined });

			await fileSystemService.listDirectoryContents('plugin', { recursive: true, primaryIndex: 0, limitResults: false, allowAccessToPluginRoot: true });

			expect(mockVaultService.listDirectoryContents).toHaveBeenCalledWith('plugin', { recursive: true, primaryIndex: 0, limitResults: false, allowAccessToPluginRoot: true });
		});
	});

	describe('readObjectFromFile', () => {
		it('should read and parse valid JSON file', async () => {
			const mockFile = createMockFile('data.json', 'json');
			const jsonContent = '{"name": "test", "value": 42}';
			const expectedObject = { name: 'test', value: 42 };

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue({ content: jsonContent, nextIndex: undefined });

			const result = await fileSystemService.readObjectFromFile('data.json');

			expect(result).toEqual(expectedObject);
		});

		it('should return Error when file does not exist', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);

			const result = await fileSystemService.readObjectFromFile('nonexistent.json');

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('File not found');
		});

		it('should throw SyntaxError when JSON is invalid', async () => {
			const mockFile = createMockFile('invalid.json', 'json');
			const invalidJson = '{name: "test", invalid}';

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue({ content: invalidJson, nextIndex: undefined });

			await expect(async () => {
				await fileSystemService.readObjectFromFile('invalid.json');
			}).rejects.toThrow(SyntaxError);
		});

		it('should handle nested objects', async () => {
			const mockFile = createMockFile('nested.json', 'json');
			const jsonContent = '{"user": {"name": "John", "age": 30}, "active": true}';
			const expectedObject = { user: { name: 'John', age: 30 }, active: true };

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue({ content: jsonContent, nextIndex: undefined });

			const result = await fileSystemService.readObjectFromFile('nested.json');

			expect(result).toEqual(expectedObject);
		});

		it('should handle arrays', async () => {
			const mockFile = createMockFile('array.json', 'json');
			const jsonContent = '[1, 2, 3, 4, 5]';
			const expectedArray = [1, 2, 3, 4, 5];

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue({ content: jsonContent, nextIndex: undefined });

			const result = await fileSystemService.readObjectFromFile('array.json');

			expect(result).toEqual(expectedArray);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFile = createMockFile('plugin/settings.json', 'json');
			const jsonContent = '{"setting": "value"}';

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue({ content: jsonContent, nextIndex: undefined });

			await fileSystemService.readObjectFromFile('plugin/settings.json', { allowAccessToPluginRoot: true });

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/settings.json', { allowAccessToPluginRoot: true });
			expect(mockVaultService.read).toHaveBeenCalledWith(mockFile, { allowAccessToPluginRoot: true });
		});
	});

	describe('writeObjectToFile', () => {
		it('should serialize and write object to new file', async () => {
			const data = { name: 'test', value: 42 };
			const expectedJson = JSON.stringify(data, null, 4);
			const mockFile = createMockFile('data.json', 'json');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.writeObjectToFile('data.json', data);

			expect(result).toBe(mockFile);
			expect(mockVaultService.create).toHaveBeenCalledWith('data.json', expectedJson, undefined);
		});

		it('should serialize and write object to existing file', async () => {
			const mockFile = createMockFile('existing.json', 'json');
			const data = { updated: true };
			const expectedJson = JSON.stringify(data, null, 4);

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.modify = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.writeObjectToFile('existing.json', data);

			expect(result).toBe(mockFile);
			expect(mockVaultService.modify).toHaveBeenCalledWith(mockFile, expectedJson, undefined);
		});

		it('should format JSON with 4-space indentation', async () => {
			const data = { nested: { key: 'value' }, array: [1, 2, 3] };

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			await fileSystemService.writeObjectToFile('formatted.json', data);

			const expectedJson = JSON.stringify(data, null, 4);
			expect(mockVaultService.create).toHaveBeenCalledWith('formatted.json', expectedJson, undefined);
			// Verify it contains newlines and indentation
			expect(expectedJson).toContain('\n');
			expect(expectedJson).toContain('    ');
		});

		it('should handle empty objects', async () => {
			const data = {};
			const expectedJson = JSON.stringify(data, null, 4);
			const mockFile = createMockFile('empty.json', 'json');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.writeObjectToFile('empty.json', data);

			expect(result).toBe(mockFile);
			expect(mockVaultService.create).toHaveBeenCalledWith('empty.json', expectedJson, undefined);
		});

		it('should handle arrays', async () => {
			const data = [1, 2, 3, 4, 5];
			const expectedJson = JSON.stringify(data, null, 4);
			const mockFile = createMockFile('array.json', 'json');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(mockFile);

			const result = await fileSystemService.writeObjectToFile('array.json', data);

			expect(result).toBe(mockFile);
			expect(mockVaultService.create).toHaveBeenCalledWith('array.json', expectedJson, undefined);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const data = { config: 'value' };
			const expectedJson = JSON.stringify(data, null, 4);

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			await fileSystemService.writeObjectToFile('plugin/config.json', data, { allowAccessToPluginRoot: true });

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/config.json', { allowAccessToPluginRoot: true });
			expect(mockVaultService.create).toHaveBeenCalledWith('plugin/config.json', expectedJson, { allowAccessToPluginRoot: true });
		});

		it('should return Error on write error', async () => {
			const data = { test: 'value' };
			const error = new Error('Write failed');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(error);

			const result = await fileSystemService.writeObjectToFile('error.json', data);

			expect(result).toBe(error);
		});
	});

	describe('searchVaultFiles', () => {
		it('should search files and return matches', async () => {
			const searchTerm = 'test query';
			const mockMatches: ISearchMatch[] = [
				{
					file: createMockFile('note1.md'),
					snippets: [
						{
							text: 'This is a test query in the content',
							matchIndex: 10,
							matchLength: 10,
							pageNumber: 1
						}
					]
				},
				{
					file: createMockFile('note2.md'),
					snippets: [
						{
							text: 'Another test query here',
							matchIndex: 8,
							matchLength: 10,
							pageNumber: 1
						}
					]
				}
			];

			mockVaultService.searchVaultFiles = vi.fn().mockResolvedValue(mockMatches);

			const result = await fileSystemService.searchVaultFiles(searchTerm, { primaryIndex: 0, secondaryIndex: 0, limitResults: false });

			expect(result).toEqual(mockMatches);
			expect(mockVaultService.searchVaultFiles).toHaveBeenCalledWith(searchTerm, { primaryIndex: 0, secondaryIndex: 0, limitResults: false });
		});

		it('should return empty array when no matches found', async () => {
			mockVaultService.searchVaultFiles = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.searchVaultFiles('nonexistent term', { primaryIndex: 0, secondaryIndex: 0, limitResults: false });

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const searchTerm = 'config';

			mockVaultService.searchVaultFiles = vi.fn().mockResolvedValue([]);

			await fileSystemService.searchVaultFiles(searchTerm, { primaryIndex: 0, secondaryIndex: 0, limitResults: true });

			expect(mockVaultService.searchVaultFiles).toHaveBeenCalledWith(searchTerm, { primaryIndex: 0, secondaryIndex: 0, limitResults: true });
		});

		it('should handle empty search term', async () => {
			mockVaultService.searchVaultFiles = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.searchVaultFiles('', { primaryIndex: 0, secondaryIndex: 0, limitResults: false });

			expect(result).toEqual([]);
			expect(mockVaultService.searchVaultFiles).toHaveBeenCalledWith('', { primaryIndex: 0, secondaryIndex: 0, limitResults: false });
		});
	});
});

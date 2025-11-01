import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSystemService } from '../../Services/FileSystemService';
import { VaultService } from '../../Services/VaultService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { TFile, TFolder, TAbstractFile } from 'obsidian';
import type { ISearchMatch } from '../../Helpers/SearchTypes';

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

		// Spy on console.error
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		DeregisterAllServices();
		consoleErrorSpy.mockRestore();
	});

	describe('getVaultFileListForMarkDown', () => {
		it('should return list of markdown file paths without .md extension', () => {
			const mockFiles = [
				createMockFile('folder/file1.md'),
				createMockFile('folder/file2.md'),
				createMockFile('notes/test.md')
			];

			mockVaultService.getMarkdownFiles = vi.fn().mockReturnValue(mockFiles);

			const result = fileSystemService.getVaultFileListForMarkDown();

			expect(result).toEqual([
				'folder/file1',
				'folder/file2',
				'notes/test'
			]);
			expect(mockVaultService.getMarkdownFiles).toHaveBeenCalled();
		});

		it('should return empty array when no markdown files exist', () => {
			mockVaultService.getMarkdownFiles = vi.fn().mockReturnValue([]);

			const result = fileSystemService.getVaultFileListForMarkDown();

			expect(result).toEqual([]);
		});

		it('should handle files without extensions gracefully', () => {
			const mockFiles = [
				createMockFile('folder/file1', ''),
			];
			mockFiles[0].path = 'folder/file1'; // No extension

			mockVaultService.getMarkdownFiles = vi.fn().mockReturnValue(mockFiles);

			const result = fileSystemService.getVaultFileListForMarkDown();

			expect(result).toEqual(['folder/file1']);
		});
	});

	describe('readFile', () => {
		it('should read file content successfully', async () => {
			const mockFile = createMockFile('test.md');
			const fileContent = 'This is test content';

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue(fileContent);

			const result = await fileSystemService.readFile('test.md');

			expect(result).toBe(fileContent);
			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('test.md', false);
			expect(mockVaultService.read).toHaveBeenCalledWith(mockFile, false);
		});

		it('should return null when file does not exist', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);

			const result = await fileSystemService.readFile('nonexistent.md');

			expect(result).toBeNull();
			expect(mockVaultService.read).not.toHaveBeenCalled();
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFile = createMockFile('plugin/config.json', 'json');
			const fileContent = '{"key": "value"}';

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue(fileContent);

			await fileSystemService.readFile('plugin/config.json', true);

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/config.json', true);
			expect(mockVaultService.read).toHaveBeenCalledWith(mockFile, true);
		});

		it('should return null when path is not a file', async () => {
			const mockFolder = createMockFolder('folder');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);

			const result = await fileSystemService.readFile('folder');

			expect(result).toBeNull();
			expect(mockVaultService.read).not.toHaveBeenCalled();
		});
	});

	describe('writeFile', () => {
		it('should create new file when it does not exist', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.writeFile('new.md', 'content');

			expect(result).toBe(true);
			expect(mockVaultService.create).toHaveBeenCalledWith('new.md', 'content', false);
			expect(mockVaultService.modify).not.toHaveBeenCalled();
		});

		it('should modify existing file', async () => {
			const mockFile = createMockFile('existing.md');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.modify = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.writeFile('existing.md', 'new content');

			expect(result).toBe(true);
			expect(mockVaultService.modify).toHaveBeenCalledWith(mockFile, 'new content', false);
			expect(mockVaultService.create).not.toHaveBeenCalled();
		});

		it('should respect allowAccessToPluginRoot parameter when creating', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			await fileSystemService.writeFile('plugin/data.json', 'content', true);

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/data.json', true);
			expect(mockVaultService.create).toHaveBeenCalledWith('plugin/data.json', 'content', true);
		});

		it('should return error object when create fails', async () => {
			const error = new Error('Create failed');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockRejectedValue(error);

			const result = await fileSystemService.writeFile('error.md', 'content');

			expect(result).toEqual(error);
			expect(consoleErrorSpy).toHaveBeenCalledWith('Error writing file:', error);
		});

		it('should return error object when modify fails', async () => {
			const mockFile = createMockFile('existing.md');
			const error = new Error('Modify failed');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.modify = vi.fn().mockRejectedValue(error);

			const result = await fileSystemService.writeFile('existing.md', 'content');

			expect(result).toEqual(error);
			expect(consoleErrorSpy).toHaveBeenCalledWith('Error writing file:', error);
		});
	});

	describe('deleteFile', () => {
		it('should delete file successfully', async () => {
			const mockFile = createMockFile('delete-me.md');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.delete = vi.fn().mockResolvedValue({ success: true });

			const result = await fileSystemService.deleteFile('delete-me.md');

			expect(result).toEqual({ success: true });
			expect(mockVaultService.delete).toHaveBeenCalledWith(mockFile, undefined, false);
		});

		it('should return error when file does not exist', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);

			const result = await fileSystemService.deleteFile('nonexistent.md');

			expect(result).toEqual({ success: false, error: 'File not found' });
			expect(mockVaultService.delete).not.toHaveBeenCalled();
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFile = createMockFile('plugin/temp.json', 'json');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.delete = vi.fn().mockResolvedValue({ success: true });

			await fileSystemService.deleteFile('plugin/temp.json', true);

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/temp.json', true);
			expect(mockVaultService.delete).toHaveBeenCalledWith(mockFile, undefined, true);
		});

		it('should return error when path is not a file', async () => {
			const mockFolder = createMockFolder('folder');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);

			const result = await fileSystemService.deleteFile('folder');

			expect(result).toEqual({ success: false, error: 'File not found' });
			expect(mockVaultService.delete).not.toHaveBeenCalled();
		});
	});

	describe('moveFile', () => {
		it('should move file successfully', async () => {
			mockVaultService.move = vi.fn().mockResolvedValue({ success: true });

			const result = await fileSystemService.moveFile('old/path.md', 'new/path.md');

			expect(result).toEqual({ success: true });
			expect(mockVaultService.move).toHaveBeenCalledWith('old/path.md', 'new/path.md', false);
		});

		it('should return error when move fails', async () => {
			mockVaultService.move = vi.fn().mockResolvedValue({ success: false, error: 'Source file not found' });

			const result = await fileSystemService.moveFile('nonexistent.md', 'new.md');

			expect(result).toEqual({ success: false, error: 'Source file not found' });
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			mockVaultService.move = vi.fn().mockResolvedValue({ success: true });

			await fileSystemService.moveFile('plugin/old.json', 'plugin/new.json', true);

			expect(mockVaultService.move).toHaveBeenCalledWith('plugin/old.json', 'plugin/new.json', true);
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
			expect(mockVaultService.listFilesInDirectory).toHaveBeenCalledWith('test-dir', true, false);
		});

		it('should list files non-recursively when specified', async () => {
			const mockFiles = [createMockFile('test-dir/file1.md')];

			mockVaultService.listFilesInDirectory = vi.fn().mockResolvedValue(mockFiles);

			const result = await fileSystemService.listFilesInDirectory('test-dir', false);

			expect(result).toEqual(mockFiles);
			expect(mockVaultService.listFilesInDirectory).toHaveBeenCalledWith('test-dir', false, false);
		});

		it('should return empty array when directory does not exist', async () => {
			mockVaultService.listFilesInDirectory = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.listFilesInDirectory('nonexistent');

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFiles = [createMockFile('plugin/config.json', 'json')];

			mockVaultService.listFilesInDirectory = vi.fn().mockResolvedValue(mockFiles);

			await fileSystemService.listFilesInDirectory('plugin', true, true);

			expect(mockVaultService.listFilesInDirectory).toHaveBeenCalledWith('plugin', true, true);
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
			expect(mockVaultService.listFoldersInDirectory).toHaveBeenCalledWith('test-dir', true, false);
		});

		it('should list folders non-recursively when specified', async () => {
			const mockFolders = [createMockFolder('test-dir/subfolder1')];

			mockVaultService.listFoldersInDirectory = vi.fn().mockResolvedValue(mockFolders);

			const result = await fileSystemService.listFoldersInDirectory('test-dir', false);

			expect(result).toEqual(mockFolders);
			expect(mockVaultService.listFoldersInDirectory).toHaveBeenCalledWith('test-dir', false, false);
		});

		it('should return empty array when directory does not exist', async () => {
			mockVaultService.listFoldersInDirectory = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.listFoldersInDirectory('nonexistent');

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFolders = [createMockFolder('plugin/subdir')];

			mockVaultService.listFoldersInDirectory = vi.fn().mockResolvedValue(mockFolders);

			await fileSystemService.listFoldersInDirectory('plugin', true, true);

			expect(mockVaultService.listFoldersInDirectory).toHaveBeenCalledWith('plugin', true, true);
		});
	});

	describe('listDirectoryContents', () => {
		it('should list both files and folders recursively by default', async () => {
			const mockContents = [
				createMockFile('test-dir/file.md'),
				createMockFolder('test-dir/subfolder')
			];

			mockVaultService.listDirectoryContents = vi.fn().mockResolvedValue(mockContents);

			const result = await fileSystemService.listDirectoryContents('test-dir');

			expect(result).toEqual(mockContents);
			expect(mockVaultService.listDirectoryContents).toHaveBeenCalledWith('test-dir', true, false);
		});

		it('should list contents non-recursively when specified', async () => {
			const mockContents = [createMockFile('test-dir/file.md')];

			mockVaultService.listDirectoryContents = vi.fn().mockResolvedValue(mockContents);

			const result = await fileSystemService.listDirectoryContents('test-dir', false);

			expect(result).toEqual(mockContents);
			expect(mockVaultService.listDirectoryContents).toHaveBeenCalledWith('test-dir', false, false);
		});

		it('should return empty array when directory does not exist', async () => {
			mockVaultService.listDirectoryContents = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.listDirectoryContents('nonexistent');

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockContents = [
				createMockFile('plugin/main.js', 'js'),
				createMockFolder('plugin/modules')
			];

			mockVaultService.listDirectoryContents = vi.fn().mockResolvedValue(mockContents);

			await fileSystemService.listDirectoryContents('plugin', true, true);

			expect(mockVaultService.listDirectoryContents).toHaveBeenCalledWith('plugin', true, true);
		});
	});

	describe('readObjectFromFile', () => {
		it('should read and parse valid JSON file', async () => {
			const mockFile = createMockFile('data.json', 'json');
			const jsonContent = '{"name": "test", "value": 42}';
			const expectedObject = { name: 'test', value: 42 };

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue(jsonContent);

			const result = await fileSystemService.readObjectFromFile('data.json');

			expect(result).toEqual(expectedObject);
		});

		it('should return null when file does not exist', async () => {
			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);

			const result = await fileSystemService.readObjectFromFile('nonexistent.json');

			expect(result).toBeNull();
		});

		it('should return null when JSON is invalid', async () => {
			const mockFile = createMockFile('invalid.json', 'json');
			const invalidJson = '{name: "test", invalid}';

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue(invalidJson);

			const result = await fileSystemService.readObjectFromFile('invalid.json');

			expect(result).toBeNull();
		});

		it('should handle nested objects', async () => {
			const mockFile = createMockFile('nested.json', 'json');
			const jsonContent = '{"user": {"name": "John", "age": 30}, "active": true}';
			const expectedObject = { user: { name: 'John', age: 30 }, active: true };

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue(jsonContent);

			const result = await fileSystemService.readObjectFromFile('nested.json');

			expect(result).toEqual(expectedObject);
		});

		it('should handle arrays', async () => {
			const mockFile = createMockFile('array.json', 'json');
			const jsonContent = '[1, 2, 3, 4, 5]';
			const expectedArray = [1, 2, 3, 4, 5];

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue(jsonContent);

			const result = await fileSystemService.readObjectFromFile('array.json');

			expect(result).toEqual(expectedArray);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const mockFile = createMockFile('plugin/settings.json', 'json');
			const jsonContent = '{"setting": "value"}';

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.read = vi.fn().mockResolvedValue(jsonContent);

			await fileSystemService.readObjectFromFile('plugin/settings.json', true);

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/settings.json', true);
			expect(mockVaultService.read).toHaveBeenCalledWith(mockFile, true);
		});
	});

	describe('writeObjectToFile', () => {
		it('should serialize and write object to new file', async () => {
			const data = { name: 'test', value: 42 };
			const expectedJson = JSON.stringify(data, null, 4);

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.writeObjectToFile('data.json', data);

			expect(result).toBe(true);
			expect(mockVaultService.create).toHaveBeenCalledWith('data.json', expectedJson, false);
		});

		it('should serialize and write object to existing file', async () => {
			const mockFile = createMockFile('existing.json', 'json');
			const data = { updated: true };
			const expectedJson = JSON.stringify(data, null, 4);

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);
			mockVaultService.modify = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.writeObjectToFile('existing.json', data);

			expect(result).toBe(true);
			expect(mockVaultService.modify).toHaveBeenCalledWith(mockFile, expectedJson, false);
		});

		it('should format JSON with 4-space indentation', async () => {
			const data = { nested: { key: 'value' }, array: [1, 2, 3] };

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			await fileSystemService.writeObjectToFile('formatted.json', data);

			const expectedJson = JSON.stringify(data, null, 4);
			expect(mockVaultService.create).toHaveBeenCalledWith('formatted.json', expectedJson, false);
			// Verify it contains newlines and indentation
			expect(expectedJson).toContain('\n');
			expect(expectedJson).toContain('    ');
		});

		it('should handle empty objects', async () => {
			const data = {};
			const expectedJson = JSON.stringify(data, null, 4);

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.writeObjectToFile('empty.json', data);

			expect(result).toBe(true);
			expect(mockVaultService.create).toHaveBeenCalledWith('empty.json', expectedJson, false);
		});

		it('should handle arrays', async () => {
			const data = [1, 2, 3, 4, 5];
			const expectedJson = JSON.stringify(data, null, 4);

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			const result = await fileSystemService.writeObjectToFile('array.json', data);

			expect(result).toBe(true);
			expect(mockVaultService.create).toHaveBeenCalledWith('array.json', expectedJson, false);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const data = { config: 'value' };
			const expectedJson = JSON.stringify(data, null, 4);

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockResolvedValue(undefined);

			await fileSystemService.writeObjectToFile('plugin/config.json', data, true);

			expect(mockVaultService.getAbstractFileByPath).toHaveBeenCalledWith('plugin/config.json', true);
			expect(mockVaultService.create).toHaveBeenCalledWith('plugin/config.json', expectedJson, true);
		});

		it('should return false on write error', async () => {
			const data = { test: 'value' };
			const error = new Error('Write failed');

			mockVaultService.getAbstractFileByPath = vi.fn().mockReturnValue(null);
			mockVaultService.create = vi.fn().mockRejectedValue(error);

			const result = await fileSystemService.writeObjectToFile('error.json', data);

			expect(result).toBe(false);
			expect(consoleErrorSpy).toHaveBeenCalledWith('Error writing JSON file:', error);
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
							matchLength: 10
						}
					]
				},
				{
					file: createMockFile('note2.md'),
					snippets: [
						{
							text: 'Another test query here',
							matchIndex: 8,
							matchLength: 10
						}
					]
				}
			];

			mockVaultService.searchVaultFiles = vi.fn().mockResolvedValue(mockMatches);

			const result = await fileSystemService.searchVaultFiles(searchTerm);

			expect(result).toEqual(mockMatches);
			expect(mockVaultService.searchVaultFiles).toHaveBeenCalledWith(searchTerm, false);
		});

		it('should return empty array when no matches found', async () => {
			mockVaultService.searchVaultFiles = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.searchVaultFiles('nonexistent term');

			expect(result).toEqual([]);
		});

		it('should respect allowAccessToPluginRoot parameter', async () => {
			const searchTerm = 'config';

			mockVaultService.searchVaultFiles = vi.fn().mockResolvedValue([]);

			await fileSystemService.searchVaultFiles(searchTerm, true);

			expect(mockVaultService.searchVaultFiles).toHaveBeenCalledWith(searchTerm, true);
		});

		it('should handle empty search term', async () => {
			mockVaultService.searchVaultFiles = vi.fn().mockResolvedValue([]);

			const result = await fileSystemService.searchVaultFiles('');

			expect(result).toEqual([]);
			expect(mockVaultService.searchVaultFiles).toHaveBeenCalledWith('', false);
		});
	});
});

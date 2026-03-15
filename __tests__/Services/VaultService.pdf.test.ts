import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VaultService } from '../../Services/VaultService';
import { TFile, TFolder, FileManager } from 'obsidian';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { SanitiserService } from '../../Services/SanitiserService';
import { SettingsService, type IVaultkeeperAISettings } from '../../Services/SettingsService';
import { AIProviderModel } from '../../Enums/ApiProvider';
import { Exception } from '../../Helpers/Exception';
import * as PDFHelper from '../../Helpers/DocumentHelper';
import type { IPageText } from '../../Types/SearchTypes';

/**
 * PDF-SPECIFIC TESTS FOR VAULTSERVICE
 *
 * These tests focus on PDF file handling, including:
 * - Multi-page PDF search
 * - Page number tracking
 * - PDF error handling
 */

// Create mock instances
const mockVault = {
	getMarkdownFiles: vi.fn(),
	getAbstractFileByPath: vi.fn(),
	read: vi.fn(),
	cachedRead: vi.fn(),
	readBinary: vi.fn(),
	create: vi.fn(),
	process: vi.fn(),
	delete: vi.fn(),
	trash: vi.fn(),
	createFolder: vi.fn(),
	getFiles: vi.fn(),
	getAllFolders: vi.fn(),
	on: vi.fn(),
	adapter: {
		exists: vi.fn()
	}
};

const mockFileManager = {
	renameFile: vi.fn(),
	trashFile: vi.fn()
} as unknown as FileManager & {
	renameFile: ReturnType<typeof vi.fn>;
	trashFile: ReturnType<typeof vi.fn>;
};

const mockSettings: IVaultkeeperAISettings = {
	firstTimeStart: false,
	model: AIProviderModel.ClaudeSonnet_4_5,
	planningModel: AIProviderModel.ClaudeSonnet_4_5,
	apiKeys: {
		claude: 'test-claude-key',
		openai: 'test-openai-key',
		gemini: 'test-gemini-key', mistral: 'test-mistral-key'
	},
	exclusions: [],
	userInstruction: '',
	searchResultsLimit: 15,
	snippetSizeLimit: 300
};

const mockPlugin = {
	app: {
		vault: mockVault,
		fileManager: mockFileManager
	},
	saveData: vi.fn().mockResolvedValue(undefined),
	registerEvent: vi.fn()
};

// Helper to create mock PDF file
function createMockPDFFile(path: string): TFile {
	const name = path.split('/').pop() || '';
	const basename = name.split('.')[0];
	const file = new TFile();
	file.path = path;
	file.name = name;
	file.basename = basename;
	file.extension = 'pdf';
	file.stat = { ctime: Date.now(), mtime: Date.now(), size: 1000 };
	file.parent = null;
	file.vault = mockVault as any;
	return file;
}

// Helper to create mock markdown file
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
function createMockFolder(path: string, children: TFile[] = []): TFolder {
	const name = path.split('/').pop() || '';
	const folder = new TFolder();
	folder.path = path;
	folder.name = name;
	folder.children = children;
	folder.parent = null;
	folder.vault = mockVault as any;
	return folder;
}

describe('VaultService - PDF Tests', () => {
	let vaultService: VaultService;
	let settingsService: SettingsService;
	let mockDiffService: any;
	let readPDFSpy: any;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Reset settings to defaults
		mockSettings.exclusions = [];
		mockSettings.searchResultsLimit = 15;
		mockSettings.snippetSizeLimit = 300;

		// Set default mock for adapter.exists
		mockVault.adapter.exists.mockResolvedValue(false);

		// Mock console.error to prevent noise in tests
		vi.spyOn(console, 'error').mockImplementation(() => {});

		// Mock Exception.log
		vi.spyOn(Exception, 'log').mockImplementation(() => {});

		// Register real dependencies in DependencyService
		RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin as any);
		RegisterSingleton(Services.SanitiserService, new SanitiserService());

		// Mock EventService and DiffService
		const mockEventService = { trigger: vi.fn(), on: vi.fn(), off: vi.fn() };
		mockDiffService = {
			requestDiff: vi.fn().mockResolvedValue({ accepted: true }),
			applyPatch: vi.fn(),
			onAccept: vi.fn(),
			onReject: vi.fn(),
			onSuggest: vi.fn()
		};
		RegisterSingleton(Services.EventService, mockEventService as any);
		RegisterSingleton(Services.DiffService, mockDiffService as any);

		// Create and register SettingsService
		settingsService = new SettingsService(mockSettings);
		RegisterSingleton(Services.SettingsService, settingsService);

		// Spy on readPDF function
		readPDFSpy = vi.spyOn(PDFHelper, 'readPDF');

		// Create a fresh instance
		vaultService = new VaultService();
	});

	afterEach(() => {
		// Clear singleton registry to prevent memory leaks
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('Multi-page PDF search', () => {
		it('should find matches across multiple pages in a PDF', async () => {
			const pdfFile = createMockPDFFile('document.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			// Mock PDF with 3 pages, search term appears on pages 1 and 3
			const mockPages: IPageText[] = [
				{ text: 'First page contains the search term', pageNumber: 1 },
				{ text: 'Second page has different content', pageNumber: 2 },
				{ text: 'Third page also has the search term', pageNumber: 3 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('search');

			expect(results.length).toBeGreaterThan(0);
			const match = results.find(r => r.file.path === 'document.pdf');
			expect(match).toBeDefined();
			expect(match!.snippets.length).toBe(2); // Two matches across two pages

			// Verify page numbers are correct
			const pageNumbers = match!.snippets.map(s => s.pageNumber).sort();
			expect(pageNumbers).toEqual([1, 3]);
		});

		it('should track correct page numbers for each snippet', async () => {
			const pdfFile = createMockPDFFile('report.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			const mockPages: IPageText[] = [
				{ text: 'Introduction with keyword', pageNumber: 1 },
				{ text: 'Chapter 1 mentions keyword twice: keyword and keyword', pageNumber: 2 },
				{ text: 'Chapter 2 has no matches', pageNumber: 3 },
				{ text: 'Conclusion includes keyword', pageNumber: 4 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('keyword');

			const match = results.find(r => r.file.path === 'report.pdf');
			expect(match).toBeDefined();

			// Should have 3 snippets: page 1 (1 match), page 2 (merged into 1 snippet), page 4 (1 match)
			expect(match!.snippets.length).toBeGreaterThan(0);

			// All snippets should have valid page numbers
			match!.snippets.forEach(snippet => {
				expect(snippet.pageNumber).toBeGreaterThan(0);
				expect(snippet.pageNumber).toBeLessThanOrEqual(4);
			});

			// Check that we have snippets from the correct pages
			const pageNumbers = match!.snippets.map(s => s.pageNumber);
			expect(pageNumbers).toContain(1);
			expect(pageNumbers).toContain(2);
			expect(pageNumbers).toContain(4);
			expect(pageNumbers).not.toContain(3); // Page 3 has no matches
		});

		it('should handle PDF with single page correctly', async () => {
			const pdfFile = createMockPDFFile('single-page.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			const mockPages: IPageText[] = [
				{ text: 'This is a single page document with a match', pageNumber: 1 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('match');

			const match = results.find(r => r.file.path === 'single-page.pdf');
			expect(match).toBeDefined();
			expect(match!.snippets[0].pageNumber).toBe(1);
		});

		it('should handle large multi-page PDF efficiently', async () => {
			const pdfFile = createMockPDFFile('large-document.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			// Simulate a 100-page PDF with matches on specific pages
			const mockPages: IPageText[] = [];
			for (let i = 1; i <= 100; i++) {
				const hasMatch = i % 10 === 0; // Matches on pages 10, 20, 30, etc.
				mockPages.push({
					text: hasMatch ? `Page ${i} contains target word` : `Page ${i} content`,
					pageNumber: i
				});
			}

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(1000));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('target');

			const match = results.find(r => r.file.path === 'large-document.pdf');
			expect(match).toBeDefined();
			expect(match!.snippets.length).toBe(10); // 10 matches (pages 10, 20, 30, ..., 100)

			// Verify page numbers are multiples of 10
			const pageNumbers = match!.snippets.map(s => s.pageNumber).sort((a, b) => (a || 0) - (b || 0));
			expect(pageNumbers).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
		});

		it('should merge overlapping matches within the same page', async () => {
			const pdfFile = createMockPDFFile('overlapping.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			// Create a page with multiple close matches that should be merged
			const mockPages: IPageText[] = [
				{ text: 'test ' + 'a'.repeat(50) + ' test', pageNumber: 1 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('test');

			const match = results.find(r => r.file.path === 'overlapping.pdf');
			expect(match).toBeDefined();

			// Should merge into one snippet since they're close together
			expect(match!.snippets.length).toBe(1);
			expect(match!.snippets[0].pageNumber).toBe(1);
		});

		it('should not merge matches across different pages', async () => {
			const pdfFile = createMockPDFFile('cross-page.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			const mockPages: IPageText[] = [
				{ text: 'End of page 1 with match', pageNumber: 1 },
				{ text: 'Start of page 2 with match', pageNumber: 2 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('match');

			const match = results.find(r => r.file.path === 'cross-page.pdf');
			expect(match).toBeDefined();

			// Should NOT merge - different pages
			expect(match!.snippets.length).toBe(2);
			expect(match!.snippets[0].pageNumber).toBe(1);
			expect(match!.snippets[1].pageNumber).toBe(2);
		});
	});

	describe('PDF error handling', () => {
		it('should handle password-protected PDFs gracefully', async () => {
			const pdfFile = createMockPDFFile('protected.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			// Mock readPDF to return error message for password-protected PDF
			const errorPages: IPageText[] = [
				{ text: 'PDF is password protected!', pageNumber: 1 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(errorPages);

			const results = await vaultService.searchVaultFiles('password');

			const match = results.find(r => r.file.path === 'protected.pdf');
			expect(match).toBeDefined();
			expect(match!.snippets[0].text).toContain('password protected');
			expect(match!.snippets[0].pageNumber).toBe(1);
		});

		it('should handle corrupted PDF files gracefully', async () => {
			const pdfFile = createMockPDFFile('corrupted.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			const errorPages: IPageText[] = [
				{ text: 'Failed to read PDF: Invalid PDF structure', pageNumber: 1 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(errorPages);

			const results = await vaultService.searchVaultFiles('PDF');

			const match = results.find(r => r.file.path === 'corrupted.pdf');
			expect(match).toBeDefined();
			expect(match!.snippets[0].text).toContain('Failed to read PDF');
		});
	});

	describe('Mixed PDF and markdown search', () => {
		it('should handle both PDF and markdown files in the same search', async () => {
			const pdfFile = createMockPDFFile('document.pdf');
			const mdFile = createMockFile('note.md');
			const folder = createMockFolder('/', [pdfFile, mdFile]);

			const mockPages: IPageText[] = [
				{ text: 'PDF page 1 with search term', pageNumber: 1 },
				{ text: 'PDF page 2 with search term', pageNumber: 2 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			mockVault.cachedRead.mockResolvedValue('Markdown content with search term');
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('search');

			expect(results.length).toBe(2);

			const pdfMatch = results.find(r => r.file.path === 'document.pdf');
			const mdMatch = results.find(r => r.file.path === 'note.md');

			expect(pdfMatch).toBeDefined();
			expect(mdMatch).toBeDefined();

			// PDF should have 2 snippets (one per page)
			expect(pdfMatch!.snippets.length).toBe(2);
			expect(pdfMatch!.snippets[0].pageNumber).toBe(1);
			expect(pdfMatch!.snippets[1].pageNumber).toBe(2);

			// Markdown should have 1 snippet on page 1
			expect(mdMatch!.snippets.length).toBeGreaterThan(0);
			expect(mdMatch!.snippets[0].pageNumber).toBe(1);
		});

		it('should preserve page numbers when sampling results', async () => {
			// Create multiple PDF files with matches
			const pdfFiles = Array.from({ length: 5 }, (_, i) =>
				createMockPDFFile(`document${i}.pdf`)
			);
			const folder = createMockFolder('/', pdfFiles);

			const mockPages: IPageText[] = [
				{ text: 'Page 1 with match', pageNumber: 1 },
				{ text: 'Page 5 with match', pageNumber: 5 },
				{ text: 'Page 10 with match', pageNumber: 10 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('match');

			// All results should have valid page numbers
			results.forEach(result => {
				result.snippets.forEach(snippet => {
					expect(snippet.pageNumber).toBeGreaterThan(0);
					expect([1, 5, 10]).toContain(snippet.pageNumber);
				});
			});
		});
	});

	describe('PDF snippet extraction', () => {
		it('should extract snippets with correct context from PDF pages', async () => {
			const pdfFile = createMockPDFFile('context.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			const longText = 'a'.repeat(100) + 'MATCH' + 'b'.repeat(100);
			const mockPages: IPageText[] = [
				{ text: longText, pageNumber: 5 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('MATCH');

			const match = results.find(r => r.file.path === 'context.pdf');
			expect(match).toBeDefined();
			expect(match!.snippets[0].text.length).toBeGreaterThan('MATCH'.length);
			expect(match!.snippets[0].text).toContain('MATCH');
			expect(match!.snippets[0].pageNumber).toBe(5);
		});

		it('should respect snippetSizeLimit for PDF content', async () => {
			settingsService.settings.snippetSizeLimit = 20;

			const pdfFile = createMockPDFFile('limited.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			const longText = 'x'.repeat(200) + 'TARGET' + 'y'.repeat(200);
			const mockPages: IPageText[] = [
				{ text: longText, pageNumber: 1 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('TARGET');

			const match = results.find(r => r.file.path === 'limited.pdf');
			expect(match).toBeDefined();
			expect(match!.snippets[0].text.length).toBeLessThanOrEqual(
				settingsService.settings.snippetSizeLimit + 10
			);
			expect(match!.snippets[0].pageNumber).toBe(1);
		});
	});

	describe('PDF filename matching', () => {
		it('should match PDF filenames even without content matches', async () => {
			const pdfFile = createMockPDFFile('important-report.pdf');
			const folder = createMockFolder('/', [pdfFile]);

			const mockPages: IPageText[] = [
				{ text: 'No matches in content', pageNumber: 1 }
			];

			mockVault.getAbstractFileByPath.mockReturnValue(folder);
			mockVault.readBinary.mockResolvedValue(new ArrayBuffer(100));
			readPDFSpy.mockResolvedValue(mockPages);

			const results = await vaultService.searchVaultFiles('important');

			const match = results.find(r => r.file.path === 'important-report.pdf');
			expect(match).toBeDefined();
			// Should match filename even though content has no matches
		});
	});
});

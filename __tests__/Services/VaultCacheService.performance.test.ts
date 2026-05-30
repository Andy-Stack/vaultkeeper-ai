import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile, TFolder, TAbstractFile, MetadataCache, FileManager } from 'obsidian';
import { VaultCacheService } from '../../Services/VaultCacheService';
import { VaultService } from '../../Services/VaultService';
import { SettingsService, type IVaultkeeperAISettings } from '../../Services/SettingsService';
import { SanitiserService } from '../../Services/SanitiserService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIProvider, AIProviderModel } from '../../Enums/ApiProvider';
import type VaultkeeperAIPlugin from '../../main';
import { ChatMode } from '../../Enums/ChatMode';

// Mock getAllTags from obsidian
vi.mock('obsidian', async () => {
	const actual = await vi.importActual('obsidian');
	return {
		...actual,
		Component: class Component {
			public load() {}
			public onload() {}
			public unload() {}
			public onunload() {}
			public addChild<T extends Component>(component: T): T {
				return component;
			}
			public removeChild<T extends Component>(component: T): T {
				return component;
			}
			public register(_cb: () => any): void {}
			public registerEvent(_eventRef: any): void {}
			public registerDomEvent(_el: any, _type: any, _callback: any, _options?: any): void {}
			public registerInterval(id: number): number {
				return id;
			}
		},
		getAllTags: vi.fn((metadata: any) => {
			if (!metadata || !metadata.tags) return null;
			return metadata.tags.map((t: any) => t.tag);
		})
	};
});

/**
 * Performance Test Suite for VaultCacheService
 *
 * Tests the performance of cache operations on extremely large vaults (up to 20,000 files)
 * focusing on initial cache loading and fuzzy search performance.
 *
 * Test Matrix:
 * - Initial Cache Loading: 1K, 5K, 10K, 20K files × 3 tag densities = 12 tests
 * - Fuzzy Search - matchTag: 4 vault sizes × 3 query patterns = 12 tests
 * - Fuzzy Search - matchFile: 4 vault sizes × 3 query patterns = 12 tests
 * - Fuzzy Search - matchFolder: 3 folder configurations × 3 query patterns = 9 tests
 * - Real-time Updates: 3 update operations × 2 scales = 6 tests
 *
 * Total: 51 performance tests
 */

// ============================================================================
// Mock Setup
// ============================================================================

const mockVault = {
	getMarkdownFiles: vi.fn(),
	getAbstractFileByPath: vi.fn(),
	adapter: {
		list: vi.fn()
	},
	on: vi.fn()
} as any;

const mockFileManager = {
	processFrontMatter: vi.fn()
} as unknown as FileManager;

const mockMetadataCache = {
	getCache: vi.fn(),
	on: vi.fn()
} as unknown as MetadataCache;

const mockPlugin = {
	app: {
		vault: mockVault,
		fileManager: mockFileManager,
		metadataCache: mockMetadataCache
	},
	saveData: vi.fn().mockResolvedValue(undefined),
	registerEvent: vi.fn()
} as unknown as VaultkeeperAIPlugin;

const mockSettings: IVaultkeeperAISettings = {
	firstTimeStart: false,
	model: AIProviderModel.ClaudeSonnet_4_6,
	planningModel: AIProviderModel.ClaudeSonnet_4_6,
	apiKeys: {
		claude: 'test-claude-key',
		openai: 'test-openai-key',
		gemini: 'test-gemini-key', mistral: 'test-mistral-key'
	},
	exclusions: [],
	userInstruction: '',
	searchResultsLimit: 15,
	snippetSizeLimit: 300,
	enableMemories: false,
	allowUpdatingMemories: true,
	enableWebSearch: true,
	enableWebViewer: false,
	provider: AIProvider.Claude,
	quickActionModel: AIProviderModel.ClaudeSonnet_4_6,
	enableContextMenuActions: false,
	enableToolbarActions: false,
	hideDrawerElements: false,
	chatMode: ChatMode.Edit
};

let settingsService: SettingsService;
let vaultService: VaultService;
let vaultCacheService: VaultCacheService;
let fileEventHandler: any;
let resolvedHandler: any;

// ============================================================================
// Test Configuration
// ============================================================================

// Performance thresholds (milliseconds)
// These are set based on observed performance with some headroom for slower machines
const PERFORMANCE_THRESHOLDS = {
	initialCache: {
		'1000': 20,    // Observed: 2-3ms, threshold: 20ms
		'5000': 40,    // Observed: 5-6ms, threshold: 40ms
		'10000': 80,   // Observed: 8-16ms, threshold: 80ms
		'20000': 150   // Observed: 18-29ms, threshold: 150ms
	},
	fuzzySearch: {
		simple: 20,    // Observed: < 10ms, threshold: 20ms
		partial: 20,   // Observed: < 10ms, threshold: 20ms
		complex: 30    // Observed: < 10ms, threshold: 30ms
	},
	realtimeUpdate: {
		single: 10,    // Observed: 1-2ms, threshold: 10ms
		batch: 100     // Observed: 43-45ms, threshold: 100ms
	}
};

// Tag densities for cache loading tests
const TAG_DENSITIES = {
	none: 0,      // No tags
	medium: 0.5,  // 50% of files have tags
	high: 1.0     // 100% of files have tags
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock TFile with specified path
 */
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

/**
 * Creates a mock TFolder with specified path
 */
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

/**
 * Generates realistic tags for a file
 */
function generateTags(tagDensity: number): string[] {
	if (Math.random() > tagDensity) {
		return [];
	}

	const tagPool = [
		'project', 'meeting', 'todo', 'important', 'archive',
		'personal', 'work', 'research', 'ideas', 'reference',
		'daily-note', 'weekly-review', 'planning', 'documentation',
		'code', 'design', 'frontend', 'backend', 'testing'
	];

	const numTags = Math.floor(Math.random() * 3) + 1; // 1-3 tags per file
	const tags: string[] = [];

	for (let i = 0; i < numTags; i++) {
		const tag = tagPool[Math.floor(Math.random() * tagPool.length)];
		if (!tags.includes(tag)) {
			tags.push(`#${tag}`);
		}
	}

	return tags;
}

/**
 * Generates a vault with specified parameters
 */
function generateVault(config: {
	fileCount: number;
	tagDensity: number;
	folderDepth?: 'flat' | 'medium' | 'deep';
}): {
	files: TFile[];
	folders: TFolder[];
	allItems: TAbstractFile[];
	tagMap: Map<string, string[]>;
} {
	const files: TFile[] = [];
	const folders: TFolder[] = [];
	const allItems: TAbstractFile[] = [];
	const tagMap = new Map<string, string[]>();

	// Generate folder structure based on depth configuration
	const folderDepth = config.folderDepth || 'medium';
	const folderPaths: string[] = [];

	if (folderDepth === 'flat') {
		// Flat structure: 5-10 top-level folders
		const folderNames = ['Notes', 'Projects', 'Archive', 'Daily', 'Resources', 'Personal', 'Work', 'Research'];
		folderPaths.push(...folderNames);
	} else if (folderDepth === 'medium') {
		// Medium structure: 2-3 levels deep
		const topFolders = ['Notes', 'Projects', 'Archive', 'Daily', 'Resources'];
		topFolders.forEach(top => {
			folderPaths.push(top);
			for (let i = 0; i < 3; i++) {
				folderPaths.push(`${top}/Subfolder-${i}`);
			}
		});
	} else {
		// Deep structure: 3-5 levels deep
		const topFolders = ['Notes', 'Projects', 'Archive'];
		topFolders.forEach(top => {
			folderPaths.push(top);
			for (let i = 0; i < 5; i++) {
				const level2 = `${top}/Category-${i}`;
				folderPaths.push(level2);
				for (let j = 0; j < 3; j++) {
					folderPaths.push(`${level2}/Subcategory-${j}`);
				}
			}
		});
	}

	// Create folder objects
	folderPaths.forEach(path => {
		const folder = createMockFolder(path);
		folders.push(folder);
		allItems.push(folder);
	});

	// Generate files distributed across folders
	for (let i = 0; i < config.fileCount; i++) {
		const folderPath = folderPaths[Math.floor(Math.random() * folderPaths.length)];
		const path = `${folderPath}/note-${i}.md`;

		const file = createMockFile(path);
		files.push(file);
		allItems.push(file);

		// Generate tags for this file
		const tags = generateTags(config.tagDensity);
		tagMap.set(path, tags);
	}

	return { files, folders, allItems, tagMap };
}

/**
 * Configures mocks with generated vault data
 */
function setupVaultMocks(
	files: TFile[],
	folders: TFolder[],
	allItems: TAbstractFile[],
	tagMap: Map<string, string[]>
): void {
	(mockVault.getMarkdownFiles as ReturnType<typeof vi.fn>).mockReturnValue(files);

	(mockVault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
		if (path === '/' || path === '') return createMockFolder('/', allItems);
		return allItems.find(f => f.path === path) || null;
	});

	// Mock metadata cache for tags
	(mockMetadataCache.getCache as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
		const tags = tagMap.get(path);
		if (!tags || tags.length === 0) return null;

		return {
			tags: tags.map(tag => ({ tag, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }))
		};
	});

	// Mock folder traversal
	(mockVault.adapter.list as ReturnType<typeof vi.fn>).mockResolvedValue({
		files: files.map(f => f.path),
		folders: folders.map(f => f.path)
	});
}

/**
 * Sets up VaultService with mock implementation
 */
function setupVaultService(allItems: TAbstractFile[]): void {
	// Mock listDirectoryContents to return all items
	vaultService.listDirectoryContents = vi.fn().mockResolvedValue(allItems);
	vaultService.isExclusion = vi.fn().mockReturnValue(false);

	// Capture file event handler
	vaultService.registerFileEvents = vi.fn((handler) => {
		fileEventHandler = handler;
	});
}

/**
 * Measures initial cache loading performance
 */
async function measureCacheLoading(): Promise<{
	duration: number;
	memoryUsed: number;
	tagCount: number;
	fileCount: number;
	folderCount: number;
}> {
	// Force garbage collection if available
	if (global.gc) {
		global.gc();
	}

	const memBefore = process.memoryUsage().heapUsed;
	const startTime = performance.now();

	// Trigger cache setup by calling the resolved handler
	await resolvedHandler();

	const duration = performance.now() - startTime;
	const memAfter = process.memoryUsage().heapUsed;
	const memoryUsed = memAfter - memBefore;

	// Access internal state for verification (using type assertion)
	const service = vaultCacheService as any;
	const tagCount = service.tags.size;
	const fileCount = service.files.size;
	const folderCount = service.folders.size;

	return {
		duration,
		memoryUsed,
		tagCount,
		fileCount,
		folderCount
	};
}

/**
 * Measures fuzzy search performance
 */
function measureFuzzySearch(
	searchFn: (input: string) => any,
	query: string
): {
	duration: number;
	resultCount: number;
} {
	const startTime = performance.now();
	const results = searchFn(query);
	const duration = performance.now() - startTime;

	return {
		duration,
		resultCount: results.length
	};
}

/**
 * Creates an initial cache loading test
 */
function createCacheLoadingTest(
	fileCount: number,
	tagDensity: number,
	tagDensityLabel: string
) {
	return async () => {
		// Generate vault
		const { files, folders, allItems, tagMap } = generateVault({ fileCount, tagDensity });
		setupVaultMocks(files, folders, allItems, tagMap);
		setupVaultService(allItems);

		// Create fresh service instance
		vaultCacheService = new VaultCacheService();

		// Measure performance
		const metrics = await measureCacheLoading();

		// Log results
		console.log(`  📊 ${fileCount.toLocaleString()} files, ${tagDensityLabel} tags: ${metrics.duration.toFixed(0)}ms (${metrics.tagCount} tags, ${metrics.fileCount} files, ${metrics.folderCount} folders)`);

		// Assertions
		expect(metrics.fileCount).toBe(fileCount);
		expect(metrics.folderCount).toBeGreaterThan(0);

		const thresholdKey = String(fileCount) as keyof typeof PERFORMANCE_THRESHOLDS.initialCache;
		if (PERFORMANCE_THRESHOLDS.initialCache[thresholdKey]) {
			expect(metrics.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.initialCache[thresholdKey]);
		}

		// Memory should be reasonable (< 500MB)
		expect(metrics.memoryUsed).toBeLessThan(500 * 1024 * 1024);
	};
}

/**
 * Creates a fuzzy search test
 */
function createFuzzySearchTest(
	fileCount: number,
	searchType: 'tag' | 'file' | 'folder',
	query: string,
	queryLabel: string,
	folderDepth?: 'flat' | 'medium' | 'deep'
) {
	return async () => {
		// Generate vault
		const config = {
			fileCount,
			tagDensity: 0.5, // Medium tag density for search tests
			folderDepth
		};
		const { files, folders, allItems, tagMap } = generateVault(config);
		setupVaultMocks(files, folders, allItems, tagMap);
		setupVaultService(allItems);

		// Create and initialize service
		vaultCacheService = new VaultCacheService();
		await resolvedHandler();

		// Select search function
		const searchFn = searchType === 'tag' ? (q: string) => vaultCacheService.matchTag(q) :
		                 searchType === 'file' ? (q: string) => vaultCacheService.matchFile(q) :
		                 (q: string) => vaultCacheService.matchFolder(q);

		// Measure search performance
		const metrics = measureFuzzySearch(searchFn, query);

		// Log results
		const contextInfo = folderDepth ? `, ${folderDepth} folders` : '';
		console.log(`  📊 ${fileCount.toLocaleString()} files, ${queryLabel} query${contextInfo}: ${metrics.duration.toFixed(2)}ms (${metrics.resultCount} results)`);

		// Assertions
		expect(metrics.resultCount).toBeLessThanOrEqual(10); // fuzzysort limit
		expect(metrics.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.fuzzySearch[queryLabel as keyof typeof PERFORMANCE_THRESHOLDS.fuzzySearch]);
	};
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
	DeregisterAllServices();

	// Register services
	RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);
	RegisterSingleton(Services.SanitiserService, new SanitiserService());

	// Mock EventService and DiffService to avoid Obsidian Events dependency
	const mockEventService = { trigger: vi.fn(), on: vi.fn(), off: vi.fn() };
	const mockDiffService = {
		requestDiff: vi.fn().mockResolvedValue({ accepted: true }),
		onAccept: vi.fn(),
		onReject: vi.fn(),
		onSuggest: vi.fn()
	};
	RegisterSingleton(Services.EventService, mockEventService as any);
	RegisterSingleton(Services.DiffService, mockDiffService as any);

	// Create settings service
	settingsService = new SettingsService(mockSettings);
	RegisterSingleton(Services.SettingsService, settingsService);

	// Create vault service
	vaultService = new VaultService();
	RegisterSingleton(Services.VaultService, vaultService);

	// Capture the metadata resolved handler
	(mockMetadataCache.on as ReturnType<typeof vi.fn>).mockImplementation((event: string, handler: any) => {
		if (event === 'resolved') {
			resolvedHandler = handler;
		}
	});

	// Reset mocks
	vi.clearAllMocks();
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('VaultCacheService Performance Tests', () => {
	// Extend timeout for performance tests
	const PERFORMANCE_TIMEOUT = 30000;

	// ========================================================================
	// Initial Cache Loading Performance
	// ========================================================================
	describe('Initial Cache Loading Performance', () => {
		describe('1,000 files', () => {
			const fileCount = 1000;

			it('no tags (0%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.none, 'no'),
				PERFORMANCE_TIMEOUT
			);

			it('medium tag density (50%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.medium, 'medium'),
				PERFORMANCE_TIMEOUT
			);

			it('high tag density (100%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.high, 'high'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('5,000 files', () => {
			const fileCount = 5000;

			it('no tags (0%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.none, 'no'),
				PERFORMANCE_TIMEOUT
			);

			it('medium tag density (50%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.medium, 'medium'),
				PERFORMANCE_TIMEOUT
			);

			it('high tag density (100%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.high, 'high'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('10,000 files', () => {
			const fileCount = 10000;

			it('no tags (0%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.none, 'no'),
				PERFORMANCE_TIMEOUT
			);

			it('medium tag density (50%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.medium, 'medium'),
				PERFORMANCE_TIMEOUT
			);

			it('high tag density (100%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.high, 'high'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('20,000 files', () => {
			const fileCount = 20000;

			it('no tags (0%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.none, 'no'),
				PERFORMANCE_TIMEOUT
			);

			it('medium tag density (50%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.medium, 'medium'),
				PERFORMANCE_TIMEOUT
			);

			it('high tag density (100%)',
				createCacheLoadingTest(fileCount, TAG_DENSITIES.high, 'high'),
				PERFORMANCE_TIMEOUT
			);
		});
	});

	// ========================================================================
	// Fuzzy Search Performance - matchTag
	// ========================================================================
	describe('Fuzzy Search Performance - matchTag', () => {
		const queries = {
			simple: 'project',
			partial: 'proj',
			complex: 'important-meeting'
		};

		describe('1,000 files', () => {
			const fileCount = 1000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'tag', queries.simple, 'simple'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'tag', queries.partial, 'partial'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'tag', queries.complex, 'complex'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('5,000 files', () => {
			const fileCount = 5000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'tag', queries.simple, 'simple'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'tag', queries.partial, 'partial'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'tag', queries.complex, 'complex'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('10,000 files', () => {
			const fileCount = 10000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'tag', queries.simple, 'simple'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'tag', queries.partial, 'partial'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'tag', queries.complex, 'complex'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('20,000 files', () => {
			const fileCount = 20000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'tag', queries.simple, 'simple'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'tag', queries.partial, 'partial'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'tag', queries.complex, 'complex'),
				PERFORMANCE_TIMEOUT
			);
		});
	});

	// ========================================================================
	// Fuzzy Search Performance - matchFile
	// ========================================================================
	describe('Fuzzy Search Performance - matchFile', () => {
		const queries = {
			simple: 'note',
			partial: 'not',
			complex: 'note-1234'
		};

		describe('1,000 files', () => {
			const fileCount = 1000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'file', queries.simple, 'simple'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'file', queries.partial, 'partial'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'file', queries.complex, 'complex'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('5,000 files', () => {
			const fileCount = 5000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'file', queries.simple, 'simple'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'file', queries.partial, 'partial'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'file', queries.complex, 'complex'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('10,000 files', () => {
			const fileCount = 10000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'file', queries.simple, 'simple'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'file', queries.partial, 'partial'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'file', queries.complex, 'complex'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('20,000 files', () => {
			const fileCount = 20000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'file', queries.simple, 'simple'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'file', queries.partial, 'partial'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'file', queries.complex, 'complex'),
				PERFORMANCE_TIMEOUT
			);
		});
	});

	// ========================================================================
	// Fuzzy Search Performance - matchFolder
	// ========================================================================
	describe('Fuzzy Search Performance - matchFolder', () => {
		const queries = {
			simple: 'Notes',
			partial: 'Not',
			complex: 'Projects/Category'
		};

		describe('Flat folder structure (100 files)', () => {
			const fileCount = 100; // Small file count to focus on folder performance

			it('simple query',
				createFuzzySearchTest(fileCount, 'folder', queries.simple, 'simple', 'flat'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'folder', queries.partial, 'partial', 'flat'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'folder', queries.complex, 'complex', 'flat'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('Medium folder structure (1,000 files)', () => {
			const fileCount = 1000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'folder', queries.simple, 'simple', 'medium'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'folder', queries.partial, 'partial', 'medium'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'folder', queries.complex, 'complex', 'medium'),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('Deep folder structure (5,000 files)', () => {
			const fileCount = 5000;

			it('simple query',
				createFuzzySearchTest(fileCount, 'folder', queries.simple, 'simple', 'deep'),
				PERFORMANCE_TIMEOUT
			);

			it('partial query',
				createFuzzySearchTest(fileCount, 'folder', queries.partial, 'partial', 'deep'),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createFuzzySearchTest(fileCount, 'folder', queries.complex, 'complex', 'deep'),
				PERFORMANCE_TIMEOUT
			);
		});
	});

	// ========================================================================
	// Real-time Update Performance
	// ========================================================================
	describe('Real-time Update Performance', () => {
		it('single file creation with tags', async () => {
			// Setup initial cache with 1000 files
			const { files, folders, allItems, tagMap } = generateVault({ fileCount: 1000, tagDensity: 0.5 });
			setupVaultMocks(files, folders, allItems, tagMap);
			setupVaultService(allItems);

			vaultCacheService = new VaultCacheService();
			await resolvedHandler();

			// Create new file
			const newFile = createMockFile('Notes/new-file.md');
			const newTags = ['#urgent', '#todo'];
			tagMap.set(newFile.path, newTags);

			// Update mock to return new tags
			(mockMetadataCache.getCache as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
				const tags = tagMap.get(path);
				if (!tags || tags.length === 0) return null;
				return {
					tags: tags.map(tag => ({ tag, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }))
				};
			});

			// Measure file event handling performance
			const startTime = performance.now();
			fileEventHandler('create', newFile, {});
			const duration = performance.now() - startTime;

			console.log(`  📊 Single file creation: ${duration.toFixed(2)}ms`);

			expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.realtimeUpdate.single);
		}, PERFORMANCE_TIMEOUT);

		it('batch file creation (100 files)', async () => {
			// Setup initial cache with 1000 files
			const { files, folders, allItems, tagMap } = generateVault({ fileCount: 1000, tagDensity: 0.5 });
			setupVaultMocks(files, folders, allItems, tagMap);
			setupVaultService(allItems);

			vaultCacheService = new VaultCacheService();
			await resolvedHandler();

			// Create 100 new files
			const newFiles: TFile[] = [];
			for (let i = 0; i < 100; i++) {
				const newFile = createMockFile(`Notes/batch-file-${i}.md`);
				const newTags = generateTags(0.5);
				tagMap.set(newFile.path, newTags);
				newFiles.push(newFile);
			}

			// Measure batch file event handling performance
			const startTime = performance.now();
			newFiles.forEach(file => {
				fileEventHandler('create', file, {});
			});
			const duration = performance.now() - startTime;

			console.log(`  📊 Batch file creation (100 files): ${duration.toFixed(0)}ms`);

			expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.realtimeUpdate.batch);
		}, PERFORMANCE_TIMEOUT);

		it('batch tag updates (100 files)', async () => {
			// Setup initial cache with 1000 files
			const { files, folders, allItems, tagMap } = generateVault({ fileCount: 1000, tagDensity: 0.5 });
			setupVaultMocks(files, folders, allItems, tagMap);
			setupVaultService(allItems);

			vaultCacheService = new VaultCacheService();
			await resolvedHandler();

			// Update tags on 100 existing files
			const filesToUpdate = files.slice(0, 100);

			// Measure batch tag update performance
			const startTime = performance.now();
			filesToUpdate.forEach(file => {
				const newTags = generateTags(1.0); // Generate new tags
				tagMap.set(file.path, newTags);
				fileEventHandler('modify', file, {});
			});
			const duration = performance.now() - startTime;

			console.log(`  📊 Batch tag updates (100 files): ${duration.toFixed(0)}ms`);

			expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.realtimeUpdate.batch);
		}, PERFORMANCE_TIMEOUT);

		it('batch file renames (100 files)', async () => {
			// Setup initial cache with 1000 files
			const { files, folders, allItems, tagMap } = generateVault({ fileCount: 1000, tagDensity: 0.5 });
			setupVaultMocks(files, folders, allItems, tagMap);
			setupVaultService(allItems);

			vaultCacheService = new VaultCacheService();
			await resolvedHandler();

			// Rename 100 files
			const filesToRename = files.slice(0, 100);

			// Measure batch rename performance
			const startTime = performance.now();
			filesToRename.forEach((file, index) => {
				const oldPath = file.path;
				const newPath = file.path.replace(/note-\d+/, `renamed-${index}`);
				file.path = newPath;
				fileEventHandler('rename', file, { oldPath });
			});
			const duration = performance.now() - startTime;

			console.log(`  📊 Batch file renames (100 files): ${duration.toFixed(0)}ms`);

			expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.realtimeUpdate.batch);
		}, PERFORMANCE_TIMEOUT);

		it('batch folder operations (50 folders)', async () => {
			// Setup initial cache with 1000 files
			const { files, folders, allItems, tagMap } = generateVault({ fileCount: 1000, tagDensity: 0.5, folderDepth: 'medium' });
			setupVaultMocks(files, folders, allItems, tagMap);
			setupVaultService(allItems);

			vaultCacheService = new VaultCacheService();
			await resolvedHandler();

			// Create 50 new folders
			const newFolders: TFolder[] = [];
			for (let i = 0; i < 50; i++) {
				const newFolder = createMockFolder(`Notes/NewFolder-${i}`);
				newFolders.push(newFolder);
			}

			// Measure batch folder creation performance
			const startTime = performance.now();
			newFolders.forEach(folder => {
				fileEventHandler('create', folder, {});
			});
			const duration = performance.now() - startTime;

			console.log(`  📊 Batch folder creation (50 folders): ${duration.toFixed(0)}ms`);

			expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.realtimeUpdate.batch);
		}, PERFORMANCE_TIMEOUT);

		it('mixed operations (files + folders + updates)', async () => {
			// Setup initial cache with 1000 files
			const { files, folders, allItems, tagMap } = generateVault({ fileCount: 1000, tagDensity: 0.5 });
			setupVaultMocks(files, folders, allItems, tagMap);
			setupVaultService(allItems);

			vaultCacheService = new VaultCacheService();
			await resolvedHandler();

			// Perform mixed operations
			const startTime = performance.now();

			// 20 file creates
			for (let i = 0; i < 20; i++) {
				const newFile = createMockFile(`Notes/mixed-file-${i}.md`);
				const newTags = generateTags(0.5);
				tagMap.set(newFile.path, newTags);
				fileEventHandler('create', newFile, {});
			}

			// 20 tag updates
			files.slice(0, 20).forEach(file => {
				const newTags = generateTags(1.0);
				tagMap.set(file.path, newTags);
				fileEventHandler('modify', file, {});
			});

			// 20 renames
			files.slice(20, 40).forEach((file, index) => {
				const oldPath = file.path;
				const newPath = file.path.replace(/note-\d+/, `mixed-renamed-${index}`);
				file.path = newPath;
				fileEventHandler('rename', file, { oldPath });
			});

			// 20 folder creates
			for (let i = 0; i < 20; i++) {
				const newFolder = createMockFolder(`Projects/MixedFolder-${i}`);
				fileEventHandler('create', newFolder, {});
			}

			const duration = performance.now() - startTime;

			console.log(`  📊 Mixed operations (80 total): ${duration.toFixed(0)}ms`);

			expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.realtimeUpdate.batch);
		}, PERFORMANCE_TIMEOUT);
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile, TFolder, TAbstractFile, Vault, FileManager } from 'obsidian';
import { VaultService } from '../../Services/VaultService';
import { SettingsService, IVaultkeeperAISettings } from '../../Services/SettingsService';
import { SanitiserService } from '../../Services/SanitiserService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIProviderModel } from '../../Enums/ApiProvider';
import type VaultkeeperAIPlugin from '../../main';

/**
 * Performance Test Suite for VaultService.searchVaultFiles()
 *
 * Tests the search performance on extremely large vaults (up to 20,000 files)
 * with various query patterns and content characteristics.
 *
 * Test Matrix:
 * - Scale Testing: 1K, 5K, 10K, 20K files × 4 query patterns = 16 tests
 * - Content Size: 3 distributions × 4 query patterns = 12 tests
 * - Match Density: 3 densities × 4 query patterns = 12 tests
 * - Real-world Benchmark: 4 tests
 *
 * Total: 44 performance tests
 */

// ============================================================================
// Mock Setup
// ============================================================================

const mockVault = {
	getMarkdownFiles: vi.fn(),
	getAbstractFileByPath: vi.fn(),
	cachedRead: vi.fn(),
	read: vi.fn(),
	adapter: {
		list: vi.fn()
	}
} as unknown as Vault;

const mockFileManager = {
	processFrontMatter: vi.fn()
} as unknown as FileManager;

const mockPlugin = {
	app: {
		vault: mockVault,
		fileManager: mockFileManager
	}
} as unknown as VaultkeeperAIPlugin;

const mockSettings: IVaultkeeperAISettings = {
	firstTimeStart: false,
	model: AIProviderModel.ClaudeSonnet_4_5,
	apiKeys: {
		claude: 'test-claude-key',
		openai: 'test-openai-key',
		gemini: 'test-gemini-key'
	},
	exclusions: [],
	userInstruction: '',
	searchResultsLimit: 15,
	snippetSizeLimit: 300
};

let settingsService: SettingsService;
let vaultService: VaultService;

// ============================================================================
// Test Configuration
// ============================================================================

const QUERY_PATTERNS = {
	simple: 'test',
	medium: 'project meeting',
	complex: '/\\b(docker|kubernetes|k8s)\\b/i',
	wildcard: '/.{20,50} important/'
} as const;

type QueryPattern = keyof typeof QUERY_PATTERNS;

// Performance thresholds (milliseconds) for 20K files
// These thresholds reflect optimized performance with early termination and efficient search
const PERFORMANCE_THRESHOLDS = {
	simple: 100,    // Target: < 100ms for simple queries
	medium: 100,    // Target: < 100ms for phrase searches
	complex: 150,   // Target: < 150ms for complex regex patterns
	wildcard: 500   // Target: < 500ms for wildcard patterns
};

// Content size distributions (in characters)
const SIZE_DISTRIBUTIONS = {
	small: { min: 100, max: 500, weight: 1.0 },
	mixed: [
		{ min: 100, max: 500, weight: 0.7 },    // 70% small
		{ min: 1000, max: 10000, weight: 0.25 }, // 25% medium
		{ min: 50000, max: 500000, weight: 0.05 } // 5% large
	],
	large: { min: 50000, max: 500000, weight: 1.0 }
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
 * Creates a mock TFolder with specified path and children
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
 * Generates random content of specified size with controlled match patterns
 */
function generateContent(
	size: number,
	matchDensity: 'none' | 'sparse' | 'dense',
	queryPattern: QueryPattern
): string {
	const matchTerms: Record<QueryPattern, string[]> = {
		simple: ['test'],
		medium: ['project meeting'],
		complex: ['docker', 'kubernetes', 'k8s'],
		wildcard: ['this is some text that is important']
	};

	const terms = matchTerms[queryPattern];
	const matchesNeeded =
		matchDensity === 'none' ? 0 :
		matchDensity === 'sparse' ? Math.floor(Math.random() * 2) + 1 : // 1-2 matches
		100 + Math.floor(Math.random() * 50); // 100-150 matches

	// Base content templates
	const templates = [
		'This is a typical note in an Obsidian vault. ',
		'Meeting notes from today. ',
		'Technical documentation for the project. ',
		'Research findings and analysis. ',
		'Code snippets and examples. ',
		'Personal thoughts and reflections. ',
		'Task list and project planning. '
	];

	let content = '';
	let matchesAdded = 0;

	// Build content to target size
	while (content.length < size) {
		// Add match terms at appropriate density
		if (matchesAdded < matchesNeeded && Math.random() < 0.1) {
			const term = terms[Math.floor(Math.random() * terms.length)];
			content += term + ' ';
			matchesAdded++;
		} else {
			// Add filler content
			const template = templates[Math.floor(Math.random() * templates.length)];
			content += template;
		}
	}

	return content.substring(0, size);
}

/**
 * Determines content size based on distribution configuration
 */
function getContentSize(distribution: 'small' | 'mixed' | 'large'): number {
	const config = SIZE_DISTRIBUTIONS[distribution];

	if (Array.isArray(config)) {
		// Mixed distribution - weighted random selection
		const rand = Math.random();
		let cumulative = 0;

		for (const option of config) {
			cumulative += option.weight;
			if (rand <= cumulative) {
				return Math.floor(Math.random() * (option.max - option.min)) + option.min;
			}
		}
		// Fallback to first option
		return Math.floor(Math.random() * (config[0].max - config[0].min)) + config[0].min;
	} else {
		// Single size range
		return Math.floor(Math.random() * (config.max - config.min)) + config.min;
	}
}

/**
 * Generates a complete mock vault with specified parameters
 */
function generateVault(config: {
	fileCount: number;
	sizeDistribution: 'small' | 'mixed' | 'large';
	matchDensity: 'none' | 'sparse' | 'dense';
	queryPattern: QueryPattern;
}): { files: TFile[]; rootFolder: TFolder; contentMap: Map<string, string> } {
	const files: TFile[] = [];
	const contentMap = new Map<string, string>();

	// Generate hierarchical folder structure (simulate realistic vault)
	const folders = ['Notes', 'Projects', 'Archive', 'Daily', 'Resources'];

	for (let i = 0; i < config.fileCount; i++) {
		// Create realistic path
		const folder = folders[Math.floor(Math.random() * folders.length)];
		const subfolder = i % 10 === 0 ? `/${folder}-${Math.floor(i / 100)}` : '';
		const path = `${folder}${subfolder}/note-${i}.md`;

		const file = createMockFile(path);
		files.push(file);

		// Generate content for this file
		const size = getContentSize(config.sizeDistribution);
		const content = generateContent(size, config.matchDensity, config.queryPattern);
		contentMap.set(path, content);
	}

	// Create root folder containing all files
	const rootFolder = createMockFolder('/', files);

	return { files, rootFolder, contentMap };
}

/**
 * Configures mocks with generated vault data
 */
function setupVaultMocks(
	files: TFile[],
	rootFolder: TFolder,
	contentMap: Map<string, string>
): void {
	(mockVault.getMarkdownFiles as ReturnType<typeof vi.fn>).mockReturnValue(files);

	(mockVault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
		if (path === '/' || path === '') return rootFolder;
		return files.find(f => f.path === path) || null;
	});

	(mockVault.cachedRead as ReturnType<typeof vi.fn>).mockImplementation((file: TFile) => {
		const content = contentMap.get(file.path) || '';
		return Promise.resolve(content);
	});

	// Mock folder traversal
	(mockVault.adapter.list as ReturnType<typeof vi.fn>).mockResolvedValue({
		files: files.map(f => f.path),
		folders: []
	});
}

/**
 * Measures search performance and returns metrics
 */
async function measureSearch(
	queryPattern: QueryPattern
): Promise<{
	duration: number;
	resultCount: number;
	memoryUsed: number;
}> {
	// Force garbage collection if available (requires --expose-gc flag)
	if (global.gc) {
		global.gc();
	}

	const memBefore = process.memoryUsage().heapUsed;
	const startTime = performance.now();

	const results = await vaultService.searchVaultFiles(
		QUERY_PATTERNS[queryPattern],
		false
	);

	const duration = performance.now() - startTime;
	const memAfter = process.memoryUsage().heapUsed;
	const memoryUsed = memAfter - memBefore;

	return {
		duration,
		resultCount: results.length,
		memoryUsed
	};
}

/**
 * Creates a performance test with specified parameters
 */
function createPerformanceTest(
	config: {
		fileCount: number;
		sizeDistribution: 'small' | 'mixed' | 'large';
		matchDensity: 'none' | 'sparse' | 'dense';
		queryPattern: QueryPattern;
		threshold?: number;
	}
) {
	return async () => {
		// Generate vault
		const { files, rootFolder, contentMap } = generateVault(config);
		setupVaultMocks(files, rootFolder, contentMap);

		// Measure performance
		const metrics = await measureSearch(config.queryPattern);

		// Log results for visibility
		console.log(`  📊 ${config.fileCount.toLocaleString()} files, ${config.queryPattern} query: ${metrics.duration.toFixed(0)}ms (${metrics.resultCount} results)`);

		// Assertions
		expect(metrics.resultCount).toBeLessThanOrEqual(
			settingsService.settings.searchResultsLimit
		);

		if (config.threshold) {
			expect(metrics.duration).toBeLessThan(config.threshold);
		}

		// Memory should be reasonable (< 500MB for any test)
		expect(metrics.memoryUsed).toBeLessThan(500 * 1024 * 1024);
	};
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
	DeregisterAllServices();

	// Register services
	RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);
	RegisterSingleton(Services.FileManager, mockFileManager);
	RegisterSingleton(Services.SanitiserService, new SanitiserService());

	// Create settings service with test configuration
	settingsService = new SettingsService(mockSettings);
	RegisterSingleton(Services.SettingsService, settingsService);

	// Create vault service
	vaultService = new VaultService();

	// Reset mocks
	vi.clearAllMocks();
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('VaultService Performance Tests', () => {
	// Extend timeout for performance tests
	const PERFORMANCE_TIMEOUT = 30000;

	// ========================================================================
	// Scale Testing (Fixed: Mixed content, Sparse matches)
	// ========================================================================
	describe('Scale Testing - Mixed Content, Sparse Matches', () => {
		const baseConfig = {
			sizeDistribution: 'mixed' as const,
			matchDensity: 'sparse' as const
		};

		describe('1,000 files', () => {
			const fileCount = 1000;

			it('simple query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('5,000 files', () => {
			const fileCount = 5000;

			it('simple query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('10,000 files', () => {
			const fileCount = 10000;

			it('simple query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, fileCount, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('20,000 files', () => {
			const fileCount = 20000;

			it('simple query',
				createPerformanceTest({
					...baseConfig,
					fileCount,
					queryPattern: 'simple',
					threshold: PERFORMANCE_THRESHOLDS.simple
				}),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({
					...baseConfig,
					fileCount,
					queryPattern: 'medium',
					threshold: PERFORMANCE_THRESHOLDS.medium
				}),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({
					...baseConfig,
					fileCount,
					queryPattern: 'complex',
					threshold: PERFORMANCE_THRESHOLDS.complex
				}),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({
					...baseConfig,
					fileCount,
					queryPattern: 'wildcard',
					threshold: PERFORMANCE_THRESHOLDS.wildcard
				}),
				PERFORMANCE_TIMEOUT
			);
		});
	});

	// ========================================================================
	// Content Size Testing (Fixed: 10K files, Sparse matches)
	// ========================================================================
	describe('Content Size Variations - 10K Files, Sparse Matches', () => {
		const baseConfig = {
			fileCount: 10000,
			matchDensity: 'sparse' as const
		};

		describe('Small-heavy (90% < 1KB)', () => {
			const sizeDistribution = 'small' as const;

			it('simple query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('Mixed (70% small, 25% medium, 5% large)', () => {
			const sizeDistribution = 'mixed' as const;

			it('simple query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('Large-heavy (30% > 50KB)', () => {
			const sizeDistribution = 'large' as const;

			it('simple query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, sizeDistribution, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});
	});

	// ========================================================================
	// Match Density Testing (Fixed: 10K files, Mixed content)
	// ========================================================================
	describe('Match Density Variations - 10K Files, Mixed Content', () => {
		const baseConfig = {
			fileCount: 10000,
			sizeDistribution: 'mixed' as const
		};

		describe('Dense matches (100+ per file)', () => {
			const matchDensity = 'dense' as const;

			it('simple query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('Sparse matches (1-2 per file)', () => {
			const matchDensity = 'sparse' as const;

			it('simple query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});

		describe('No matches (baseline)', () => {
			const matchDensity = 'none' as const;

			it('simple query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'simple' }),
				PERFORMANCE_TIMEOUT
			);

			it('medium query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'medium' }),
				PERFORMANCE_TIMEOUT
			);

			it('complex query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'complex' }),
				PERFORMANCE_TIMEOUT
			);

			it('wildcard query',
				createPerformanceTest({ ...baseConfig, matchDensity, queryPattern: 'wildcard' }),
				PERFORMANCE_TIMEOUT
			);
		});
	});

	// ========================================================================
	// Real-world Benchmark (20K files, Mixed content, Sparse matches)
	// ========================================================================
	describe('Real-world Benchmark - 20K Files, Mixed Content, Sparse Matches', () => {
		const baseConfig = {
			fileCount: 20000,
			sizeDistribution: 'mixed' as const,
			matchDensity: 'sparse' as const
		};

		it('simple query - comprehensive benchmark',
			createPerformanceTest({
				...baseConfig,
				queryPattern: 'simple',
				threshold: PERFORMANCE_THRESHOLDS.simple
			}),
			PERFORMANCE_TIMEOUT
		);

		it('medium query - comprehensive benchmark',
			createPerformanceTest({
				...baseConfig,
				queryPattern: 'medium',
				threshold: PERFORMANCE_THRESHOLDS.medium
			}),
			PERFORMANCE_TIMEOUT
		);

		it('complex query - comprehensive benchmark',
			createPerformanceTest({
				...baseConfig,
				queryPattern: 'complex',
				threshold: PERFORMANCE_THRESHOLDS.complex
			}),
			PERFORMANCE_TIMEOUT
		);

		it('wildcard query - comprehensive benchmark',
			createPerformanceTest({
				...baseConfig,
				queryPattern: 'wildcard',
				threshold: PERFORMANCE_THRESHOLDS.wildcard
			}),
			PERFORMANCE_TIMEOUT
		);
	});
});

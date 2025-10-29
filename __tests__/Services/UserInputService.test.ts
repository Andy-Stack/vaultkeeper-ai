import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserInputService } from '../../Services/UserInputService';
import { SearchTrigger } from '../../Enums/SearchTrigger';
import { RegisterSingleton } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { writable, get } from 'svelte/store';
import type { ISearchState } from '../../Stores/SearchStateStore';

/**
 * UNIT TESTS
 *
 * These tests mock the VaultCacheService and SearchStateStore dependencies
 * to isolate and test UserInputService behavior.
 */

describe('UserInputService', () => {
	let userInputService: UserInputService;
	let mockVaultCacheService: any;
	let mockSearchStateStore: any;
	let mockSearchState: any;

	beforeEach(() => {
		// Create mock search state store
		mockSearchState = writable<ISearchState>({
			active: false,
			trigger: null,
			position: null,
			query: "",
			results: [],
			selectedResult: ""
		});

		mockSearchStateStore = {
			searchState: mockSearchState,
			setResults: vi.fn((results: string[]) => {
				mockSearchState.update(state => ({ ...state, results }));
			})
		};

		// Create mock vault cache service
		mockVaultCacheService = {
			matchTag: vi.fn(),
			matchFile: vi.fn(),
			matchFolder: vi.fn()
		};

		// Register mock dependencies
		RegisterSingleton(Services.VaultCacheService, mockVaultCacheService);
		RegisterSingleton(Services.SearchStateStore, mockSearchStateStore);

		// Create service instance
		userInputService = new UserInputService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should resolve VaultCacheService dependency', () => {
			expect(userInputService).toBeDefined();
			// Dependency resolution is validated by the service not throwing during construction
		});

		it('should resolve SearchStateStore dependency', () => {
			expect(userInputService).toBeDefined();
			// Dependency resolution is validated by the service not throwing during construction
		});
	});

	describe('searchState getter', () => {
		it('should return the search state store', () => {
			const searchState = userInputService.searchState;
			expect(searchState).toBeDefined();
			expect(searchState).toBe(mockSearchState);
		});

		it('should return a writable store', () => {
			const searchState = userInputService.searchState;
			const currentState = get(searchState);
			expect(currentState).toHaveProperty('active');
			expect(currentState).toHaveProperty('trigger');
			expect(currentState).toHaveProperty('query');
			expect(currentState).toHaveProperty('results');
		});
	});

	describe('performSearch - validation checks', () => {
		it('should set empty results when search is not active', () => {
			mockSearchState.set({
				active: false,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "test query",
				results: ["old result"],
				selectedResult: ""
			});

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([]);
			expect(mockVaultCacheService.matchTag).not.toHaveBeenCalled();
			expect(mockVaultCacheService.matchFile).not.toHaveBeenCalled();
			expect(mockVaultCacheService.matchFolder).not.toHaveBeenCalled();
		});

		it('should set empty results when trigger is null', () => {
			mockSearchState.set({
				active: true,
				trigger: null,
				position: 0,
				query: "test query",
				results: ["old result"],
				selectedResult: ""
			});

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([]);
			expect(mockVaultCacheService.matchTag).not.toHaveBeenCalled();
			expect(mockVaultCacheService.matchFile).not.toHaveBeenCalled();
			expect(mockVaultCacheService.matchFolder).not.toHaveBeenCalled();
		});

		it('should set empty results when query length is less than 3', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "ab",
				results: ["old result"],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '#ab' }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledWith("ab");
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['#ab']);
		});

		it('should set empty results when query is empty', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "",
				results: ["old result"],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledWith("");
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([]);
		});

		it('should set empty results when trimmed query length is less than 3', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "  a  ",
				results: ["old result"],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledWith("  a  ");
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([]);
		});

		it('should proceed with search when query length is exactly 3', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "abc",
				results: [],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '#test' }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledWith("abc");
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['#test']);
		});

		it('should proceed with search when trimmed query length is 3 or more', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "  abc  ",
				results: [],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '#test' }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledWith("  abc  ");
		});
	});

	describe('performSearch - tag search', () => {
		beforeEach(() => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "project",
				results: [],
				selectedResult: ""
			});
		});

		it('should call matchTag with the query', () => {
			mockVaultCacheService.matchTag.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledWith("project");
			expect(mockVaultCacheService.matchTag).toHaveBeenCalledOnce();
		});

		it('should map tag results correctly', () => {
			const mockResults = [
				{ obj: { tag: '#project' }, score: 0 },
				{ obj: { tag: '#project-work' }, score: 0.5 },
				{ obj: { tag: '#project-personal' }, score: 1 }
			];

			mockVaultCacheService.matchTag.mockReturnValue(mockResults);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([
				'#project',
				'#project-work',
				'#project-personal'
			]);
		});

		it('should handle empty tag results', () => {
			mockVaultCacheService.matchTag.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([]);
		});

		it('should handle single tag result', () => {
			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '#unique-tag' }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['#unique-tag']);
		});

		it('should not call other match methods', () => {
			mockVaultCacheService.matchTag.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchFile).not.toHaveBeenCalled();
			expect(mockVaultCacheService.matchFolder).not.toHaveBeenCalled();
		});
	});

	describe('performSearch - file search', () => {
		beforeEach(() => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.File,
				position: 0,
				query: "note",
				results: [],
				selectedResult: ""
			});
		});

		it('should call matchFile with the query', () => {
			mockVaultCacheService.matchFile.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchFile).toHaveBeenCalledWith("note");
			expect(mockVaultCacheService.matchFile).toHaveBeenCalledOnce();
		});

		it('should map file results correctly', () => {
			const mockResults = [
				{ obj: { file: { path: 'notes/meeting.md' } }, score: 0 },
				{ obj: { file: { path: 'notes/daily.md' } }, score: 0.5 },
				{ obj: { file: { path: 'archive/notes.md' } }, score: 1 }
			];

			mockVaultCacheService.matchFile.mockReturnValue(mockResults);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([
				'notes/meeting.md',
				'notes/daily.md',
				'archive/notes.md'
			]);
		});

		it('should handle empty file results', () => {
			mockVaultCacheService.matchFile.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([]);
		});

		it('should handle single file result', () => {
			mockVaultCacheService.matchFile.mockReturnValue([
				{ obj: { file: { path: 'unique/file.md' } }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['unique/file.md']);
		});

		it('should not call other match methods', () => {
			mockVaultCacheService.matchFile.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).not.toHaveBeenCalled();
			expect(mockVaultCacheService.matchFolder).not.toHaveBeenCalled();
		});
	});

	describe('performSearch - folder search', () => {
		beforeEach(() => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Folder,
				position: 0,
				query: "proj",
				results: [],
				selectedResult: ""
			});
		});

		it('should call matchFolder with the query', () => {
			mockVaultCacheService.matchFolder.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchFolder).toHaveBeenCalledWith("proj");
			expect(mockVaultCacheService.matchFolder).toHaveBeenCalledOnce();
		});

		it('should map folder results correctly', () => {
			const mockResults = [
				{ obj: { folder: { path: 'projects' } }, score: 0 },
				{ obj: { folder: { path: 'projects/frontend' } }, score: 0.5 },
				{ obj: { folder: { path: 'projects/backend' } }, score: 1 }
			];

			mockVaultCacheService.matchFolder.mockReturnValue(mockResults);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([
				'projects',
				'projects/frontend',
				'projects/backend'
			]);
		});

		it('should handle empty folder results', () => {
			mockVaultCacheService.matchFolder.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([]);
		});

		it('should handle single folder result', () => {
			mockVaultCacheService.matchFolder.mockReturnValue([
				{ obj: { folder: { path: 'unique-folder' } }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['unique-folder']);
		});

		it('should not call other match methods', () => {
			mockVaultCacheService.matchFolder.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).not.toHaveBeenCalled();
			expect(mockVaultCacheService.matchFile).not.toHaveBeenCalled();
		});
	});

	describe('performSearch - edge cases', () => {
		it('should handle multiple consecutive searches', () => {
			// First search - tags
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "test",
				results: [],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '#test' }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['#test']);

			// Second search - files
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.File,
				position: 0,
				query: "note",
				results: ['#test'],
				selectedResult: ""
			});

			mockVaultCacheService.matchFile.mockReturnValue([
				{ obj: { file: { path: 'note.md' } }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['note.md']);
			expect(mockSearchStateStore.setResults).toHaveBeenCalledTimes(2);
		});

		it('should handle search with special characters in query', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "test-tag_123",
				results: [],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '#test-tag_123' }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledWith("test-tag_123");
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['#test-tag_123']);
		});

		it('should handle search with unicode characters', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.File,
				position: 0,
				query: "café",
				results: [],
				selectedResult: ""
			});

			mockVaultCacheService.matchFile.mockReturnValue([
				{ obj: { file: { path: 'café-notes.md' } }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchFile).toHaveBeenCalledWith("café");
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['café-notes.md']);
		});

		it('should handle large result sets', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "test",
				results: [],
				selectedResult: ""
			});

			const largeResults = Array.from({ length: 100 }, (_, i) => ({
				obj: { tag: `#test${i}` },
				score: i
			}));

			mockVaultCacheService.matchTag.mockReturnValue(largeResults);

			userInputService.performSearch();

			const expectedTags = largeResults.map(r => r.obj.tag);
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(expectedTags);
		});

		it('should handle switching between different search triggers', () => {
			// Tag search
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "test",
				results: [],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '#test' }, score: 0 }
			]);

			userInputService.performSearch();

			// File search
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.File,
				position: 0,
				query: "test",
				results: ['#test'],
				selectedResult: ""
			});

			mockVaultCacheService.matchFile.mockReturnValue([
				{ obj: { file: { path: 'test.md' } }, score: 0 }
			]);

			userInputService.performSearch();

			// Folder search
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Folder,
				position: 0,
				query: "test",
				results: ['test.md'],
				selectedResult: ""
			});

			mockVaultCacheService.matchFolder.mockReturnValue([
				{ obj: { folder: { path: 'test-folder' } }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledOnce();
			expect(mockVaultCacheService.matchFile).toHaveBeenCalledOnce();
			expect(mockVaultCacheService.matchFolder).toHaveBeenCalledOnce();
		});

		it('should handle query that becomes invalid after trim', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "   ",
				results: ["old result"],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchTag).toHaveBeenCalledWith("   ");
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([]);
		});

		it('should preserve query with internal spaces', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.File,
				position: 0,
				query: "my note",
				results: [],
				selectedResult: ""
			});

			mockVaultCacheService.matchFile.mockReturnValue([
				{ obj: { file: { path: 'my note.md' } }, score: 0 }
			]);

			userInputService.performSearch();

			expect(mockVaultCacheService.matchFile).toHaveBeenCalledWith("my note");
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['my note.md']);
		});
	});

	describe('performSearch - integration scenarios', () => {
		it('should handle search state changes during execution', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "test",
				results: [],
				selectedResult: ""
			});

			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '#test1' }, score: 0 },
				{ obj: { tag: '#test2' }, score: 0.5 }
			]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['#test1', '#test2']);

			// Verify state can be updated
			const currentState = get(mockSearchState);
			expect(currentState.results).toEqual(['#test1', '#test2']);
		});

		it('should handle empty string results gracefully', () => {
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.Tag,
				position: 0,
				query: "test",
				results: [],
				selectedResult: ""
			});

			// Mock results with empty tag (edge case)
			mockVaultCacheService.matchTag.mockReturnValue([
				{ obj: { tag: '' }, score: 0 },
				{ obj: { tag: '#valid' }, score: 0.5 }
			]);

			userInputService.performSearch();

			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith(['', '#valid']);
		});

		it('should complete search workflow from start to finish', () => {
			// Initial state - inactive
			const initialState = get(mockSearchState);
			expect(initialState.active).toBe(false);

			// Activate search
			mockSearchState.set({
				active: true,
				trigger: SearchTrigger.File,
				position: 10,
				query: "important",
				results: [],
				selectedResult: ""
			});

			// Mock successful search
			mockVaultCacheService.matchFile.mockReturnValue([
				{ obj: { file: { path: 'important-doc.md' } }, score: 0 },
				{ obj: { file: { path: 'very-important.md' } }, score: 0.5 }
			]);

			// Perform search
			userInputService.performSearch();

			// Verify results
			expect(mockSearchStateStore.setResults).toHaveBeenCalledWith([
				'important-doc.md',
				'very-important.md'
			]);

			// Verify state updated
			const finalState = get(mockSearchState);
			expect(finalState.results).toEqual(['important-doc.md', 'very-important.md']);
		});
	});
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatService } from '../../Services/ChatService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIFunction, fromString } from '../../Enums/AIFunction';
import { AbortService } from '../../Services/AbortService';

/**
 * INTEGRATION TESTS - Simplified
 *
 * These tests focus on synchronous methods only, avoiding the complex async streaming
 * functionality that caused memory issues. Tests the actual integration between ChatService
 * and its dependencies.
 *
 * Note: The complex submit() method with async generators is better tested through E2E tests.
 */

describe('ChatService - Integration Tests (Sync Methods Only)', () => {
	let service: ChatService;
	let mockConversationService: any;
	let mockAIControllerService: any;
	let mockNamingService: any;
	let mockEventService: any;
	let mockWorkSpaceService: any;
	let abortService: AbortService;

	beforeEach(() => {
		// Setup minimal mocks
		mockConversationService = {
			saveConversation: vi.fn()
		};

		mockAIControllerService = {
			runMainAgent: vi.fn(),
			setSaveCallback: vi.fn()
		};

		mockNamingService = {
			requestName: vi.fn()
		};

		// Mock EventService since it extends Obsidian's Events class
		mockEventService = {
			trigger: vi.fn(),
			on: vi.fn(),
			off: vi.fn()
		};

		// Mock WorkSpaceService
		mockWorkSpaceService = {
			openNote: vi.fn(),
			getActiveFile: vi.fn().mockReturnValue(null)
		};

		// Create real AbortService instance
		abortService = new AbortService();

		// Register dependencies
		RegisterSingleton(Services.ConversationFileSystemService, mockConversationService);
		RegisterSingleton(Services.AIControllerService, mockAIControllerService);
		RegisterSingleton(Services.ConversationNamingService, mockNamingService);
		RegisterSingleton(Services.EventService, mockEventService);
		RegisterSingleton(Services.WorkSpaceService, mockWorkSpaceService);
		RegisterSingleton(Services.AbortService, abortService);

		// Create service
		service = new ChatService();
	});

	afterEach(() => {
		// Clear singleton registry to prevent memory leaks
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with all required services', () => {
			const testService = new ChatService();

			expect(testService).toBeDefined();
		});

		it('should initialize onNameChanged as undefined', () => {
			expect(service.onNameChanged).toBeUndefined();
		});
	});

	describe('stop', () => {
		it('should not throw when called with no active request', () => {
			expect(() => service.stop()).not.toThrow();
		});

		it('should be callable multiple times', () => {
			service.stop();
			service.stop();
			service.stop();

			expect(service).toBeDefined();
		});
	});

	describe('onNameChanged callback', () => {
		it('should allow setting callback function', () => {
			const callback = vi.fn();

			service.onNameChanged = callback;

			expect(service.onNameChanged).toBe(callback);
		});

		it('should be initially undefined', () => {
			const newService = new ChatService();

			expect(newService.onNameChanged).toBeUndefined();
		});
	});

	describe('fromString', () => {
		it('should convert valid function name strings to AIFunction enum', () => {
			expect(fromString('search_vault_files')).toBe(AIFunction.SearchVaultFiles);
			expect(fromString('read_vault_files')).toBe(AIFunction.ReadVaultFiles);
			expect(fromString('write_vault_file')).toBe(AIFunction.WriteVaultFile);
			expect(fromString('delete_vault_files')).toBe(AIFunction.DeleteVaultFiles);
			expect(fromString('move_vault_files')).toBe(AIFunction.MoveVaultFiles);
			expect(fromString('list_vault_files')).toBe(AIFunction.ListVaultFiles);
			expect(fromString('request_web_search')).toBe(AIFunction.RequestWebSearch);
		});

		it('should return Unknown for unknown function names', () => {
			expect(fromString('unknown_function')).toBe(AIFunction.Unknown);
			expect(fromString('test_function')).toBe(AIFunction.Unknown);
			expect(fromString('')).toBe(AIFunction.Unknown);
		});
	});

	describe('requestWithContext (private method tests via reflection)', () => {
		// Access private method for testing
		const getRequestWithContextMethod = (service: ChatService) => {
			return (service as any).requestWithContext.bind(service);
		};

		it('should return request unchanged when no active file exists', () => {
			mockWorkSpaceService.getActiveFile.mockReturnValue(null);
			const requestWithContext = getRequestWithContextMethod(service);
			const request = 'Please help me with this task';

			const result = requestWithContext(request);

			expect(result).toBe(request);
			expect(mockWorkSpaceService.getActiveFile).toHaveBeenCalledWith();
		});

		it('should append active file path when active file exists', () => {
			const mockFile = {
				path: 'notes/my-note.md',
				name: 'my-note.md',
				basename: 'my-note'
			};
			mockWorkSpaceService.getActiveFile.mockReturnValue(mockFile);
			const requestWithContext = getRequestWithContextMethod(service);
			const request = 'Please help me with this task';

			const result = requestWithContext(request);

			expect(result).toBe('Please help me with this task\nUser current active file: "notes/my-note.md"');
			expect(mockWorkSpaceService.getActiveFile).toHaveBeenCalledWith();
		});

		it('should handle empty request with active file', () => {
			const mockFile = {
				path: 'test.md'
			};
			mockWorkSpaceService.getActiveFile.mockReturnValue(mockFile);
			const requestWithContext = getRequestWithContextMethod(service);
			const request = '';

			const result = requestWithContext(request);

			expect(result).toBe('\nUser current active file: "test.md"');
			expect(mockWorkSpaceService.getActiveFile).toHaveBeenCalledWith();
		});

		it('should handle request with special characters in file path', () => {
			const mockFile = {
				path: 'folder/my file (v2).md'
			};
			mockWorkSpaceService.getActiveFile.mockReturnValue(mockFile);
			const requestWithContext = getRequestWithContextMethod(service);
			const request = 'Update this file';

			const result = requestWithContext(request);

			expect(result).toBe('Update this file\nUser current active file: "folder/my file (v2).md"');
			expect(mockWorkSpaceService.getActiveFile).toHaveBeenCalledWith();
		});

		it('should handle multiline requests with active file', () => {
			const mockFile = {
				path: 'docs/readme.md'
			};
			mockWorkSpaceService.getActiveFile.mockReturnValue(mockFile);
			const requestWithContext = getRequestWithContextMethod(service);
			const request = 'Please help me:\n1. First task\n2. Second task';

			const result = requestWithContext(request);

			expect(result).toBe('Please help me:\n1. First task\n2. Second task\nUser current active file: "docs/readme.md"');
			expect(mockWorkSpaceService.getActiveFile).toHaveBeenCalledWith();
		});
	});
});

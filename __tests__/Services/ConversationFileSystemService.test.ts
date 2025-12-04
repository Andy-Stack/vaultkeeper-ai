import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationFileSystemService } from '../../Services/ConversationFileSystemService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { TFile } from 'obsidian';
import { Exception } from '../../Helpers/Exception';

/**
 * INTEGRATION TESTS - ConversationFileSystemService
 *
 * Tests conversation persistence with real FileSystemService integration.
 * Mocks only the underlying VaultService operations.
 *
 * Tests:
 * - Saving and loading conversations
 * - Path management
 * - Conversation title updates
 * - Listing all conversations
 */

describe('ConversationFileSystemService - Integration Tests', () => {
	let service: ConversationFileSystemService;
	let mockFileSystemService: any;

	beforeEach(() => {
		// Mock FileSystemService
		mockFileSystemService = {
			writeObjectToFile: vi.fn().mockResolvedValue(true),
			readObjectFromFile: vi.fn(),
			deleteFile: vi.fn(),
			moveFile: vi.fn(),
			listFilesInDirectory: vi.fn(),
			exists: vi.fn().mockResolvedValue(true)
		};

		// Register the mock
		RegisterSingleton(Services.FileSystemService, mockFileSystemService);

		// Mock Exception.log
		vi.spyOn(Exception, 'log').mockImplementation(() => {});

		// Create service
		service = new ConversationFileSystemService();
	});

	afterEach(() => {
		// Clear singleton registry to prevent memory leaks
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	// Helper to create mock TFile
	function createMockFile(path: string): TFile {
		const file = new TFile();
		file.path = path;
		const fileName = path.split('/').pop() || '';
		file.name = fileName;
		file.basename = fileName.split('.')[0] || '';
		file.extension = 'json';
		return file;
	}

	// Helper to create a test conversation
	function createTestConversation(title: string = 'Test Conversation'): Conversation {
		const conversation = new Conversation();
		conversation.title = title;
		conversation.created = new Date('2024-01-01T10:00:00Z');
		conversation.updated = new Date('2024-01-01T10:30:00Z');

		conversation.contents.push(
			new ConversationContent(Role.User, 'Hello', '', '', new Date('2024-01-01T10:00:00Z')),
			new ConversationContent(Role.Assistant, 'Hi there!', '', '', new Date('2024-01-01T10:01:00Z'))
		);

		return conversation;
	}

	describe('generateConversationPath', () => {
		it('should generate correct path from conversation title', () => {
			const conversation = createTestConversation('My Test Note');
			const path = service.generateConversationPath(conversation);

			expect(path).toBe('Vaultkeeper AI/Conversations/My Test Note.json');
		});

		it('should handle special characters in title', () => {
			const conversation = createTestConversation('Test: Special & Characters!');
			const path = service.generateConversationPath(conversation);

			expect(path).toBe('Vaultkeeper AI/Conversations/Test: Special & Characters!.json');
		});

		it('should handle empty title', () => {
			const conversation = createTestConversation('');
			const path = service.generateConversationPath(conversation);

			expect(path).toBe('Vaultkeeper AI/Conversations/.json');
		});
	});

	describe('saveConversation', () => {
		it('should save conversation with correct structure', async () => {
			const conversation = createTestConversation('Test Save');

			const path = await service.saveConversation(conversation);

			expect(path).toBe('Vaultkeeper AI/Conversations/Test Save.json');
			expect(mockFileSystemService.writeObjectToFile).toHaveBeenCalledWith(
				'Vaultkeeper AI/Conversations/Test Save.json',
				expect.objectContaining({
					title: 'Test Save',
					created: '2024-01-01T10:00:00.000Z',
					contents: expect.arrayContaining([
						expect.objectContaining({
							role: Role.User,
							content: 'Hello',
							timestamp: '2024-01-01T10:00:00.000Z'
						}),
						expect.objectContaining({
							role: Role.Assistant,
							content: 'Hi there!',
							timestamp: '2024-01-01T10:01:00.000Z'
						})
					])
				}),
				true,
				false
			);
		});

		it('should update the updated timestamp when saving', async () => {
			const conversation = createTestConversation('Test Timestamp');
			const originalUpdated = conversation.updated;

			await service.saveConversation(conversation);

			expect(conversation.updated).not.toEqual(originalUpdated);
			expect(conversation.updated.getTime()).toBeGreaterThanOrEqual(originalUpdated.getTime());
		});


		it('should set current conversation path on first save', async () => {
			const conversation = createTestConversation('First Save');

			expect(service.getCurrentConversationPath()).toBeNull();

			await service.saveConversation(conversation);

			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/First Save.json');
		});

		it('should reuse current path on subsequent saves', async () => {
			const conversation = createTestConversation('Original Title');

			// First save
			await service.saveConversation(conversation);
			const firstPath = service.getCurrentConversationPath();

			// Change title and save again
			conversation.title = 'Changed Title';
			await service.saveConversation(conversation);
			const secondPath = service.getCurrentConversationPath();

			// Path should remain the same (uses cached path)
			expect(firstPath).toBe(secondPath);
			expect(secondPath).toBe('Vaultkeeper AI/Conversations/Original Title.json');
		});

		it('should serialize function calls correctly', async () => {
			const conversation = createTestConversation('With Function Call');
			const functionCall = {
				name: 'test_function',
				arguments: { arg1: 'value1' }
			};

			conversation.contents.push(
				new ConversationContent(
					Role.Assistant,
					'Function call',
					'',
					JSON.stringify(functionCall),
					new Date('2024-01-01T10:02:00Z'),
					true,
					false,
					'tool_123'
				)
			);

			await service.saveConversation(conversation);

			const savedData = mockFileSystemService.writeObjectToFile.mock.calls[0][1];
			const functionCallContent = savedData.contents[2];

			expect(functionCallContent).toEqual({
				role: Role.Assistant,
				content: 'Function call',
				promptContent: '',
				functionCall: JSON.stringify(functionCall),
				timestamp: '2024-01-01T10:02:00.000Z',
				isFunctionCall: true,
				isFunctionCallResponse: false,
				toolId: 'tool_123'
			});
		});

		it('should serialize function call responses correctly', async () => {
			const conversation = createTestConversation('With Function Response');

			conversation.contents.push(
				new ConversationContent(
					Role.User,
					'Function response',
					'',
					'',
					new Date('2024-01-01T10:03:00Z'),
					false,
					true,
					'tool_456'
				)
			);

			await service.saveConversation(conversation);

			const savedData = mockFileSystemService.writeObjectToFile.mock.calls[0][1];
			const responseContent = savedData.contents[2];

			expect(responseContent.isFunctionCall).toBe(false);
			expect(responseContent.isFunctionCallResponse).toBe(true);
			expect(responseContent.toolId).toBe('tool_456');
		});

		it('should handle empty conversation', async () => {
			const conversation = new Conversation();
			conversation.title = 'Empty';

			await service.saveConversation(conversation);

			const savedData = mockFileSystemService.writeObjectToFile.mock.calls[0][1];
			expect(savedData.contents).toEqual([]);
		});
	});

	describe('getCurrentConversationPath', () => {
		it('should return null initially', () => {
			expect(service.getCurrentConversationPath()).toBeNull();
		});

		it('should return path after saving', async () => {
			const conversation = createTestConversation('Test Path');
			await service.saveConversation(conversation);

			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/Test Path.json');
		});

		it('should return path after manual setting', () => {
			service.setCurrentConversationPath('Vaultkeeper AI/Conversations/Manual.json');
			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/Manual.json');
		});
	});

	describe('setCurrentConversationPath', () => {
		it('should set the current path', () => {
			service.setCurrentConversationPath('Vaultkeeper AI/Conversations/Custom.json');
			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/Custom.json');
		});

		it('should override previous path', () => {
			service.setCurrentConversationPath('Vaultkeeper AI/Conversations/First.json');
			service.setCurrentConversationPath('Vaultkeeper AI/Conversations/Second.json');

			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/Second.json');
		});
	});

	describe('resetCurrentConversation', () => {
		it('should reset path to null', async () => {
			const conversation = createTestConversation('Test Reset');
			await service.saveConversation(conversation);

			expect(service.getCurrentConversationPath()).not.toBeNull();

			service.resetCurrentConversation();

			expect(service.getCurrentConversationPath()).toBeNull();
		});

		it('should allow new conversation after reset', async () => {
			const conv1 = createTestConversation('First');
			await service.saveConversation(conv1);

			service.resetCurrentConversation();

			const conv2 = createTestConversation('Second');
			await service.saveConversation(conv2);

			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/Second.json');
		});
	});

	describe('deleteCurrentConversation', () => {
		it('should delete current conversation and reset path', async () => {
			const conversation = createTestConversation('To Delete');
			await service.saveConversation(conversation);

			mockFileSystemService.deleteFile.mockResolvedValue(undefined); // void = success

			const result = await service.deleteCurrentConversation();

			expect(result).toBeUndefined(); // void = success
			expect(mockFileSystemService.deleteFile).toHaveBeenCalledWith(
				'Vaultkeeper AI/Conversations/To Delete.json',
				true,
				false
			);
			expect(service.getCurrentConversationPath()).toBeNull();
		});

		it('should return undefined when no current conversation', async () => {
			const result = await service.deleteCurrentConversation();

			expect(result).toBeUndefined(); // void = nothing to delete
			expect(mockFileSystemService.deleteFile).not.toHaveBeenCalled();
		});

		it('should not reset path when delete fails', async () => {
			const conversation = createTestConversation('Delete Fail');
			await service.saveConversation(conversation);

			mockFileSystemService.deleteFile.mockResolvedValue(
				new Error('Permission denied')
			);

			const result = await service.deleteCurrentConversation();

			expect(result).toBeInstanceOf(Error); // Error = failure
			expect((result as Error).message).toBe('Permission denied');
			expect(service.getCurrentConversationPath()).not.toBeNull();
		});
	});

	describe('getAllConversations', () => {
		it('should load all conversations from directory', async () => {
			const mockFiles = [
				createMockFile('Vaultkeeper AI/Conversations/conv1.json'),
				createMockFile('Vaultkeeper AI/Conversations/conv2.json')
			];

			mockFileSystemService.listFilesInDirectory.mockResolvedValue(mockFiles);

			mockFileSystemService.readObjectFromFile
				.mockResolvedValueOnce({
					title: 'Conversation 1',
					created: '2024-01-01T10:00:00.000Z',
					updated: '2024-01-01T10:30:00.000Z',
					contents: [
						{
							role: Role.User,
							content: 'Message 1',
							promptContent: '',
							functionCall: '',
							timestamp: '2024-01-01T10:00:00.000Z',
							isFunctionCall: false,
							isFunctionCallResponse: false
						}
					]
				})
				.mockResolvedValueOnce({
					title: 'Conversation 2',
					created: '2024-01-02T10:00:00.000Z',
					updated: '2024-01-02T10:30:00.000Z',
					contents: [
						{
							role: Role.User,
							content: 'Message 2',
							promptContent: '',
							functionCall: '',
							timestamp: '2024-01-02T10:00:00.000Z',
							isFunctionCall: false,
							isFunctionCallResponse: false
						}
					]
				});

			const conversations = await service.getAllConversations();

			expect(conversations).toHaveLength(2);
			expect(conversations[0].title).toBe('Conversation 1');
			expect(conversations[1].title).toBe('Conversation 2');
			expect(mockFileSystemService.listFilesInDirectory).toHaveBeenCalledWith(
				'Vaultkeeper AI/Conversations',
				false,
				true
			);
		});

		it('should reconstruct conversation objects correctly', async () => {
			const mockFiles = [createMockFile('Vaultkeeper AI/Conversations/test.json')];

			mockFileSystemService.listFilesInDirectory.mockResolvedValue(mockFiles);
			mockFileSystemService.readObjectFromFile.mockResolvedValue({
				title: 'Test Conversation',
				created: '2024-01-01T10:00:00.000Z',
				updated: '2024-01-01T11:00:00.000Z',
				contents: [
					{
						role: Role.User,
						content: 'Hello',
						promptContent: '',
						functionCall: '',
						timestamp: '2024-01-01T10:00:00.000Z',
						isFunctionCall: false,
						isFunctionCallResponse: false
					},
					{
						role: Role.Assistant,
						content: 'Hi!',
						promptContent: '',
						functionCall: '',
						timestamp: '2024-01-01T10:01:00.000Z',
						isFunctionCall: false,
						isFunctionCallResponse: false
					}
				]
			});

			const conversations = await service.getAllConversations();

			expect(conversations[0]).toBeInstanceOf(Conversation);
			expect(conversations[0].title).toBe('Test Conversation');
			expect(conversations[0].created).toBeInstanceOf(Date);
			expect(conversations[0].updated).toBeInstanceOf(Date);
			expect(conversations[0].contents).toHaveLength(2);
			expect(conversations[0].contents[0]).toBeInstanceOf(ConversationContent);
			expect(conversations[0].contents[0].role).toBe(Role.User);
		});

		it('should skip invalid conversation files', async () => {
			const mockFiles = [
				createMockFile('Vaultkeeper AI/Conversations/valid.json'),
				createMockFile('Vaultkeeper AI/Conversations/invalid.json')
			];

			mockFileSystemService.listFilesInDirectory.mockResolvedValue(mockFiles);
			mockFileSystemService.readObjectFromFile
				.mockResolvedValueOnce({
					title: 'Valid',
					created: '2024-01-01T10:00:00.000Z',
					updated: '2024-01-01T10:30:00.000Z',
					contents: []
				})
				.mockResolvedValueOnce({
					// Invalid - missing required fields
					title: 'Invalid'
				});

			const conversations = await service.getAllConversations();

			// Should only return valid conversation
			expect(conversations).toHaveLength(1);
			expect(conversations[0].title).toBe('Valid');
		});

		it('should handle empty directory', async () => {
			mockFileSystemService.listFilesInDirectory.mockResolvedValue([]);

			const conversations = await service.getAllConversations();

			expect(conversations).toEqual([]);
		});

		it('should reconstruct function call metadata', async () => {
			const mockFiles = [createMockFile('Vaultkeeper AI/Conversations/with-functions.json')];

			mockFileSystemService.listFilesInDirectory.mockResolvedValue(mockFiles);
			mockFileSystemService.readObjectFromFile.mockResolvedValue({
				title: 'With Functions',
				created: '2024-01-01T10:00:00.000Z',
				updated: '2024-01-01T10:30:00.000Z',
				contents: [
					{
						role: Role.Assistant,
						content: 'Calling function',
						promptContent: '',
						functionCall: JSON.stringify({ name: 'test_func', arguments: {} }),
						timestamp: '2024-01-01T10:00:00.000Z',
						isFunctionCall: true,
						isFunctionCallResponse: false,
						toolId: 'tool_1'
					},
					{
						role: Role.User,
						content: 'Function result',
						promptContent: '',
						functionCall: '',
						timestamp: '2024-01-01T10:01:00.000Z',
						isFunctionCall: false,
						isFunctionCallResponse: true,
						toolId: 'tool_1'
					}
				]
			});

			const conversations = await service.getAllConversations();

			expect(conversations[0].contents[0].isFunctionCall).toBe(true);
			expect(JSON.parse(conversations[0].contents[0].functionCall)).toEqual({
				name: 'test_func',
				arguments: {}
			});
			expect(conversations[0].contents[1].isFunctionCallResponse).toBe(true);
		});
	});

	describe('updateConversationTitle', () => {
		it('should move file to new path with new title', async () => {
			mockFileSystemService.moveFile.mockResolvedValue(undefined); // void = success

			await service.updateConversationTitle(
				'Vaultkeeper AI/Conversations/Old Title.json',
				'New Title'
			);

			expect(mockFileSystemService.moveFile).toHaveBeenCalledWith(
				'Vaultkeeper AI/Conversations/Old Title.json',
				'Vaultkeeper AI/Conversations/New Title.json',
				true
			);
		});

		it('should update current path if it matches old path', async () => {
			mockFileSystemService.moveFile.mockResolvedValue(undefined); // void = success

			service.setCurrentConversationPath('Vaultkeeper AI/Conversations/Old.json');

			await service.updateConversationTitle('Vaultkeeper AI/Conversations/Old.json', 'New');

			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/New.json');
		});

		it('should not update current path if it doesnt match', async () => {
			mockFileSystemService.moveFile.mockResolvedValue(undefined); // void = success

			service.setCurrentConversationPath('Vaultkeeper AI/Conversations/Other.json');

			await service.updateConversationTitle('Vaultkeeper AI/Conversations/Old.json', 'New');

			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/Other.json');
		});

		it('should return error when move fails', async () => {
			mockFileSystemService.moveFile.mockResolvedValue(
				new Error('Destination already exists')
			);

			const result = await service.updateConversationTitle(
				'Vaultkeeper AI/Conversations/Old.json',
				'New'
			);

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toBe('Destination already exists');
		});

		it('should handle special characters in new title', async () => {
			mockFileSystemService.moveFile.mockResolvedValue(undefined); // void = success

			await service.updateConversationTitle(
				'Vaultkeeper AI/Conversations/Old.json',
				'New: Title & More!'
			);

			expect(mockFileSystemService.moveFile).toHaveBeenCalledWith(
				'Vaultkeeper AI/Conversations/Old.json',
				'Vaultkeeper AI/Conversations/New: Title & More!.json',
				true
			);
		});
	});

	describe('Integration - Complete Workflows', () => {
		it('should handle save -> load -> update title workflow', async () => {
			// Save conversation
			const conversation = createTestConversation('Original');
			await service.saveConversation(conversation);

			const savedPath = service.getCurrentConversationPath();
			expect(savedPath).toBe('Vaultkeeper AI/Conversations/Original.json');

			// Simulate loading conversations
			const mockFiles = [createMockFile(savedPath!)];
			mockFileSystemService.listFilesInDirectory.mockResolvedValue(mockFiles);

			const savedData = mockFileSystemService.writeObjectToFile.mock.calls[0][1];
			// Simulate JSON serialization/deserialization which removes undefined values
			mockFileSystemService.readObjectFromFile.mockResolvedValue(JSON.parse(JSON.stringify(savedData)));

			const loaded = await service.getAllConversations();
			expect(loaded[0].title).toBe('Original');

			// Update title
			mockFileSystemService.moveFile.mockResolvedValue(undefined); // void = success
			await service.updateConversationTitle(savedPath!, 'Updated Title');

			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/Updated Title.json');
		});

		it('should handle save -> delete -> new save workflow', async () => {
			// First conversation
			const conv1 = createTestConversation('First');
			await service.saveConversation(conv1);
			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/First.json');

			// Delete it
			mockFileSystemService.deleteFile.mockResolvedValue(undefined); // void = success
			await service.deleteCurrentConversation();
			expect(service.getCurrentConversationPath()).toBeNull();

			// New conversation
			const conv2 = createTestConversation('Second');
			await service.saveConversation(conv2);
			expect(service.getCurrentConversationPath()).toBe('Vaultkeeper AI/Conversations/Second.json');
		});

		it('should preserve all conversation data through save/load cycle', async () => {
			// Create comprehensive conversation
			const original = createTestConversation('Complete Test');
			original.contents.push(
				new ConversationContent(
					Role.Assistant,
					'Function',
					'',
					JSON.stringify({ name: 'test', arguments: { arg: 'val' } }),
					new Date('2024-01-01T10:05:00Z'),
					true,
					false,
					'tool_xyz'
				),
				new ConversationContent(
					Role.User,
					'Response',
					'',
					'',
					new Date('2024-01-01T10:06:00Z'),
					false,
					true,
					'tool_xyz'
				)
			);

			// Save
			await service.saveConversation(original);
			const savedData = mockFileSystemService.writeObjectToFile.mock.calls[0][1];

			// Simulate load
			mockFileSystemService.listFilesInDirectory.mockResolvedValue([
				createMockFile('Vaultkeeper AI/Conversations/Complete Test.json')
			]);
			// Simulate JSON serialization/deserialization which removes undefined values
			mockFileSystemService.readObjectFromFile.mockResolvedValue(JSON.parse(JSON.stringify(savedData)));

			const loaded = await service.getAllConversations();
			const reconstructed = loaded[0];

			// Verify all data preserved
			expect(reconstructed.title).toBe(original.title);
			expect(reconstructed.contents).toHaveLength(4);
			expect(reconstructed.contents[2].isFunctionCall).toBe(true);
			expect(JSON.parse(reconstructed.contents[2].functionCall)).toEqual({
				name: 'test',
				arguments: { arg: 'val' }
			});
			expect(reconstructed.contents[3].isFunctionCallResponse).toBe(true);
		});
	});
});

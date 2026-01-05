import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationNamingService } from '../../Services/ConversationNamingService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Conversation } from '../../Conversations/Conversation';
import { Path } from '../../Enums/Path';
import { Exception } from '../../Helpers/Exception';

describe('ConversationNamingService', () => {
    let service: ConversationNamingService;
    let mockNamingProvider: any;
    let mockConversationService: any;
    let mockVaultService: any;

    beforeEach(() => {
        // Mock IConversationNamingService
        mockNamingProvider = {
            generateName: vi.fn().mockResolvedValue('Generated Title')
        };

        // Mock ConversationFileSystemService
        mockConversationService = {
            getCurrentConversationPath: vi.fn().mockReturnValue('conversations/test.json'),
            updateConversationTitle: vi.fn().mockResolvedValue(undefined),
            saveConversation: vi.fn().mockResolvedValue(undefined)
        };
        RegisterSingleton(Services.ConversationFileSystemService, mockConversationService);

        // Mock VaultService
        mockVaultService = {
            exists: vi.fn().mockReturnValue(false)
        };
        RegisterSingleton(Services.VaultService, mockVaultService);

        // Mock AbortService
        const mockAbortService = {
            signal: vi.fn(() => new AbortController().signal),
            abortableOperation: vi.fn(async (fn) => await fn())
        };
        RegisterSingleton(Services.AbortService, mockAbortService);

        service = new ConversationNamingService();
    });

    afterEach(() => {
        // Clear singleton registry to prevent memory leaks
        DeregisterAllServices();
    });

    describe('Constructor and Dependencies', () => {
        it('should initialize with dependencies', () => {
            expect(service).toBeDefined();
        });

        it('should not have naming provider until resolved', () => {
            expect((service as any).namingProvider).toBeUndefined();
        });
    });

    describe('resolveNamingProvider', () => {
        it('should resolve naming provider from DependencyService', () => {
            RegisterSingleton(Services.IConversationNamingService, mockNamingProvider);

            service.resolveNamingProvider();

            expect((service as any).namingProvider).toBe(mockNamingProvider);
        });
    });

    describe('validateName', () => {
        it('should trim whitespace from name', async () => {
            const result = await (service as any).validateName('  Test Title  ');
            expect(result).toBe('Test Title');
        });

        it('should remove leading and trailing quotes', async () => {
            const result1 = await (service as any).validateName('"Test Title"');
            expect(result1).toBe('Test Title');

            const result2 = await (service as any).validateName("'Test Title'");
            expect(result2).toBe('Test Title');
        });

        it('should not limit words', async () => {
            const result = await (service as any).validateName('One Two Three Four Five Six Seven Eight');
            expect(result).toBe('One Two Three Four Five Six Seven Eight');
        });

        it('should handle duplicate names with incrementing index', async () => {
            mockVaultService.exists.mockImplementation(async (path: string) => {
                return path === `${Path.Conversations}/Test Title.json` ||
                       path === `${Path.Conversations}/Test Title(1).json`;
            });

            const result = await (service as any).validateName('Test Title');

            expect(result).toBe('Test Title(2)');
            expect(mockVaultService.exists).toHaveBeenCalledWith(`${Path.Conversations}/Test Title.json`, true);
            expect(mockVaultService.exists).toHaveBeenCalledWith(`${Path.Conversations}/Test Title(1).json`, true);
            expect(mockVaultService.exists).toHaveBeenCalledWith(`${Path.Conversations}/Test Title(2).json`, true);
        });

        it('should throw error when stack limit is reached', async () => {
            // Make exists always return true to simulate infinite duplicates
            mockVaultService.exists.mockResolvedValue(true);

            await expect(async () => {
                await (service as any).validateName('Test Title');
            }).rejects.toThrow('Stack limit reached');
        });

        it('should preserve multiple spaces in names', async () => {
            const result = await (service as any).validateName('Test    Title    With    Spaces');
            expect(result).toBe('Test    Title    With    Spaces');
        });

        it('should return unique name when no duplicates exist', async () => {
            mockVaultService.exists.mockResolvedValue(false);

            const result = await (service as any).validateName('Unique Title');

            expect(result).toBe('Unique Title');
            expect(mockVaultService.exists).toHaveBeenCalledWith(`${Path.Conversations}/Unique Title.json`, true);
            expect(mockVaultService.exists).toHaveBeenCalledTimes(1);
        });
    });

    describe('requestName', () => {
        let conversation: Conversation;
        let onNameChanged: any;

        beforeEach(() => {
            conversation = new Conversation();
            conversation.title = 'Old Title';
            onNameChanged = vi.fn();

            RegisterSingleton(Services.IConversationNamingService, mockNamingProvider);
            service.resolveNamingProvider();
        });

        it('should generate and apply new name successfully', async () => {
            mockNamingProvider.generateName.mockResolvedValue('New Conversation Title');
            mockVaultService.exists.mockReturnValue(false);

            await service.requestName(conversation, 'User prompt', onNameChanged);

            expect(mockNamingProvider.generateName).toHaveBeenCalledWith('<message_to_title>\nUser prompt\n</message_to_title>');
            expect(mockConversationService.updateConversationTitle).toHaveBeenCalledWith(
                'conversations/test.json',
                'New Conversation Title'
            );
            expect(mockConversationService.saveConversation).toHaveBeenCalledWith(conversation);
            expect(conversation.title).toBe('New Conversation Title');
            expect(onNameChanged).toHaveBeenCalledWith('New Conversation Title');
        });

        it('should return early if naming provider is not resolved', async () => {
            (service as any).namingProvider = undefined;

            await service.requestName(conversation, 'Test', onNameChanged);

            expect(mockNamingProvider.generateName).not.toHaveBeenCalled();
            expect(onNameChanged).not.toHaveBeenCalled();
        });

        it('should return early if no conversation path exists', async () => {
            mockConversationService.getCurrentConversationPath.mockReturnValue(null);

            await service.requestName(conversation, 'Test', onNameChanged);

            expect(mockNamingProvider.generateName).not.toHaveBeenCalled();
            expect(onNameChanged).not.toHaveBeenCalled();
        });

        it('should validate and clean generated name', async () => {
            mockNamingProvider.generateName.mockResolvedValue('"Quoted Name"');
            mockVaultService.exists.mockReturnValue(false);

            await service.requestName(conversation, 'Test', onNameChanged);

            expect(conversation.title).toBe('Quoted Name'); // Quotes removed
        });

        it('should handle conversation path change during generation', async () => {
            mockConversationService.getCurrentConversationPath
                .mockReturnValueOnce('conversations/original.json')
                .mockReturnValueOnce('conversations/different.json'); // Changed!

            await service.requestName(conversation, 'Test', onNameChanged);

            expect(mockNamingProvider.generateName).toHaveBeenCalled();
            // Should not update or save because path changed
            expect(mockConversationService.updateConversationTitle).not.toHaveBeenCalled();
            expect(mockConversationService.saveConversation).not.toHaveBeenCalled();
            expect(onNameChanged).not.toHaveBeenCalled();
        });

        it('should handle abort signal gracefully', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            mockNamingProvider.generateName.mockRejectedValue(abortError);

            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

            await service.requestName(conversation, 'Test', onNameChanged);

            // Should not throw, but will log the error (behavior changed with new error handling)
            expect(exceptionSpy).toHaveBeenCalledWith(abortError);
            expect(onNameChanged).not.toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should log other errors but not throw', async () => {
            const error = new Error('API Error');
            mockNamingProvider.generateName.mockRejectedValue(error);

            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

            await service.requestName(conversation, 'Test', onNameChanged);

            expect(exceptionSpy).toHaveBeenCalledWith(error);
            expect(onNameChanged).not.toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should work without onNameChanged callback', async () => {
            mockNamingProvider.generateName.mockResolvedValue('New Title');
            mockVaultService.exists.mockReturnValue(false);

            // Pass undefined for callback
            await service.requestName(conversation, 'Test', undefined);

            expect(conversation.title).toBe('New Title');
            expect(mockConversationService.saveConversation).toHaveBeenCalled();
            // Should not throw when callback is undefined
        });

        it('should handle duplicate names by adding index', async () => {
            mockNamingProvider.generateName.mockResolvedValue('Popular Name');
            mockVaultService.exists.mockImplementation((path: string) => {
                return path === `${Path.Conversations}/Popular Name.json`;
            });

            await service.requestName(conversation, 'Test', onNameChanged);

            expect(conversation.title).toBe('Popular Name(1)');
            expect(mockConversationService.updateConversationTitle).toHaveBeenCalledWith(
                'conversations/test.json',
                'Popular Name(1)'
            );
        });

        it('should not limit words in generated name', async () => {
            mockNamingProvider.generateName.mockResolvedValue('One Two Three Four Five Six Seven Eight Nine');
            mockVaultService.exists.mockReturnValue(false);

            await service.requestName(conversation, 'Test', onNameChanged);

            expect(conversation.title).toBe('One Two Three Four Five Six Seven Eight Nine');
        });
    });
});

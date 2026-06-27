import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MistralConversationNamingService } from '../../AIClasses/Mistral/MistralConversationNamingService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIProvider, AIProviderModel } from '../../Enums/ApiProvider';
import { Role } from '../../Enums/Role';

describe('MistralConversationNamingService', () => {
    let service: MistralConversationNamingService;
    let mockPlugin: any;
    let mockSettingsService: any;
    let mockAbortService: any;
    let fetchMock: any;

    beforeEach(() => {
        mockPlugin = {};
        RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);

        // Mock SettingsService
        mockSettingsService = {
            settings: {
                model: AIProviderModel.MistralNamer,
                apiKeys: {
                    claude: 'test-claude-key',
                    openai: 'test-openai-key',
                    gemini: 'test-gemini-key',
                    mistral: 'test-mistral-key'
                }
            },
            getApiKeyForProvider: vi.fn((provider: AIProvider) => {
                if (provider === AIProvider.Claude) return 'test-claude-key';
                if (provider === AIProvider.OpenAI) return 'test-openai-key';
                if (provider === AIProvider.Gemini) return 'test-gemini-key';
                if (provider === AIProvider.Mistral) return 'test-mistral-key';
                return '';
            }),
            getApiKeyForCurrentModel: vi.fn(() => 'test-mistral-key')
        };
        RegisterSingleton(Services.SettingsService, mockSettingsService);

        // Mock AbortService
        mockAbortService = {
            signal: vi.fn(() => new AbortController().signal),
            abortableOperation: vi.fn((fn) => fn())
        };
        RegisterSingleton(Services.AbortService, mockAbortService);

        // Mock global fetch
        fetchMock = vi.fn();
        global.fetch = fetchMock;

        service = new MistralConversationNamingService();
    });

    afterEach(() => {
        // Clear singleton registry to prevent memory leaks
        DeregisterAllServices();
        vi.restoreAllMocks();
    });

    describe('generateName', () => {
        it('should make request with correct format', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: 'Test Conversation'
                        }
                    }]
                })
            });

            await service.generateName('User prompt');

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer test-mistral-key',
                        'Content-Type': 'application/json',
                    },
                    body: expect.any(String)
                })
            );

            const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(requestBody.model).toBe(AIProviderModel.MistralNamer);
            expect(requestBody.max_tokens).toBe(100);
            expect(requestBody.messages).toHaveLength(2);
            expect(requestBody.messages[0].role).toBe('system');
            expect(requestBody.messages[1].role).toBe(Role.User);
            expect(requestBody.messages[1].content).toBe('User prompt');
        });

        it('should return generated name from response', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: 'Generated Name'
                        }
                    }]
                })
            });

            const result = await service.generateName('Test prompt');

            expect(result).toBe('Generated Name');
        });

        it('should throw error on API error response', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => 'Invalid API key'
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Chat Completions API error: 401 Unauthorized - Invalid API key');
        });

        it('should throw error when response has no content', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: []
                })
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should throw error when message content is missing', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            // No content field
                        }
                    }]
                })
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should pass abort signal to fetch', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: 'Name'
                        }
                    }]
                })
            });

            await service.generateName('Test');

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    signal: expect.any(AbortSignal)
                })
            );
        });

        it('should handle malformed response structure', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    // Missing choices array
                    other: 'data'
                })
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should trim whitespace from generated name', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: '  Generated Name  '
                        }
                    }]
                })
            });

            const result = await service.generateName('Test');

            expect(result).toBe('Generated Name');
        });

        it('should throw error when message content is empty string', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: ''
                        }
                    }]
                })
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });
    });
});
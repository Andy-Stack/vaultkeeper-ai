import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAIConversationNamingService } from '../../AIClasses/OpenAI/OpenAIConversationNamingService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIProvider, AIProviderModel } from '../../Enums/ApiProvider';
import { Role } from '../../Enums/Role';
import { SettingsService } from '../../Services/SettingsService';

describe('OpenAIConversationNamingService', () => {
    let service: OpenAIConversationNamingService;
    let mockPlugin: any;
    let mockSettingsService: any;
    let fetchMock: any;

    beforeEach(() => {
        mockPlugin = {};
        RegisterSingleton(Services.VaultAIPlugin, mockPlugin);

        // Mock SettingsService
        mockSettingsService = {
            settings: {
                model: AIProviderModel.GPT_4o,
                apiKeys: {
                    claude: 'test-claude-key',
                    openai: 'test-openai-key',
                    gemini: 'test-gemini-key'
                }
            },
            getApiKeyForProvider: vi.fn((provider: AIProvider) => {
                if (provider === AIProvider.Claude) return 'test-claude-key';
                if (provider === AIProvider.OpenAI) return 'test-openai-key';
                if (provider === AIProvider.Gemini) return 'test-gemini-key';
                return '';
            }),
            getApiKeyForCurrentModel: vi.fn(() => 'test-openai-key')
        };
        RegisterSingleton(Services.SettingsService, mockSettingsService);

        // Mock global fetch
        fetchMock = vi.fn();
        global.fetch = fetchMock;

        service = new OpenAIConversationNamingService();
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
                    choices: [{ message: { content: 'Test Conversation' } }]
                })
            });

            await service.generateName('User prompt', undefined);

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer test-openai-key',
                        'Content-Type': 'application/json'
                    },
                    body: expect.any(String)
                })
            );

            const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(requestBody.model).toBe(AIProviderModel.OpenAINamer);
            expect(requestBody.max_tokens).toBe(100);
            expect(requestBody.messages).toHaveLength(2);
            expect(requestBody.messages[0].role).toBe(Role.System);
            expect(requestBody.messages[0].content).toBeDefined();
            expect(requestBody.messages[1].role).toBe(Role.User);
            expect(requestBody.messages[1].content).toBe('User prompt');
        });

        it('should return generated name from response', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Generated Name' } }]
                })
            });

            const result = await service.generateName('Test prompt', undefined);

            expect(result).toBe('Generated Name');
        });

        it('should throw error on API error response', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded'
            });

            await expect(service.generateName('Test', undefined))
                .rejects.toThrow('OpenAI API error: 429 Too Many Requests - Rate limit exceeded');
        });

        it('should throw error when response has no content', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: []
                })
            });

            await expect(service.generateName('Test', undefined))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should pass abort signal to fetch', async () => {
            const abortController = new AbortController();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Name' } }]
                })
            });

            await service.generateName('Test', abortController.signal);

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    signal: abortController.signal
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

            await expect(service.generateName('Test', undefined))
                .rejects.toThrow('Failed to generate conversation name');
        });
    });
});

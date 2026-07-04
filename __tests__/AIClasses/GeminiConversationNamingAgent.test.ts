import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GeminiConversationNamingAgent } from '../../AIClasses/Gemini/GeminiConversationNamingAgent';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIProvider, AIProviderModel } from '../../Enums/ApiProvider';
import { Role } from '../../Enums/Role';

describe('GeminiConversationNamingAgent', () => {
    let service: GeminiConversationNamingAgent;
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
                model: AIProviderModel.GeminiFlash_3_5_Flash,
                apiKeys: {
                    claude: 'test-claude-key',
                    openai: 'test-openai-key',
                    gemini: 'test-gemini-key', mistral: 'test-mistral-key'
                }
            },
            getApiKeyForProvider: vi.fn((provider: AIProvider) => {
                if (provider === AIProvider.Claude) return 'test-claude-key';
                if (provider === AIProvider.OpenAI) return 'test-openai-key';
                if (provider === AIProvider.Gemini) return 'test-gemini-key';
                return '';
            }),
            getApiKeyForCurrentProvider: vi.fn(() => 'test-gemini-key')
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

        service = new GeminiConversationNamingAgent();
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
                    candidates: [{ content: { parts: [{ text: 'Test Conversation' }] } }]
                })
            });

            await service.generateName('User prompt');

            expect(fetchMock).toHaveBeenCalled();
            const fetchUrl = fetchMock.mock.calls[0][0];
            expect(fetchUrl).toContain(AIProviderModel.GeminiNamer);
            expect(fetchUrl).toContain('generateContent');
            expect(fetchUrl).toContain('key=test-gemini-key');

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: expect.any(String)
                })
            );

            const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(requestBody.system_instruction).toBeDefined();
            expect(requestBody.system_instruction.parts).toHaveLength(1);
            expect(requestBody.system_instruction.parts[0].text).toBeDefined();
            expect(requestBody.contents).toHaveLength(1);
            expect(requestBody.contents[0].role).toBe(Role.User);
            expect(requestBody.contents[0].parts).toHaveLength(1);
            expect(requestBody.contents[0].parts[0].text).toBe('User prompt');
        });

        it('should return generated name from response', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'Generated Name' }] } }]
                })
            });

            const result = await service.generateName('Test prompt');

            expect(result).toBe('Generated Name');
        });

        it('should throw error on API error response', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: async () => 'Invalid request'
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Gemini API error: 400 Bad Request - Invalid request');
        });

        it('should throw error when response has no content', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: []
                })
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should pass abort signal to fetch', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'Name' }] } }]
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
                    // Missing candidates
                    other: 'data'
                })
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });
    });
});

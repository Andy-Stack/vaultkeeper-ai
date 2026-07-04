import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LocalConversationNamingAgent } from '../../AIClasses/Local/LocalConversationNamingAgent';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Role } from '../../Enums/Role';

describe('LocalConversationNamingAgent', () => {
    let agent: LocalConversationNamingAgent;
    let mockPlugin: any;
    let mockSettingsService: any;
    let mockAbortService: any;
    let fetchMock: any;

    beforeEach(() => {
        mockPlugin = {};
        RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);

        mockSettingsService = {
            settings: {
                localUrl: 'http://localhost:1234/v1/chat/completions',
                localModels: {
                    model: 'local-main-model',
                    planningModel: 'local-planning-model',
                    quickActionModel: 'local-quick-model'
                },
                apiKeys: {
                    local: ''
                }
            },
            getApiKeyForProvider: vi.fn(() => ''),
            getApiKeyForCurrentProvider: vi.fn(() => '')
        };
        RegisterSingleton(Services.SettingsService, mockSettingsService);

        mockAbortService = {
            signal: vi.fn(() => new AbortController().signal),
            abortableOperation: vi.fn((fn) => fn())
        };
        RegisterSingleton(Services.AbortService, mockAbortService);

        fetchMock = vi.fn();
        global.fetch = fetchMock;

        agent = new LocalConversationNamingAgent();
    });

    afterEach(() => {
        DeregisterAllServices();
        vi.restoreAllMocks();
    });

    describe('apiUrl / namerModel getters', () => {
        it('should use settings.localUrl as the endpoint', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'Name' } }] })
            });

            await agent.generateName('User prompt');

            expect(fetchMock).toHaveBeenCalledWith(
                'http://localhost:1234/v1/chat/completions',
                expect.any(Object)
            );
        });

        it('should use localModels.quickActionModel as the namer model', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'Name' } }] })
            });

            await agent.generateName('User prompt');

            const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(requestBody.model).toBe('local-quick-model');
        });
    });

    describe('generateName', () => {
        it('should make request with correct format', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'Test Conversation' } }] })
            });

            await agent.generateName('User prompt');

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ',
                        'Content-Type': 'application/json',
                    },
                    body: expect.any(String)
                })
            );

            const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(requestBody.max_tokens).toBe(100);
            expect(requestBody.messages).toHaveLength(2);
            expect(requestBody.messages[0].role).toBe('system');
            expect(requestBody.messages[1].role).toBe(Role.User);
            expect(requestBody.messages[1].content).toBe('User prompt');
        });

        it('should return generated name from response', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'Generated Name' } }] })
            });

            const result = await agent.generateName('Test prompt');

            expect(result).toBe('Generated Name');
        });

        it('should throw error on API error response', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => 'Invalid API key'
            });

            await expect(agent.generateName('Test'))
                .rejects.toThrow('Chat Completions API error: 401 Unauthorized - Invalid API key');
        });

        it('should throw error when response has no content', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [] })
            });

            await expect(agent.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should throw error when message content is missing', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: {} }] })
            });

            await expect(agent.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should throw error when message content is empty string', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '' } }] })
            });

            await expect(agent.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should handle malformed response structure', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ other: 'data' })
            });

            await expect(agent.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should trim whitespace from generated name', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '  Generated Name  ' } }] })
            });

            const result = await agent.generateName('Test');

            expect(result).toBe('Generated Name');
        });

        it('should pass abort signal to fetch', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'Name' } }] })
            });

            await agent.generateName('Test');

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ signal: expect.any(AbortSignal) })
            );
        });
    });
});

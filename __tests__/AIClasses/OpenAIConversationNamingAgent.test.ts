import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAIConversationNamingAgent } from '../../AIClasses/OpenAI/OpenAIConversationNamingAgent';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIProvider, AIProviderModel } from '../../Enums/ApiProvider';
import { Role } from '../../Enums/Role';

describe('OpenAIConversationNamingAgent', () => {
    let service: OpenAIConversationNamingAgent;
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
                model: AIProviderModel.GPT_5_6_Luna,
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
            getApiKeyForCurrentProvider: vi.fn(() => 'test-openai-key')
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

        service = new OpenAIConversationNamingAgent();
    });

    afterEach(() => {
        // Clear singleton registry to prevent memory leaks
        DeregisterAllServices();
        vi.restoreAllMocks();
    });

    describe('generateName', () => {
        it('should make request with correct Responses API format', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    id: 'resp_123',
                    created_at: 1234567890,
                    error: null,
                    incomplete_details: null,
                    instructions: null,
                    metadata: null,
                    model: AIProviderModel.OpenAINamer,
                    object: 'response',
                    parallel_tool_calls: true,
                    temperature: null,
                    tool_choice: 'auto',
                    tools: [],
                    top_p: null,
                    output: [
                        {
                            id: 'msg_1',
                            type: 'message',
                            role: 'assistant',
                            status: 'completed',
                            content: [
                                {
                                    type: 'output_text',
                                    text: 'Test Conversation',
                                    annotations: []
                                }
                            ]
                        }
                    ]
                })
            });

            await service.generateName('User prompt');

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
            expect(requestBody.instructions).toBeDefined();
            expect(requestBody.input).toHaveLength(1);
            expect(requestBody.input[0].role).toBe(Role.User);
            expect(requestBody.input[0].content).toBe('User prompt');
            expect(requestBody.stream).toBe(false);
            expect(requestBody.messages).toBeUndefined();
        });

        it('should return generated name from output array', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    id: 'resp_123',
                    created_at: 1234567890,
                    error: null,
                    incomplete_details: null,
                    instructions: null,
                    metadata: null,
                    model: AIProviderModel.OpenAINamer,
                    object: 'response',
                    parallel_tool_calls: true,
                    temperature: null,
                    tool_choice: 'auto',
                    tools: [],
                    top_p: null,
                    output: [
                        {
                            id: 'msg_1',
                            type: 'message',
                            role: 'assistant',
                            status: 'completed',
                            content: [
                                {
                                    type: 'output_text',
                                    text: 'Generated Name',
                                    annotations: []
                                }
                            ]
                        }
                    ]
                })
            });

            const result = await service.generateName('Test prompt');

            expect(result).toBe('Generated Name');
        });

        it('should throw error on API error response', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded'
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('OpenAI API error: 429 Too Many Requests - Rate limit exceeded');
        });

        it('should throw error when response has no content', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    id: 'resp_123',
                    status: 'completed',
                    output: []
                })
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });

        it('should pass abort signal to fetch', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    id: 'resp_123',
                    created_at: 1234567890,
                    error: null,
                    incomplete_details: null,
                    instructions: null,
                    metadata: null,
                    model: AIProviderModel.OpenAINamer,
                    object: 'response',
                    parallel_tool_calls: true,
                    temperature: null,
                    tool_choice: 'auto',
                    tools: [],
                    top_p: null,
                    output: [
                        {
                            id: 'msg_1',
                            type: 'message',
                            role: 'assistant',
                            status: 'completed',
                            content: [
                                {
                                    type: 'output_text',
                                    text: 'Name',
                                    annotations: []
                                }
                            ]
                        }
                    ]
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
                    id: 'resp_123',
                    status: 'completed'
                    // Missing output_text and output array
                })
            });

            await expect(service.generateName('Test'))
                .rejects.toThrow('Failed to generate conversation name');
        });
    });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Claude } from '../../AIClasses/Claude/Claude';
import { OpenAI } from '../../AIClasses/OpenAI/OpenAI';
import { Gemini } from '../../AIClasses/Gemini/Gemini';
import { Mistral } from '../../AIClasses/Mistral/Mistral';
import { Local } from '../../AIClasses/Local/Local';
import { Conversation } from '../../Conversations/Conversation';
import { AgentType } from '../../Enums/AgentType';
import { AIEffort } from '../../Enums/AIEffort';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AbortService } from '../../Services/AbortService';
import { AIProvider, AIProviderModel } from '../../Enums/ApiProvider';
import { parseToolCalls, parseFunctionResponse } from '../../Helpers/ResponseHelper';

/**
 * BaseAIClass Shared Method Tests
 *
 * Tests the provider-agnostic methods in BaseAIClass that all providers inherit.
 * Focus on cross-provider compatibility for parsing and filtering.
 */
describe('BaseAIClass Shared Methods', () => {
    let claude: Claude;
    let openai: OpenAI;
    let gemini: Gemini;
    let mockSettingsService: any;
    let mockStreamingService: any;

    beforeEach(() => {
        // Mock IPrompt
        const mockPrompt = {
            systemInstruction: vi.fn().mockReturnValue('System instruction'),
            userInstruction: vi.fn().mockResolvedValue('User instruction')
        };
        RegisterSingleton(Services.IPrompt, mockPrompt);

        // Mock VaultkeeperAIPlugin
        RegisterSingleton(Services.VaultkeeperAIPlugin, {});

        // Mock SettingsService
        mockSettingsService = {
            settings: {
                model: 'claude-3-5-sonnet-20241022',
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
            getApiKeyForCurrentProvider: vi.fn(() => 'test-claude-key'),
            subscribeToSettingsChanged: vi.fn()
        };
        RegisterSingleton(Services.SettingsService, mockSettingsService);

        // Create real AbortService instance
        const abortService = new AbortService();
        RegisterSingleton(Services.AbortService, abortService);

        // Mock StreamingService
        mockStreamingService = {
            streamRequest: vi.fn()
        };
        RegisterSingleton(Services.StreamingService, mockStreamingService);

        // Mock IAIFileService
        const mockFileService = {
            refreshCache: vi.fn().mockResolvedValue(undefined),
            listFiles: vi.fn().mockReturnValue([]),
            uploadFile: vi.fn().mockResolvedValue(undefined),
            deleteFile: vi.fn().mockResolvedValue(undefined),
            deleteFiles: vi.fn().mockResolvedValue(undefined)
        };
        RegisterSingleton(Services.IAIFileService, mockFileService);

        claude = new Claude();
        openai = new OpenAI();
        gemini = new Gemini();
    });

    afterEach(() => {
        DeregisterAllServices();
    });

    describe('thought accumulation', () => {
        it('should accumulate appended text into one completed thought for the provider', () => {
            expect((claude as any).appendThought('First ')).toBe('First ');
            (claude as any).appendThought('second');

            expect((claude as any).completeThought()).toEqual({ provider: AIProvider.Claude, text: 'First second' });
        });

        it('should start a new thought after completing one', () => {
            (openai as any).appendThought('Earlier');
            (openai as any).completeThought();

            expect((openai as any).completeThought()).toBeUndefined();
        });

        it('should discard accumulated text on reset', () => {
            (gemini as any).appendThought('Stale');
            (gemini as any).resetThought();

            expect((gemini as any).completeThought()).toBeUndefined();
        });
    });

    describe('parseToolCalls', () => {
        it('should parse Claude-style function call (with id)', () => {
            const claudeCall = JSON.stringify([{
                toolCall: {
                    id: 'toolu_123',
                    name: 'search_vault_files',
                    args: { query: 'test' }
                }
            }]);

            const result = parseToolCalls(claudeCall);

            expect(result).toBeDefined();
            expect(result![0].toolCall.id).toBe('toolu_123');
            expect(result![0].toolCall.name).toBe('search_vault_files');
            expect(result![0].toolCall.args).toEqual({ query: 'test' });
        });

        it('should parse OpenAI-style function call (with id)', () => {
            const openaiCall = JSON.stringify([{
                toolCall: {
                    id: 'call_abc',
                    name: 'read_file',
                    args: { path: 'note.md' }
                }
            }]);

            const result = parseToolCalls(openaiCall);

            expect(result).toBeDefined();
            expect(result![0].toolCall.id).toBe('call_abc');
            expect(result![0].toolCall.name).toBe('read_file');
            expect(result![0].toolCall.args).toEqual({ path: 'note.md' });
        });

        it('should parse Gemini-style function call (no id)', () => {
            const geminiCall = JSON.stringify([{
                toolCall: {
                    name: 'search_vault_files',
                    args: { query: 'gemini test' }
                }
            }]);

            const result = parseToolCalls(geminiCall);

            expect(result).toBeDefined();
            expect(result![0].toolCall.name).toBe('search_vault_files');
            expect(result![0].toolCall.args).toEqual({ query: 'gemini test' });
            // ID may be undefined for Gemini
            expect(result![0].toolCall.id).toBeUndefined();
        });

        it('should handle invalid JSON gracefully', () => {
            const invalidJson = 'not valid json {';

            const result = parseToolCalls(invalidJson);

            expect(result).toBeNull();
        });

        it('should handle missing required fields', () => {
            // Missing 'name' field
            const missingName = JSON.stringify([{
                toolCall: {
                    id: 'test-id',
                    args: { query: 'test' }
                }
            }]);

            const result = parseToolCalls(missingName);

            // Should still parse, but may have undefined name
            expect(result).toBeDefined();
            expect(result![0].toolCall.id).toBe('test-id');
        });

        it('should handle empty args object', () => {
            const emptyArgs = JSON.stringify([{
                toolCall: {
                    id: 'test-id',
                    name: 'list_files',
                    args: {}
                }
            }]);

            const result = parseToolCalls(emptyArgs);

            expect(result).toBeDefined();
            expect(result![0].toolCall.args).toEqual({});
        });

        it('should handle complex nested args', () => {
            const complexArgs = JSON.stringify([{
                toolCall: {
                    id: 'test-id',
                    name: 'search',
                    args: {
                        filters: {
                            tags: ['important', 'work'],
                            dateRange: { start: '2024-01-01', end: '2024-12-31' }
                        },
                        options: { limit: 10, sort: 'date' }
                    }
                }
            }]);

            const result = parseToolCalls(complexArgs);

            expect(result).toBeDefined();
            expect((result![0].toolCall.args as any).filters.tags).toHaveLength(2);
            expect((result![0].toolCall.args as any).options.limit).toBe(10);
        });
    });

    describe('parseFunctionResponse', () => {
        it('should parse response with id field', () => {
            const responseWithId = JSON.stringify({
                id: 'call-123',
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.md', 'file2.md']
                }
            });

            const result = parseFunctionResponse(responseWithId);

            expect(result).toBeDefined();
            expect(result!.id).toBe('call-123');
            expect(result!.functionResponse.name).toBe('search_vault_files');
            expect(result!.functionResponse.response).toEqual(['file1.md', 'file2.md']);
        });

        it('should parse response without id field', () => {
            const responseNoId = JSON.stringify({
                functionResponse: {
                    name: 'read_file',
                    response: { content: 'File contents' }
                }
            });

            const result = parseFunctionResponse(responseNoId);

            expect(result).toBeDefined();
            expect(result!.functionResponse.name).toBe('read_file');
            expect(result!.functionResponse.response).toEqual({ content: 'File contents' });
            expect(result!.id).toBeUndefined();
        });

        it('should handle invalid JSON', () => {
            const invalidJson = 'invalid response json';

            const result = parseFunctionResponse(invalidJson);

            expect(result).toBeNull();
        });

        it('should handle null response', () => {
            const nullResponse = JSON.stringify({
                id: 'call-123',
                functionResponse: {
                    name: 'delete_file',
                    response: null
                }
            });

            const result = parseFunctionResponse(nullResponse);

            expect(result).toBeDefined();
            expect(result!.functionResponse.response).toBeNull();
        });

        it('should handle complex response objects', () => {
            const complexResponse = JSON.stringify({
                id: 'call-456',
                functionResponse: {
                    name: 'query_database',
                    response: {
                        results: [
                            { id: 1, title: 'Note 1' },
                            { id: 2, title: 'Note 2' }
                        ],
                        metadata: { totalCount: 2, page: 1 }
                    }
                }
            });

            const result = parseFunctionResponse(complexResponse);

            expect(result).toBeDefined();
            expect((result!.functionResponse.response as any).results).toHaveLength(2);
            expect((result!.functionResponse.response as any).metadata.totalCount).toBe(2);
        });
    });

    describe('Cross-Provider Consistency', () => {
        it('should parse same function call JSON consistently across providers', () => {
            const sharedToolCall = JSON.stringify([{
                toolCall: {
                    id: 'shared-123',
                    name: 'search_vault_files',
                    args: { query: 'consistent test' }
                }
            }]);

            const result = parseToolCalls(sharedToolCall);

            // All providers should parse to the same structure using the shared helper
            expect(result).toBeDefined();
            expect(result![0].toolCall.name).toBe('search_vault_files');
            expect(result![0].toolCall.args).toEqual({ query: 'consistent test' });
        });

    });

    describe('effort', () => {
        async function sentRequestBody(ai: { streamRequest: (conversation: Conversation) => AsyncGenerator<unknown> }) {
            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: '', isComplete: true };
            });
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Hi' }));
            for await (const _chunk of ai.streamRequest(conversation)) { /* consume */ }
            return mockStreamingService.streamRequest.mock.calls[0][1];
        }

        it('maps the setting to the model-specific value', () => {
            mockSettingsService.settings.model = AIProviderModel.GPT_6_Luna;

            mockSettingsService.settings.effort = AIEffort.Fast;
            expect((openai as any).effort()).toBe('none');

            mockSettingsService.settings.effort = AIEffort.Thinking;
            expect((openai as any).effort()).toBe('medium');
        });

        it('always uses Fast for quick actions', () => {
            mockSettingsService.settings.quickActionModel = AIProviderModel.ClaudeHaiku_5_5;
            mockSettingsService.settings.effort = AIEffort.Thinking;
            claude.agentType = AgentType.QuickAction;

            expect((claude as any).effort()).toBe('low');
        });

        it('returns undefined for models without an effort mapping', () => {
            mockSettingsService.settings.model = 'some-local-model';
            mockSettingsService.settings.effort = AIEffort.Thinking;

            expect((claude as any).effort()).toBeUndefined();
        });

        it('sends output_config.effort to Claude', async () => {
            mockSettingsService.settings.model = AIProviderModel.ClaudeSonnet_5_5;
            mockSettingsService.settings.effort = AIEffort.Thinking;

            expect((await sentRequestBody(claude)).output_config).toEqual({ effort: 'medium' });
        });

        it('sends reasoning.effort and a reasoning summary request to OpenAI', async () => {
            mockSettingsService.settings.model = AIProviderModel.GPT_6_1_Sol;
            mockSettingsService.settings.effort = AIEffort.Fast;

            expect((await sentRequestBody(openai)).reasoning).toEqual({ effort: 'low', summary: 'auto' });
        });

        it('sends thinkingConfig.thinkingLevel and includeThoughts to Gemini', async () => {
            mockSettingsService.settings.model = AIProviderModel.GeminiFlash_3_5_Lite;
            mockSettingsService.settings.effort = AIEffort.Fast;

            expect((await sentRequestBody(gemini)).generationConfig).toEqual({ thinkingConfig: { thinkingLevel: 'minimal', includeThoughts: true } });
        });

        it('sends reasoning_effort to Mistral', async () => {
            mockSettingsService.settings.model = AIProviderModel.MistralLarge;
            mockSettingsService.settings.effort = AIEffort.Thinking;

            expect((await sentRequestBody(new Mistral())).reasoning_effort).toBe('high');
        });

        it('sends no effort field to local models', async () => {
            mockSettingsService.settings.localModels = { model: 'some-local-model', planningModel: '', quickActionModel: '' };
            mockSettingsService.settings.effort = AIEffort.Thinking;

            expect((await sentRequestBody(new Local())).reasoning_effort).toBeUndefined();
        });
    });
});

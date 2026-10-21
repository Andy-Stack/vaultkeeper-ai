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

    describe('filterConversationContents', () => {
        it('should filter out empty content', () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' }),
                new ConversationContent({ role: Role.Assistant, content: '' }),  // Empty - will be filtered
                new ConversationContent({ role: Role.Assistant }),  // No content - will be filtered
                new ConversationContent({ role: Role.User, content: 'World', displayContent: 'World' })
            ];

            const result = (claude as any).filterConversationContents(contents);

            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('Hello');
            expect(result[1].content).toBe('World');
        });

        it('should filter orphaned calls from different providers', () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Test', displayContent: 'Test' }),

                // Orphaned Claude function call (no response)
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCalls: JSON.stringify([{
                        toolCall: {
                            id: 'toolu_orphan',
                            name: 'search',
                            args: {}
                        }
                    }]),
                    toolId: 'toolu_orphan'
                }),

                new ConversationContent({ role: Role.User, content: 'Next question', displayContent: 'Next question' })
            ];

            const result = (claude as any).filterConversationContents(contents);

            // Orphaned call should be excluded
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('Test');
            expect(result[1].content).toBe('Next question');
        });

        it('should preserve most recent call regardless of provider', () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Test', displayContent: 'Test' }),

                // Most recent function call (at end, so kept even without response)
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCalls: JSON.stringify([{
                        toolCall: {
                            id: 'call_recent',
                            name: 'search',
                            args: {}
                        }
                    }]),
                    toolId: 'call_recent'
                })
            ];

            const result = (openai as any).filterConversationContents(contents);

            // Most recent call should be included
            expect(result).toHaveLength(2);
            expect(result[1].toolCalls).toBeDefined();
        });

        it('should handle function call with response correctly', () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search', displayContent: 'Search' }),

                // Function call with response (should be kept)
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCalls: JSON.stringify([{
                        toolCall: {
                            id: 'call_with_response',
                            name: 'search',
                            args: { query: 'test' }
                        }
                    }]),
                    toolId: 'call_with_response'
                }),

                // Corresponding response
                new ConversationContent({
                    role: Role.User,
                    content: JSON.stringify({
                        id: 'call_with_response',
                        functionResponse: { name: 'search', response: [] }
                    }),
                    functionResponse: JSON.stringify({
                        id: 'call_with_response',
                        functionResponse: { name: 'search', response: [] }
                    }),
                    toolId: 'call_with_response'
                })
            ];

            const result = (gemini as any).filterConversationContents(contents);

            // All three should be kept
            expect(result).toHaveLength(3);
        });

        it('should handle mixed orphaned and complete calls', () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Start', displayContent: 'Start' }),

                // Orphaned call 1
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCalls: JSON.stringify([{
                        toolCall: { id: 'orphan1', name: 'search', args: {} }
                    }]),
                    toolId: 'orphan1'
                }),

                new ConversationContent({ role: Role.User, content: 'Middle', displayContent: 'Middle' }),

                // Complete call with response
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCalls: JSON.stringify([{
                        toolCall: { id: 'complete1', name: 'read', args: {} }
                    }]),
                    toolId: 'complete1'
                }),

                new ConversationContent({
                    role: Role.User,
                    content: JSON.stringify({
                        id: 'complete1',
                        functionResponse: { name: 'read', response: 'data' }
                    }),
                    functionResponse: JSON.stringify({
                        id: 'complete1',
                        functionResponse: { name: 'read', response: 'data' }
                    }),
                    toolId: 'complete1'
                }),

                new ConversationContent({ role: Role.User, content: 'End', displayContent: 'End' })
            ];

            const result = (claude as any).filterConversationContents(contents);

            // Should have: Start, Middle, complete call, complete response, End
            expect(result).toHaveLength(5);
            expect(result[0].content).toBe('Start');
            expect(result[1].content).toBe('Middle');
            expect(result[2].toolCalls).toBeDefined();
            expect(result[3].functionResponse).toBeDefined();
            expect(result[4].content).toBe('End');
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

        it('should filter conversations consistently across providers', () => {
            const sharedConversation = [
                new ConversationContent({ role: Role.User, content: 'Test', displayContent: 'Test' }),
                new ConversationContent({ role: Role.Assistant, content: '' }),  // Empty
                new ConversationContent({ role: Role.User, content: 'More', displayContent: 'More' })
            ];

            const claudeFiltered = (claude as any).filterConversationContents(sharedConversation);
            const openaiFiltered = (openai as any).filterConversationContents(sharedConversation);
            const geminiFiltered = (gemini as any).filterConversationContents(sharedConversation);

            // All should filter to same length
            expect(claudeFiltered).toHaveLength(2);
            expect(openaiFiltered).toHaveLength(2);
            expect(geminiFiltered).toHaveLength(2);

            // Content should match
            expect(claudeFiltered[0].content).toBe(openaiFiltered[0].content);
            expect(openaiFiltered[0].content).toBe(geminiFiltered[0].content);
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

        it('sends reasoning.effort to OpenAI', async () => {
            mockSettingsService.settings.model = AIProviderModel.GPT_6_1_Sol;
            mockSettingsService.settings.effort = AIEffort.Fast;

            expect((await sentRequestBody(openai)).reasoning).toEqual({ effort: 'low' });
        });

        it('sends thinkingConfig.thinkingLevel to Gemini', async () => {
            mockSettingsService.settings.model = AIProviderModel.GeminiFlash_3_5_Lite;
            mockSettingsService.settings.effort = AIEffort.Fast;

            expect((await sentRequestBody(gemini)).generationConfig).toEqual({ thinkingConfig: { thinkingLevel: 'minimal' } });
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

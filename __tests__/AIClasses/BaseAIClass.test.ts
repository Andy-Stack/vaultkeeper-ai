import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Claude } from '../../AIClasses/Claude/Claude';
import { OpenAI } from '../../AIClasses/OpenAI/OpenAI';
import { Gemini } from '../../AIClasses/Gemini/Gemini';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AbortService } from '../../Services/AbortService';
import { AIProvider } from '../../Enums/ApiProvider';

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
        const mockSettingsService = {
            settings: {
                model: 'claude-3-5-sonnet-20241022',
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
            getApiKeyForCurrentModel: vi.fn(() => 'test-claude-key')
        };
        RegisterSingleton(Services.SettingsService, mockSettingsService);

        // Create real AbortService instance
        const abortService = new AbortService();
        RegisterSingleton(Services.AbortService, abortService);

        // Mock StreamingService
        const mockStreamingService = {
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

    describe('parseFunctionCall', () => {
        it('should parse Claude-style function call (with id)', () => {
            const claudeCall = JSON.stringify({
                functionCall: {
                    id: 'toolu_123',
                    name: 'search_vault_files',
                    args: { query: 'test' }
                }
            });

            const result = (claude as any).parseFunctionCall(claudeCall);

            expect(result).toBeDefined();
            expect(result.functionCall.id).toBe('toolu_123');
            expect(result.functionCall.name).toBe('search_vault_files');
            expect(result.functionCall.args).toEqual({ query: 'test' });
        });

        it('should parse OpenAI-style function call (with id)', () => {
            const openaiCall = JSON.stringify({
                functionCall: {
                    id: 'call_abc',
                    name: 'read_file',
                    args: { path: 'note.md' }
                }
            });

            const result = (openai as any).parseFunctionCall(openaiCall);

            expect(result).toBeDefined();
            expect(result.functionCall.id).toBe('call_abc');
            expect(result.functionCall.name).toBe('read_file');
            expect(result.functionCall.args).toEqual({ path: 'note.md' });
        });

        it('should parse Gemini-style function call (no id)', () => {
            const geminiCall = JSON.stringify({
                functionCall: {
                    name: 'search_vault_files',
                    args: { query: 'gemini test' }
                }
            });

            const result = (gemini as any).parseFunctionCall(geminiCall);

            expect(result).toBeDefined();
            expect(result.functionCall.name).toBe('search_vault_files');
            expect(result.functionCall.args).toEqual({ query: 'gemini test' });
            // ID may be undefined for Gemini
            expect(result.functionCall.id).toBeUndefined();
        });

        it('should handle invalid JSON gracefully', () => {
            const invalidJson = 'not valid json {';

            const result = (claude as any).parseFunctionCall(invalidJson);

            expect(result).toBeNull();
        });

        it('should handle missing required fields', () => {
            // Missing 'name' field
            const missingName = JSON.stringify({
                functionCall: {
                    id: 'test-id',
                    args: { query: 'test' }
                }
            });

            const result = (claude as any).parseFunctionCall(missingName);

            // Should still parse, but may have undefined name
            expect(result).toBeDefined();
            expect(result.functionCall.id).toBe('test-id');
        });

        it('should handle empty args object', () => {
            const emptyArgs = JSON.stringify({
                functionCall: {
                    id: 'test-id',
                    name: 'list_files',
                    args: {}
                }
            });

            const result = (claude as any).parseFunctionCall(emptyArgs);

            expect(result).toBeDefined();
            expect(result.functionCall.args).toEqual({});
        });

        it('should handle complex nested args', () => {
            const complexArgs = JSON.stringify({
                functionCall: {
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
            });

            const result = (claude as any).parseFunctionCall(complexArgs);

            expect(result).toBeDefined();
            expect(result.functionCall.args.filters.tags).toHaveLength(2);
            expect(result.functionCall.args.options.limit).toBe(10);
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

            const result = (claude as any).parseFunctionResponse(responseWithId);

            expect(result).toBeDefined();
            expect(result.id).toBe('call-123');
            expect(result.functionResponse.name).toBe('search_vault_files');
            expect(result.functionResponse.response).toEqual(['file1.md', 'file2.md']);
        });

        it('should parse response without id field', () => {
            const responseNoId = JSON.stringify({
                functionResponse: {
                    name: 'read_file',
                    response: { content: 'File contents' }
                }
            });

            const result = (gemini as any).parseFunctionResponse(responseNoId);

            expect(result).toBeDefined();
            expect(result.functionResponse.name).toBe('read_file');
            expect(result.functionResponse.response).toEqual({ content: 'File contents' });
            expect(result.id).toBeUndefined();
        });

        it('should handle invalid JSON', () => {
            const invalidJson = 'invalid response json';

            const result = (claude as any).parseFunctionResponse(invalidJson);

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

            const result = (openai as any).parseFunctionResponse(nullResponse);

            expect(result).toBeDefined();
            expect(result.functionResponse.response).toBeNull();
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

            const result = (claude as any).parseFunctionResponse(complexResponse);

            expect(result).toBeDefined();
            expect(result.functionResponse.response.results).toHaveLength(2);
            expect(result.functionResponse.response.metadata.totalCount).toBe(2);
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
                    functionCall: JSON.stringify({
                        functionCall: {
                            id: 'toolu_orphan',
                            name: 'search',
                            args: {}
                        }
                    }),
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
                    functionCall: JSON.stringify({
                        functionCall: {
                            id: 'call_recent',
                            name: 'search',
                            args: {}
                        }
                    }),
                    toolId: 'call_recent'
                })
            ];

            const result = (openai as any).filterConversationContents(contents);

            // Most recent call should be included
            expect(result).toHaveLength(2);
            expect(result[1].functionCall).toBeDefined();
        });

        it('should handle function call with response correctly', () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search', displayContent: 'Search' }),

                // Function call with response (should be kept)
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    functionCall: JSON.stringify({
                        functionCall: {
                            id: 'call_with_response',
                            name: 'search',
                            args: { query: 'test' }
                        }
                    }),
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
                    })
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
                    functionCall: JSON.stringify({
                        functionCall: { id: 'orphan1', name: 'search', args: {} }
                    }),
                    toolId: 'orphan1'
                }),

                new ConversationContent({ role: Role.User, content: 'Middle', displayContent: 'Middle' }),

                // Complete call with response
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    functionCall: JSON.stringify({
                        functionCall: { id: 'complete1', name: 'read', args: {} }
                    }),
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
                    })
                }),

                new ConversationContent({ role: Role.User, content: 'End', displayContent: 'End' })
            ];

            const result = (claude as any).filterConversationContents(contents);

            // Should have: Start, Middle, complete call, complete response, End
            expect(result).toHaveLength(5);
            expect(result[0].content).toBe('Start');
            expect(result[1].content).toBe('Middle');
            expect(result[2].functionCall).toBeDefined();
            expect(result[3].functionResponse).toBeDefined();
            expect(result[4].content).toBe('End');
        });
    });

    describe('Cross-Provider Consistency', () => {
        it('should parse same function call JSON consistently across providers', () => {
            const sharedFunctionCall = JSON.stringify({
                functionCall: {
                    id: 'shared-123',
                    name: 'search_vault_files',
                    args: { query: 'consistent test' }
                }
            });

            const claudeResult = (claude as any).parseFunctionCall(sharedFunctionCall);
            const openaiResult = (openai as any).parseFunctionCall(sharedFunctionCall);
            const geminiResult = (gemini as any).parseFunctionCall(sharedFunctionCall);

            // All providers should parse to the same structure
            expect(claudeResult.functionCall.name).toBe(openaiResult.functionCall.name);
            expect(openaiResult.functionCall.name).toBe(geminiResult.functionCall.name);
            expect(claudeResult.functionCall.args).toEqual(openaiResult.functionCall.args);
            expect(openaiResult.functionCall.args).toEqual(geminiResult.functionCall.args);
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
});

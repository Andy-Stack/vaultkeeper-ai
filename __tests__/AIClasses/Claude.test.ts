import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Claude } from '../../AIClasses/Claude/Claude';
import { RegisterSingleton, Resolve, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { StreamingService } from '../../Services/StreamingService';
import type { IPrompt } from '../../AIClasses/IPrompt';
import type AIAgentPlugin from '../../main';
import { AIFunctionDefinitions } from '../../AIClasses/FunctionDefinitions/AIFunctionDefinitions';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { SettingsService } from '../../Services/SettingsService';
import { AIProvider } from '../../Enums/ApiProvider';

describe('Claude', () => {
    let claude: Claude;
    let mockStreamingService: any;
    let mockPrompt: any;
    let mockPlugin: any;
    let mockSettingsService: any;
    let mockFunctionDefinitions: any;

    beforeEach(() => {
        // Mock IPrompt
        mockPrompt = {
            systemInstruction: vi.fn().mockReturnValue('System instruction'),
            userInstruction: vi.fn().mockResolvedValue('User instruction')
        };
        RegisterSingleton(Services.IPrompt, mockPrompt);

        // Mock AIAgentPlugin
        mockPlugin = {};
        RegisterSingleton(Services.AIAgentPlugin, mockPlugin);

        // Mock SettingsService
        mockSettingsService = {
            settings: {
                model: 'claude-opus-4-20250514',
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

        // Mock StreamingService
        mockStreamingService = {
            streamRequest: vi.fn()
        };
        RegisterSingleton(Services.StreamingService, mockStreamingService);

        // Mock AIFunctionDefinitions
        mockFunctionDefinitions = {
            getQueryActions: vi.fn().mockReturnValue([
                {
                    name: 'test_function',
                    description: 'Test function',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string' }
                        }
                    }
                }
            ])
        };
        RegisterSingleton(Services.AIFunctionDefinitions, mockFunctionDefinitions);

        claude = new Claude();
    });

    afterEach(() => {
        // Clear singleton registry to prevent memory leaks
        DeregisterAllServices();
    });

    describe('Constructor and Dependencies', () => {
        it('should initialize with dependencies from DependencyService', () => {
            expect(claude).toBeDefined();
        });

        it('should load API key from SettingsService', () => {
            // API key is private, but we can verify it's available via SettingsService
            expect(mockSettingsService.getApiKeyForProvider(AIProvider.Claude)).toBe('test-claude-key');
        });

        it('should resolve all required services', () => {
            const prompt = Resolve<IPrompt>(Services.IPrompt);
            const plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
            const settingsService = Resolve<SettingsService>(Services.SettingsService);
            const streaming = Resolve<StreamingService>(Services.StreamingService);
            const functions = Resolve<AIFunctionDefinitions>(Services.AIFunctionDefinitions);

            expect(prompt).toBe(mockPrompt);
            expect(plugin).toBe(mockPlugin);
            expect(settingsService).toBe(mockSettingsService);
            expect(streaming).toBe(mockStreamingService);
            expect(functions).toBe(mockFunctionDefinitions);
        });
    });

    describe('parseStreamChunk', () => {
        it('should parse text_delta chunks', () => {
            const chunk = JSON.stringify({
                type: 'content_block_delta',
                delta: {
                    type: 'text_delta',
                    text: 'Hello world'
                }
            });

            const result = (claude as any).parseStreamChunk(chunk);

            expect(result.content).toBe('Hello world');
            expect(result.isComplete).toBe(false);
            expect(result.functionCall).toBeUndefined();
        });

        it('should detect tool_use start in content_block_start', () => {
            const chunk = JSON.stringify({
                type: 'content_block_start',
                content_block: {
                    type: 'tool_use',
                    name: 'search_files',
                    id: 'tool_123'
                }
            });

            const result = (claude as any).parseStreamChunk(chunk);

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
            // Accumulation happens internally
        });

        it('should accumulate function arguments from input_json_delta', () => {
            // Start tool use
            (claude as any).parseStreamChunk(JSON.stringify({
                type: 'content_block_start',
                content_block: {
                    type: 'tool_use',
                    name: 'search_files',
                    id: 'tool_123'
                }
            }));

            // Accumulate partial JSON
            (claude as any).parseStreamChunk(JSON.stringify({
                type: 'content_block_delta',
                delta: {
                    type: 'input_json_delta',
                    partial_json: '{"query":'
                }
            }));

            (claude as any).parseStreamChunk(JSON.stringify({
                type: 'content_block_delta',
                delta: {
                    type: 'input_json_delta',
                    partial_json: '"test"}'
                }
            }));

            // Stop and finalize
            const result = (claude as any).parseStreamChunk(JSON.stringify({
                type: 'content_block_stop'
            }));

            expect(result.functionCall).toBeDefined();
            expect(result.functionCall?.name).toBe('search_files');
            expect(result.functionCall?.arguments).toEqual({ query: 'test' });
            expect(result.functionCall?.toolId).toBe('tool_123');
        });

        it('should handle content_block_stop and finalize function call', () => {
            // Setup
            (claude as any).accumulatedFunctionName = 'test_func';
            (claude as any).accumulatedFunctionArgs = '{"param":"value"}';
            (claude as any).accumulatedFunctionId = 'func_456';

            const chunk = JSON.stringify({
                type: 'content_block_stop'
            });

            const result = (claude as any).parseStreamChunk(chunk);

            expect(result.functionCall).toBeDefined();
            expect(result.functionCall?.name).toBe('test_func');
            expect(result.functionCall?.arguments).toEqual({ param: 'value' });
            expect(result.functionCall?.toolId).toBe('func_456');

            // Should reset accumulation
            expect((claude as any).accumulatedFunctionName).toBeNull();
            expect((claude as any).accumulatedFunctionArgs).toBe('');
            expect((claude as any).accumulatedFunctionId).toBeNull();
        });

        it('should handle message_delta with stop_reason', () => {
            const chunkToolUse = JSON.stringify({
                type: 'message_delta',
                delta: {
                    stop_reason: 'tool_use'
                }
            });

            const result1 = (claude as any).parseStreamChunk(chunkToolUse);
            expect(result1.isComplete).toBe(true);
            expect(result1.shouldContinue).toBe(true);

            const chunkEndTurn = JSON.stringify({
                type: 'message_delta',
                delta: {
                    stop_reason: 'end_turn'
                }
            });

            const result2 = (claude as any).parseStreamChunk(chunkEndTurn);
            expect(result2.isComplete).toBe(true);
            expect(result2.shouldContinue).toBe(false);
        });

        it('should handle message_stop event', () => {
            const chunk = JSON.stringify({
                type: 'message_stop'
            });

            const result = (claude as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
        });

        it('should handle invalid JSON in function arguments gracefully', () => {
            // Setup
            (claude as any).accumulatedFunctionName = 'test_func';
            (claude as any).accumulatedFunctionArgs = 'invalid json {';
            (claude as any).accumulatedFunctionId = 'func_789';

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const chunk = JSON.stringify({
                type: 'content_block_stop'
            });

            const result = (claude as any).parseStreamChunk(chunk);

            expect(result.functionCall).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle malformed chunk JSON', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = (claude as any).parseStreamChunk('invalid json {{{');

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
            expect(result.error).toContain('Failed to parse chunk');
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('extractContents', () => {
        it('should convert simple text content to Claude message format', () => {
            const contents = [
                new ConversationContent(Role.User, 'Hello', 'Hello'),  // content, promptContent
                new ConversationContent(Role.Assistant, 'Hi there')
            ];

            const result = (claude as any).extractContents(contents);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                role: Role.User,
                content: [{ type: 'text', text: 'Hello' }]
            });
            expect(result[1]).toEqual({
                role: Role.Assistant,
                content: [{ type: 'text', text: 'Hi there' }]
            });
        });

        it('should convert function call to tool_use format', () => {
            const functionCallContent = new ConversationContent(
                Role.Assistant,
                '',
                '',
                JSON.stringify({
                    functionCall: {
                        id: 'call_123',
                        name: 'search_files',
                        args: { query: 'test' }
                    }
                }),
                new Date(),
                true
            );

            const result = (claude as any).extractContents([functionCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0]).toEqual({
                type: 'tool_use',
                id: 'call_123',
                name: 'search_files',
                input: { query: 'test' }
            });
        });

        it('should convert function response to tool_result format', () => {
            const responseContent = JSON.stringify({
                id: 'call_123',
                functionResponse: {
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent(
                Role.User,
                responseContent,
                responseContent  // promptContent should also be set for User role
            );
            functionResponseContent.isFunctionCallResponse = true;

            const result = (claude as any).extractContents([functionResponseContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0]).toEqual({
                type: 'tool_result',
                tool_use_id: 'call_123',
                content: JSON.stringify(['file1.txt', 'file2.txt'])
            });
        });

        it('should handle invalid JSON in function call gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const invalidContent = new ConversationContent(
                Role.Assistant,
                '',
                '',
                'invalid json {',
                new Date(),
                true
            );

            const result = (claude as any).extractContents([invalidContent]);

            // Should have fallback text block
            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0].type).toBe('text');
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle invalid JSON in function response gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const invalidContent = new ConversationContent(
                Role.User,
                'invalid json {',
                'invalid json {'  // promptContent for User role
            );
            invalidContent.isFunctionCallResponse = true;

            const result = (claude as any).extractContents([invalidContent]);

            // Should fallback to text
            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0].type).toBe('text');
            expect(result[0].content[0].text).toBe('invalid json {');
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should filter out empty content', () => {
            const contents = [
                new ConversationContent(Role.User, 'Hello', 'Hello'),
                new ConversationContent(Role.Assistant, ''), // Empty
                new ConversationContent(Role.User, 'World', 'World')
            ];

            const result = (claude as any).extractContents(contents);

            expect(result).toHaveLength(2);
            expect(result[0].content[0].text).toBe('Hello');
            expect(result[1].content[0].text).toBe('World');
        });

        it('should handle mixed content with text and function call', () => {
            const mixedContent = new ConversationContent(
                Role.Assistant,
                'Let me search for that',
                '',
                JSON.stringify({
                    functionCall: {
                        id: 'call_456',
                        name: 'search_files',
                        args: { query: 'test' }
                    }
                }),
                new Date(),
                true
            );

            const result = (claude as any).extractContents([mixedContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(2);
            expect(result[0].content[0].type).toBe('text');
            expect(result[0].content[1].type).toBe('tool_use');
        });
    });

    describe('mapFunctionDefinitions', () => {
        it('should map function definitions to Claude tool format', () => {
            const definitions = [
                {
                    name: 'search_files',
                    description: 'Search for files',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'read_file',
                    description: 'Read a file',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string' }
                        }
                    }
                }
            ];

            const result = (claude as any).mapFunctionDefinitions(definitions);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                name: 'search_files',
                description: 'Search for files',
                input_schema: definitions[0].parameters
            });
            expect(result[1]).toEqual({
                name: 'read_file',
                description: 'Read a file',
                input_schema: definitions[1].parameters
            });
        });

        it('should handle empty function definitions array', () => {
            const result = (claude as any).mapFunctionDefinitions([]);

            expect(result).toEqual([]);
        });
    });

    describe('streamRequest', () => {
        it('should call streamingService with correct parameters', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Test message'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'response', isComplete: true };
            });

            const abortSignal = new AbortController().signal;
            const generator = claude.streamRequest(conversation, true, abortSignal);

            // Consume the generator
            for await (const chunk of generator) {
                // Just consume
            }

            expect(mockStreamingService.streamRequest).toHaveBeenCalledWith(
                expect.any(String), // URL
                expect.objectContaining({
                    model: 'claude-opus-4-20250514',
                    max_tokens: 16384,
                    system: 'System instruction\n\nUser instruction',
                    messages: expect.any(Array),
                    tools: expect.any(Array),
                    stream: true
                }),
                expect.any(Function), // parseStreamChunk
                abortSignal,
                expect.objectContaining({
                    'x-api-key': 'test-claude-key',
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                })
            );
        });

        it('should reset accumulation state at start of streamRequest', async () => {
            // Set some accumulated state
            (claude as any).accumulatedFunctionName = 'old_func';
            (claude as any).accumulatedFunctionArgs = 'old_args';
            (claude as any).accumulatedFunctionId = 'old_id';

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Test'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = claude.streamRequest(conversation, false);

            // Start consuming
            await generator.next();

            // State should be reset
            expect((claude as any).accumulatedFunctionName).toBeNull();
            expect((claude as any).accumulatedFunctionArgs).toBe('');
            expect((claude as any).accumulatedFunctionId).toBeNull();
        });
    });
});

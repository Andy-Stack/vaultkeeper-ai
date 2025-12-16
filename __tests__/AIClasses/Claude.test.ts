import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Claude } from '../../AIClasses/Claude/Claude';
import { RegisterSingleton, Resolve, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { StreamingService } from '../../Services/StreamingService';
import type { IPrompt } from '../../AIClasses/IPrompt';
import type VaultkeeperAIPlugin from '../../main';
import { AIFunctionDefinitions } from '../../AIClasses/FunctionDefinitions/AIFunctionDefinitions';
import { Conversation } from '../../Conversations/Conversation';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { SettingsService } from '../../Services/SettingsService';
import { AIProvider } from '../../Enums/ApiProvider';
import { AbortService } from '../../Services/AbortService';
import { Exception } from '../../Helpers/Exception';

describe('Claude', () => {
    let claude: Claude;
    let mockStreamingService: any;
    let mockPrompt: any;
    let mockPlugin: any;
    let mockSettingsService: any;
    let mockFunctionDefinitions: any;
    let abortService: AbortService;

    beforeEach(() => {
        // Mock IPrompt
        mockPrompt = {
            systemInstruction: vi.fn().mockReturnValue('System instruction'),
            userInstruction: vi.fn().mockResolvedValue('User instruction')
        };
        RegisterSingleton(Services.IPrompt, mockPrompt);

        // Mock VaultkeeperAIPlugin
        mockPlugin = {};
        RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);

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

        // Create real AbortService instance
        abortService = new AbortService();
        RegisterSingleton(Services.AbortService, abortService);

        // Mock StreamingService
        mockStreamingService = {
            streamRequest: vi.fn()
        };
        RegisterSingleton(Services.StreamingService, mockStreamingService);

        // Mock AIFunctionDefinitions
        mockFunctionDefinitions = {
            getQueryActions: vi.fn().mockReturnValue([
                {
                    name: 'search_vault_filestion',
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
            const plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
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
                    name: 'search_vault_files',
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
                    name: 'search_vault_files',
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
            expect(result.functionCall?.name).toBe('search_vault_files');
            expect(result.functionCall?.arguments).toEqual({ query: 'test' });
            expect(result.functionCall?.toolId).toBe('tool_123');
        });

        it('should handle content_block_stop and finalize function call', () => {
            // Setup
            (claude as any).accumulatedFunctionName = 'search_vault_files';
            (claude as any).accumulatedFunctionArgs = '{"param":"value"}';
            (claude as any).accumulatedFunctionId = 'func_456';

            const chunk = JSON.stringify({
                type: 'content_block_stop'
            });

            const result = (claude as any).parseStreamChunk(chunk);

            expect(result.functionCall).toBeDefined();
            expect(result.functionCall?.name).toBe('search_vault_files');
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
            (claude as any).accumulatedFunctionName = 'search_vault_files';
            (claude as any).accumulatedFunctionArgs = 'invalid json {';
            (claude as any).accumulatedFunctionId = 'func_789';

            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

            const chunk = JSON.stringify({
                type: 'content_block_stop'
            });

            const result = (claude as any).parseStreamChunk(chunk);

            expect(result.functionCall).toBeUndefined();
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should handle malformed chunk JSON', () => {
            const result = (claude as any).parseStreamChunk('invalid json {{{');

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(true);
            expect(result.error).toContain('Failed to parse chunk');
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
                        name: 'search_vault_files',
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
                name: 'search_vault_files',
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
            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

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
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should handle invalid JSON in function response gracefully', () => {
            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

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
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
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
                        name: 'search_vault_files',
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

        it('should convert function call without ID to legacy text format', () => {
            const functionCallContent = new ConversationContent(
                Role.Assistant,
                '',
                '',
                JSON.stringify({
                    functionCall: {
                        name: 'search_vault_files',
                        args: { query: 'test' }
                        // No ID field
                    }
                }),
                new Date(),
                true
            );

            const result = (claude as any).extractContents([functionCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0].type).toBe('text');
            const expected = `<!-- Historical tool call. This action was ALREADY COMPLETED.
     Use your native function calling for any NEW operations. -->
{
  "name": "search_vault_files",
  "args": {
    "query": "test"
  }
}`;
            expect(result[0].content[0].text).toBe(expected);
        });

        it('should convert function call with empty ID to legacy text format', () => {
            const functionCallContent = new ConversationContent(
                Role.Assistant,
                '',
                '',
                JSON.stringify({
                    functionCall: {
                        id: '',  // Empty ID
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                new Date(),
                true
            );

            const result = (claude as any).extractContents([functionCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0].type).toBe('text');
            const expected = `<!-- Historical tool call. This action was ALREADY COMPLETED.
     Use your native function calling for any NEW operations. -->
{
  "name": "search_vault_files",
  "args": {
    "query": "test"
  }
}`;
            expect(result[0].content[0].text).toBe(expected);
        });

        it('should convert function response without ID to legacy text format', () => {
            const responseContent = JSON.stringify({
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
                // No ID field
            });
            const functionResponseContent = new ConversationContent(
                Role.User,
                responseContent,
                responseContent
            );
            functionResponseContent.isFunctionCallResponse = true;

            const result = (claude as any).extractContents([functionResponseContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0].type).toBe('text');
            const expected = `<!-- Historical tool result. This action was ALREADY COMPLETED. -->
{
  "name": "search_vault_files",
  "response": [
    "file1.txt",
    "file2.txt"
  ]
}`;
            expect(result[0].content[0].text).toBe(expected);
        });

        it('should convert function response with empty ID to legacy text format', () => {
            const responseContent = JSON.stringify({
                id: '',  // Empty ID
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent(
                Role.User,
                responseContent,
                responseContent
            );
            functionResponseContent.isFunctionCallResponse = true;

            const result = (claude as any).extractContents([functionResponseContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0].type).toBe('text');
            const expected = `<!-- Historical tool result. This action was ALREADY COMPLETED. -->
{
  "name": "search_vault_files",
  "response": [
    "file1.txt",
    "file2.txt"
  ]
}`;
            expect(result[0].content[0].text).toBe(expected);
        });

        it('should exclude orphaned function calls without responses', () => {
            const contents = [
                new ConversationContent(Role.User, 'Search for files', 'Search for files'),
                // Function call without response (orphaned)
                new ConversationContent(
                    Role.Assistant,
                    '',
                    '',
                    JSON.stringify({
                        functionCall: {
                            id: 'call_orphaned',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    new Date(),
                    true
                ),
                new ConversationContent(Role.User, 'What about this?', 'What about this?')
            ];

            const result = (claude as any).extractContents(contents);

            // Should only have 2 messages (orphaned function call excluded)
            expect(result).toHaveLength(2);
            expect(result[0].content[0].text).toBe('Search for files');
            expect(result[1].content[0].text).toBe('What about this?');
        });

        it('should include function call when it has a corresponding response', () => {
            const contents = [
                new ConversationContent(Role.User, 'Search for files', 'Search for files'),
                // Function call with response (not orphaned)
                new ConversationContent(
                    Role.Assistant,
                    '',
                    '',
                    JSON.stringify({
                        functionCall: {
                            id: 'call_123',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    new Date(),
                    true
                ),
                // Corresponding function response
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call_123',
                        functionResponse: {
                            name: 'search_vault_files',
                            response: ['file1.txt']
                        }
                    });
                    const content = new ConversationContent(Role.User, responseContent, responseContent);
                    content.isFunctionCallResponse = true;
                    return content;
                })()
            ];

            const result = (claude as any).extractContents(contents);

            // Should have all 3 items (function call has response)
            expect(result).toHaveLength(3);
            expect(result[1].content[0].type).toBe('tool_use');
            expect(result[2].content[0].type).toBe('tool_result');
        });

        it('should include function call when it is the most recent item', () => {
            const contents = [
                new ConversationContent(Role.User, 'Search for files', 'Search for files'),
                // Function call as most recent item (should be included)
                new ConversationContent(
                    Role.Assistant,
                    '',
                    '',
                    JSON.stringify({
                        functionCall: {
                            id: 'call_latest',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    new Date(),
                    true
                )
            ];

            const result = (claude as any).extractContents(contents);

            // Should have both items (most recent function call is included)
            expect(result).toHaveLength(2);
            expect(result[1].content[0].type).toBe('tool_use');
            expect(result[1].content[0].id).toBe('call_latest');
        });

        it('should handle multiple orphaned function calls correctly', () => {
            const contents = [
                new ConversationContent(Role.User, 'First message', 'First message'),
                // Orphaned function call #1
                new ConversationContent(
                    Role.Assistant,
                    '',
                    '',
                    JSON.stringify({
                        functionCall: {
                            id: 'call_orphan1',
                            name: 'search_vault_files',
                            args: { query: 'test1' }
                        }
                    }),
                    new Date(),
                    true
                ),
                new ConversationContent(Role.User, 'Second message', 'Second message'),
                // Orphaned function call #2
                new ConversationContent(
                    Role.Assistant,
                    '',
                    '',
                    JSON.stringify({
                        functionCall: {
                            id: 'call_orphan2',
                            name: 'read_file',
                            args: { path: 'test.md' }
                        }
                    }),
                    new Date(),
                    true
                ),
                new ConversationContent(Role.User, 'Third message', 'Third message')
            ];

            const result = (claude as any).extractContents(contents);

            // Should only have the 3 user messages (both orphaned calls excluded)
            expect(result).toHaveLength(3);
            expect(result[0].content[0].text).toBe('First message');
            expect(result[1].content[0].text).toBe('Second message');
            expect(result[2].content[0].text).toBe('Third message');
        });

        it('should handle provider-specific content (images/PDFs) without stringifying', () => {
            // Simulate what formatBinaryFilesForUser returns for an image
            const imageContentBlocks = [
                { type: 'text', text: 'test-image.png' },
                {
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: 'image/png',
                        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                    }
                }
            ];

            const providerSpecificContent = new ConversationContent(
                Role.User,
                JSON.stringify(imageContentBlocks),
                JSON.stringify(imageContentBlocks),
                '',
                new Date(),
                false,
                false,
                true  // isProviderSpecificContent = true
            );

            const result = (claude as any).extractContents([providerSpecificContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(2);

            // First block should be the filename text
            expect(result[0].content[0]).toEqual({
                type: 'text',
                text: 'test-image.png'
            });

            // Second block should be the image with base64 data (NOT stringified)
            expect(result[0].content[1]).toEqual({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                }
            });
        });

        it('should not add provider-specific content as text when isProviderSpecificContent is true', () => {
            // This test ensures the fix for the token usage issue
            const pdfContentBlocks = [
                { type: 'text', text: 'document.pdf' },
                {
                    type: 'document',
                    source: {
                        type: 'base64',
                        media_type: 'application/pdf',
                        data: 'JVBERi0xLjQKJeLjz9MK'
                    }
                }
            ];

            const providerSpecificContent = new ConversationContent(
                Role.User,
                JSON.stringify(pdfContentBlocks),
                JSON.stringify(pdfContentBlocks),
                '',
                new Date(),
                false,
                false,
                true  // isProviderSpecificContent = true
            );

            const result = (claude as any).extractContents([providerSpecificContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(2);

            // Verify no text block with stringified JSON was added
            const textBlocks = result[0].content.filter((block: any) => block.type === 'text');
            expect(textBlocks).toHaveLength(1);
            expect(textBlocks[0].text).toBe('document.pdf');  // Only the filename, not the stringified JSON
        });
    });

    describe('mapFunctionDefinitions', () => {
        it('should map function definitions to Claude tool format', () => {
            const definitions = [
                {
                    name: 'search_vault_files',
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
                name: 'search_vault_files',
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

            const generator = claude.streamRequest(conversation, true);

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

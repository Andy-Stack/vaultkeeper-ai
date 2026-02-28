import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Claude } from '../../AIClasses/Claude/Claude';
import { RegisterSingleton, Resolve, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { StreamingService } from '../../Services/StreamingService';
import type { IPrompt } from '../../AIPrompts/IPrompt';
import type VaultkeeperAIPlugin from '../../main';
import { AIToolDefinitions } from '../../AIClasses/ToolDefinitions/AIToolDefinitions';
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
                    gemini: 'test-gemini-key', mistral: 'test-mistral-key'
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

            expect(prompt).toBe(mockPrompt);
            expect(plugin).toBe(mockPlugin);
            expect(settingsService).toBe(mockSettingsService);
            expect(streaming).toBe(mockStreamingService);
            expect(AIToolDefinitions.agentDefinitions).toBeDefined();
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
            expect(result.toolCall).toBeUndefined();
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

            expect(result.toolCall).toBeDefined();
            expect(result.toolCall?.name).toBe('search_vault_files');
            expect(result.toolCall?.arguments).toEqual({ query: 'test' });
            expect(result.toolCall?.toolId).toBe('tool_123');
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

            expect(result.toolCall).toBeDefined();
            expect(result.toolCall?.name).toBe('search_vault_files');
            expect(result.toolCall?.arguments).toEqual({ param: 'value' });
            expect(result.toolCall?.toolId).toBe('func_456');

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

            expect(result.toolCall).toBeUndefined();
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
        it('should convert simple text content to Claude message format', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' }),
                new ConversationContent({ role: Role.Assistant, content: 'Hi there' })
            ];

            const result = await (claude as any).extractContents(contents);

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

        it('should convert function call to tool_use format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_123',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (claude as any).extractContents([toolCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0]).toEqual({
                type: 'tool_use',
                id: 'call_123',
                name: 'search_vault_files',
                input: { query: 'test' }
            });
        });

        it('should convert function response to tool_result format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_123',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call_123'
            });

            const responseContent = JSON.stringify({
                id: 'call_123',
                functionResponse: {
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent({
                role: Role.User,
                content: responseContent,
                displayContent: responseContent,
                functionResponse: responseContent,
                toolId: 'call_123'
            });

            const result = await (claude as any).extractContents([toolCallContent, functionResponseContent]);

            expect(result).toHaveLength(2);
            expect(result[1].content).toHaveLength(1);
            expect(result[1].content[0]).toEqual({
                type: 'tool_result',
                tool_use_id: 'call_123',
                content: JSON.stringify(['file1.txt', 'file2.txt'])
            });
        });

        it('should handle invalid JSON in function call gracefully', async () => {
            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

            const invalidContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: 'invalid json {',
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (claude as any).extractContents([invalidContent]);

            // Should have fallback text block
            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(1);
            expect(result[0].content[0].type).toBe('text');
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should handle invalid JSON in function response gracefully', async () => {
            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_invalid',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call_invalid'
            });

            const invalidContent = new ConversationContent({
                role: Role.User,
                content: 'invalid json {',
                displayContent: 'invalid json {',
                functionResponse: 'invalid json {',
                toolId: 'call_invalid'
            });

            const result = await (claude as any).extractContents([toolCallContent, invalidContent]);

            // Should fallback to text
            expect(result).toHaveLength(2);
            expect(result[1].content).toHaveLength(1);
            expect(result[1].content[0].type).toBe('text');
            expect(result[1].content[0].text).toBe('invalid json {');
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should filter out empty content', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' }),
                new ConversationContent({ role: Role.Assistant, content: '' }), // Empty
                new ConversationContent({ role: Role.User, content: 'World', displayContent: 'World' })
            ];

            const result = await (claude as any).extractContents(contents);

            expect(result).toHaveLength(2);
            expect(result[0].content[0].text).toBe('Hello');
            expect(result[1].content[0].text).toBe('World');
        });

        it('should handle mixed content with text and function call', async () => {
            const mixedContent = new ConversationContent({
                role: Role.Assistant,
                content: 'Let me search for that',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_456',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (claude as any).extractContents([mixedContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(2);
            expect(result[0].content[0].type).toBe('text');
            expect(result[0].content[1].type).toBe('tool_use');
        });

        it('should convert function call without ID to legacy text format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        name: 'search_vault_files',
                        args: { query: 'test' }
                        // No ID field
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (claude as any).extractContents([toolCallContent]);

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

        it('should convert function call with empty ID to legacy text format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: '',  // Empty ID
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (claude as any).extractContents([toolCallContent]);

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

        it('should convert function response without ID to legacy text format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_legacy',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call_legacy'
            });

            const responseContent = JSON.stringify({
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
                // No ID field
            });
            const functionResponseContent = new ConversationContent({
                role: Role.User,
                content: responseContent,
                displayContent: responseContent,
                functionResponse: responseContent,
                toolId: 'call_legacy'
            });

            const result = await (claude as any).extractContents([toolCallContent, functionResponseContent]);

            expect(result).toHaveLength(2);
            expect(result[1].content).toHaveLength(1);
            expect(result[1].content[0].type).toBe('text');
            const expected = `<!-- Historical tool result. This action was ALREADY COMPLETED. -->
{
  "name": "search_vault_files",
  "response": [
    "file1.txt",
    "file2.txt"
  ]
}`;
            expect(result[1].content[0].text).toBe(expected);
        });

        it('should convert function response with empty ID to legacy text format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_empty',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call_empty'
            });

            const responseContent = JSON.stringify({
                id: '',  // Empty ID
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent({
                role: Role.User,
                content: responseContent,
                displayContent: responseContent,
                functionResponse: responseContent,
                toolId: 'call_empty'
            });

            const result = await (claude as any).extractContents([toolCallContent, functionResponseContent]);

            expect(result).toHaveLength(2);
            expect(result[1].content).toHaveLength(1);
            expect(result[1].content[0].type).toBe('text');
            const expected = `<!-- Historical tool result. This action was ALREADY COMPLETED. -->
{
  "name": "search_vault_files",
  "response": [
    "file1.txt",
    "file2.txt"
  ]
}`;
            expect(result[1].content[0].text).toBe(expected);
        });

        it('should exclude orphaned function calls without responses', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search for files', displayContent: 'Search for files' }),
                // Function call without response (orphaned)
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCall: JSON.stringify({
                        toolCall: {
                            id: 'call_orphaned',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false
                }),
                new ConversationContent({ role: Role.User, content: 'What about this?', displayContent: 'What about this?' })
            ];

            const result = await (claude as any).extractContents(contents);

            // Should only have 2 messages (orphaned function call excluded)
            expect(result).toHaveLength(2);
            expect(result[0].content[0].text).toBe('Search for files');
            expect(result[1].content[0].text).toBe('What about this?');
        });

        it('should include function call when it has a corresponding response', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search for files', displayContent: 'Search for files' }),
                // Function call with response (not orphaned)
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCall: JSON.stringify({
                        toolCall: {
                            id: 'call_123',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false
                }),
                // Corresponding function response
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call_123',
                        functionResponse: {
                            name: 'search_vault_files',
                            response: ['file1.txt']
                        }
                    });
                    return new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent
                    });
                })()
            ];

            const result = await (claude as any).extractContents(contents);

            // Should have all 3 items (function call has response)
            expect(result).toHaveLength(3);
            expect(result[1].content[0].type).toBe('tool_use');
            expect(result[2].content[0].type).toBe('tool_result');
        });

        it('should include function call when it is the most recent item', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search for files', displayContent: 'Search for files' }),
                // Function call as most recent item (should be included)
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCall: JSON.stringify({
                        toolCall: {
                            id: 'call_latest',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false
                })
            ];

            const result = await (claude as any).extractContents(contents);

            // Should have both items (most recent function call is included)
            expect(result).toHaveLength(2);
            expect(result[1].content[0].type).toBe('tool_use');
            expect(result[1].content[0].id).toBe('call_latest');
        });

        it('should handle multiple orphaned function calls correctly', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'First message', displayContent: 'First message' }),
                // Orphaned function call #1
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCall: JSON.stringify({
                        toolCall: {
                            id: 'call_orphan1',
                            name: 'search_vault_files',
                            args: { query: 'test1' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false
                }),
                new ConversationContent({ role: Role.User, content: 'Second message', displayContent: 'Second message' }),
                // Orphaned function call #2
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCall: JSON.stringify({
                        toolCall: {
                            id: 'call_orphan2',
                            name: 'read_file',
                            args: { path: 'test.md' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false
                }),
                new ConversationContent({ role: Role.User, content: 'Third message', displayContent: 'Third message' })
            ];

            const result = await (claude as any).extractContents(contents);

            // Should only have the 3 user messages (both orphaned calls excluded)
            expect(result).toHaveLength(3);
            expect(result[0].content[0].text).toBe('First message');
            expect(result[1].content[0].text).toBe('Second message');
            expect(result[2].content[0].text).toBe('Third message');
        });

        it('should handle attachments with images correctly', async () => {
            // Test with an image attachment that has a file ID
            const attachment = {
                fileName: 'test-image.png',
                mimeType: 'image/png',
                base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                getMimeType: vi.fn(() => 'image/png'),
                getFileID: vi.fn(() => 'file_123'), // Mock file ID
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const content = new ConversationContent({
                role: Role.User,
                content: 'Please analyze this image',
                displayContent: 'Please analyze this image',
                attachments: [attachment as any]
            });

            const result = await (claude as any).extractContents([content]);

            expect(result).toHaveLength(1);
            expect(result[0].content.length).toBeGreaterThan(1);

            // Should have filename text block from formatBinaryFiles
            const filenameBlock = result[0].content.find((block: any) => block.type === 'text' && block.text === 'Binary data for test-image.png follows in next message');
            expect(filenameBlock).toBeDefined();

            // Should have image content blocks from formatBinaryFiles
            const imageBlocks = result[0].content.filter((block: any) => block.type === 'image');
            expect(imageBlocks.length).toBeGreaterThan(0);
        });

        it('should handle attachments with PDFs correctly', async () => {
            // Test with a PDF attachment that has a file ID
            const attachment = {
                fileName: 'document.pdf',
                mimeType: 'application/pdf',
                base64: 'JVBERi0xLjQKJeLjz9MK',
                getMimeType: vi.fn(() => 'application/pdf'),
                getFileID: vi.fn(() => 'file_456'), // Mock file ID
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const content = new ConversationContent({
                role: Role.User,
                content: 'Review this document',
                displayContent: 'Review this document',
                attachments: [attachment as any]
            });

            const result = await (claude as any).extractContents([content]);

            expect(result).toHaveLength(1);
            expect(result[0].content.length).toBeGreaterThan(1);

            // Should have filename text block from formatBinaryFiles
            const filenameBlock = result[0].content.find((block: any) => block.type === 'text' && block.text === 'Binary data for document.pdf follows in next message');
            expect(filenameBlock).toBeDefined();

            // Should have document content blocks from formatBinaryFiles
            const documentBlocks = result[0].content.filter((block: any) => block.type === 'document');
            expect(documentBlocks.length).toBeGreaterThan(0);
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

    describe('addCacheControlToTools', () => {
        it('should add cache control to the last tool in the array', () => {
            const tools = [
                {
                    name: 'search_vault_files',
                    description: 'Search for files',
                    input_schema: {
                        type: 'object' as const,
                        properties: { query: { type: 'string' } }
                    }
                },
                {
                    name: 'read_file',
                    description: 'Read a file',
                    input_schema: {
                        type: 'object' as const,
                        properties: { path: { type: 'string' } }
                    }
                }
            ];

            const result = (claude as any).addCacheControlToTools(tools);

            expect(result).toHaveLength(2);
            expect(result[0]).not.toHaveProperty('cache_control');
            expect(result[1]).toHaveProperty('cache_control');
            expect(result[1].cache_control).toEqual({ type: 'ephemeral' });
        });

        it('should handle single tool array', () => {
            const tools = [
                {
                    name: 'search_vault_files',
                    description: 'Search for files',
                    input_schema: {
                        type: 'object' as const,
                        properties: { query: { type: 'string' } }
                    }
                }
            ];

            const result = (claude as any).addCacheControlToTools(tools);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('cache_control');
            expect(result[0].cache_control).toEqual({ type: 'ephemeral' });
        });

        it('should handle empty tools array', () => {
            const tools: any[] = [];

            const result = (claude as any).addCacheControlToTools(tools);

            expect(result).toHaveLength(0);
            expect(result).toEqual([]);
        });

        it('should not mutate the original tools array', () => {
            const tools = [
                {
                    name: 'search_vault_files',
                    description: 'Search for files',
                    input_schema: {
                        type: 'object' as const,
                        properties: { query: { type: 'string' } }
                    }
                }
            ];

            const result = (claude as any).addCacheControlToTools(tools);

            // Original array should not have cache_control
            expect(tools[0]).not.toHaveProperty('cache_control');
            // Result should have cache_control
            expect(result[0]).toHaveProperty('cache_control');
        });

        it('should add cache control to web_search tool', () => {
            const tools = [
                {
                    type: 'web_search_20250305',
                    name: 'web_search',
                    max_uses: 5
                }
            ];

            const result = (claude as any).addCacheControlToTools(tools);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('cache_control');
            expect(result[0].cache_control).toEqual({ type: 'ephemeral' });
            expect(result[0].type).toBe('web_search_20250305');
            expect(result[0].name).toBe('web_search');
        });
    });

    describe('addCacheControlToMessages', () => {
        it('should add cache control to the last content block of the second-to-last message', () => {
            const messages = [
                {
                    role: Role.User,
                    content: [{ type: 'text' as const, text: 'First message' }]
                },
                {
                    role: Role.Assistant,
                    content: [{ type: 'text' as const, text: 'Second message' }]
                },
                {
                    role: Role.User,
                    content: [{ type: 'text' as const, text: 'Third message' }]
                }
            ];

            const result = (claude as any).addCacheControlToMessages(messages);

            expect(result).toHaveLength(3);
            // First message should not have cache control
            expect(result[0].content[0]).not.toHaveProperty('cache_control');
            // Second message (second-to-last) should have cache control
            expect(result[1].content[0]).toHaveProperty('cache_control');
            expect(result[1].content[0].cache_control).toEqual({ type: 'ephemeral' });
            // Third message (last) should not have cache control
            expect(result[2].content[0]).not.toHaveProperty('cache_control');
        });

        it('should add cache control to the last content block when message has multiple blocks', () => {
            const messages = [
                {
                    role: Role.User,
                    content: [
                        { type: 'text' as const, text: 'First block' },
                        { type: 'text' as const, text: 'Second block' },
                        { type: 'text' as const, text: 'Third block' }
                    ]
                },
                {
                    role: Role.Assistant,
                    content: [{ type: 'text' as const, text: 'Response' }]
                }
            ];

            const result = (claude as any).addCacheControlToMessages(messages);

            expect(result).toHaveLength(2);
            // First message, last block should have cache control
            expect(result[0].content[0]).not.toHaveProperty('cache_control');
            expect(result[0].content[1]).not.toHaveProperty('cache_control');
            expect(result[0].content[2]).toHaveProperty('cache_control');
            expect(result[0].content[2].cache_control).toEqual({ type: 'ephemeral' });
        });

        it('should return messages unchanged when there are fewer than 2 messages', () => {
            const singleMessage = [
                {
                    role: Role.User,
                    content: [{ type: 'text' as const, text: 'Only message' }]
                }
            ];

            const result = (claude as any).addCacheControlToMessages(singleMessage);

            expect(result).toHaveLength(1);
            expect(result[0].content[0]).not.toHaveProperty('cache_control');
        });

        it('should return empty array when messages array is empty', () => {
            const messages: any[] = [];

            const result = (claude as any).addCacheControlToMessages(messages);

            expect(result).toHaveLength(0);
            expect(result).toEqual([]);
        });

        it('should handle messages with empty content blocks', () => {
            const messages = [
                {
                    role: Role.User,
                    content: []
                },
                {
                    role: Role.Assistant,
                    content: [{ type: 'text' as const, text: 'Response' }]
                }
            ];

            const result = (claude as any).addCacheControlToMessages(messages);

            expect(result).toHaveLength(2);
            // Should return original messages since second-to-last has no content
            expect(result).toEqual(messages);
        });

        it('should not mutate the original messages array', () => {
            const messages = [
                {
                    role: Role.User,
                    content: [{ type: 'text' as const, text: 'First' }]
                },
                {
                    role: Role.Assistant,
                    content: [{ type: 'text' as const, text: 'Second' }]
                }
            ];

            const originalFirstContent = messages[0].content[0];
            const result = (claude as any).addCacheControlToMessages(messages);

            // Original should not have cache_control
            expect(originalFirstContent).not.toHaveProperty('cache_control');
            // Result should have cache_control on second-to-last message
            expect(result[0].content[0]).toHaveProperty('cache_control');
        });

        it('should handle messages with tool_use and tool_result blocks', () => {
            const messages = [
                {
                    role: Role.User,
                    content: [{ type: 'text' as const, text: 'Search for files' }]
                },
                {
                    role: Role.Assistant,
                    content: [
                        { type: 'text' as const, text: 'Let me search' },
                        { type: 'tool_use' as const, id: 'call_1', name: 'search', input: {} }
                    ]
                },
                {
                    role: Role.User,
                    content: [
                        { type: 'tool_result' as const, tool_use_id: 'call_1', content: '["file1.txt"]' }
                    ]
                }
            ];

            const result = (claude as any).addCacheControlToMessages(messages);

            expect(result).toHaveLength(3);
            // Second-to-last message's last content block should have cache control
            expect(result[1].content[1]).toHaveProperty('cache_control');
            expect(result[1].content[1].cache_control).toEqual({ type: 'ephemeral' });
        });

        it('should work with exactly 2 messages', () => {
            const messages = [
                {
                    role: Role.User,
                    content: [{ type: 'text' as const, text: 'Hello' }]
                },
                {
                    role: Role.Assistant,
                    content: [{ type: 'text' as const, text: 'Hi' }]
                }
            ];

            const result = (claude as any).addCacheControlToMessages(messages);

            expect(result).toHaveLength(2);
            // First message (second-to-last when length=2) should have cache control
            expect(result[0].content[0]).toHaveProperty('cache_control');
            expect(result[0].content[0].cache_control).toEqual({ type: 'ephemeral' });
            // Second message should not have cache control
            expect(result[1].content[0]).not.toHaveProperty('cache_control');
        });
    });

    describe('streamRequest', () => {
        it('should call streamingService with correct parameters including cache control', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test message' }));

            // Set system prompts before calling streamRequest
            claude.systemPrompt = 'System instruction';
            claude.userInstruction = 'User instruction';
            claude.aiToolDefinitions = [];

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'response', isComplete: true };
            });

            const generator = claude.streamRequest(conversation);

            // Consume the generator
            for await (const chunk of generator) {
                // Just consume
            }

            expect(mockStreamingService.streamRequest).toHaveBeenCalledWith(
                expect.any(String), // URL
                expect.objectContaining({
                    model: 'claude-opus-4-20250514',
                    max_tokens: 16384,
                    system: [
                        {
                            type: 'text',
                            text: 'System instruction\n\nUser instruction',
                            cache_control: { type: 'ephemeral' }
                        }
                    ],
                    messages: expect.any(Array),
                    tools: expect.any(Array),
                    stream: true
                }),
                expect.any(Function), // parseStreamChunk
                expect.objectContaining({
                    'x-api-key': 'test-claude-key',
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }),
                expect.any(Function) // extractRetryDelay
            );
        });

        it('should reset accumulation state at start of streamRequest', async () => {
            // Set some accumulated state
            (claude as any).accumulatedFunctionName = 'old_func';
            (claude as any).accumulatedFunctionArgs = 'old_args';
            (claude as any).accumulatedFunctionId = 'old_id';

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = claude.streamRequest(conversation);

            // Start consuming
            await generator.next();

            // State should be reset
            expect((claude as any).accumulatedFunctionName).toBeNull();
            expect((claude as any).accumulatedFunctionArgs).toBe('');
            expect((claude as any).accumulatedFunctionId).toBeNull();
        });
    });

    describe('formatBinaryFiles', () => {
        it('should format PDF files with document type', () => {
            const attachment = {
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                base64: 'base64encodedcontent',
                getMimeType: vi.fn(() => 'application/pdf'),
                getFileID: vi.fn(() => 'file_pdf_123'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({
                type: 'text',
                text: 'Binary data for report.pdf follows in next message'
            });
            expect(parsed[1]).toEqual({
                type: 'document',
                source: {
                    type: 'file',
                    file_id: 'file_pdf_123'
                }
            });
        });

        it('should format JPEG images with image type', () => {
            const attachment = {
                fileName: 'photo.jpg',
                mimeType: 'image/jpeg',
                base64: 'base64imagedata',
                getMimeType: vi.fn(() => 'image/jpeg'),
                getFileID: vi.fn(() => 'file_img_jpeg'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({
                type: 'text',
                text: 'Binary data for photo.jpg follows in next message'
            });
            expect(parsed[1]).toEqual({
                type: 'image',
                source: {
                    type: 'file',
                    file_id: 'file_img_jpeg'
                }
            });
        });

        it('should format PNG images with image type', () => {
            const attachment = {
                fileName: 'diagram.png',
                mimeType: 'image/png',
                base64: 'base64pngdata',
                getMimeType: vi.fn(() => 'image/png'),
                getFileID: vi.fn(() => 'file_img_png'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[1]).toEqual({
                type: 'image',
                source: {
                    type: 'file',
                    file_id: 'file_img_png'
                }
            });
        });

        it('should format GIF images with image type', () => {
            const attachment = {
                fileName: 'animation.gif',
                mimeType: 'image/gif',
                base64: 'base64gifdata',
                getMimeType: vi.fn(() => 'image/gif'),
                getFileID: vi.fn(() => 'file_img_gif'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[1]).toEqual({
                type: 'image',
                source: {
                    type: 'file',
                    file_id: 'file_img_gif'
                }
            });
        });

        it('should format WebP images with image type', () => {
            const attachment = {
                fileName: 'modern.webp',
                mimeType: 'image/webp',
                base64: 'base64webpdata',
                getMimeType: vi.fn(() => 'image/webp'),
                getFileID: vi.fn(() => 'file_img_webp'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[1]).toEqual({
                type: 'image',
                source: {
                    type: 'file',
                    file_id: 'file_img_webp'
                }
            });
        });

        it('should handle unsupported image formats with error message', () => {
            const attachment = {
                fileName: 'photo.bmp',
                mimeType: 'image/bmp',
                base64: 'base64bmpdata',
                getMimeType: vi.fn(() => 'image/bmp'),
                getFileID: vi.fn(() => 'file_img_bmp'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                type: 'text',
                text: 'Unsupported mime type \'image/bmp\': photo.bmp'
            });
        });

        it('should handle multiple files of different types', () => {
            const attachments = [
                {
                    fileName: 'doc.pdf',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getMimeType: vi.fn(() => 'application/pdf'),
                    getFileID: vi.fn(() => 'file_1'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'image.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getMimeType: vi.fn(() => 'image/jpeg'),
                    getFileID: vi.fn(() => 'file_2'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'screenshot.png',
                    mimeType: 'image/png',
                    base64: 'pngdata',
                    getMimeType: vi.fn(() => 'image/png'),
                    getFileID: vi.fn(() => 'file_3'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = claude.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(6);

            // PDF file
            expect(parsed[0]).toEqual({ type: 'text', text: 'Binary data for doc.pdf follows in next message' });
            expect(parsed[1]).toEqual({
                type: 'document',
                source: {
                    type: 'file',
                    file_id: 'file_1'
                }
            });

            // JPEG image
            expect(parsed[2]).toEqual({ type: 'text', text: 'Binary data for image.jpg follows in next message' });
            expect(parsed[3]).toEqual({
                type: 'image',
                source: {
                    type: 'file',
                    file_id: 'file_2'
                }
            });

            // PNG image
            expect(parsed[4]).toEqual({ type: 'text', text: 'Binary data for screenshot.png follows in next message' });
            expect(parsed[5]).toEqual({
                type: 'image',
                source: {
                    type: 'file',
                    file_id: 'file_3'
                }
            });
        });

        it('should handle mixed supported and unsupported files', () => {
            const attachments = [
                {
                    fileName: 'good.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getMimeType: vi.fn(() => 'image/jpeg'),
                    getFileID: vi.fn(() => 'file_good'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'bad.bmp',
                    mimeType: 'image/bmp',
                    base64: 'bmpdata',
                    getMimeType: vi.fn(() => 'image/bmp'),
                    getFileID: vi.fn(() => 'file_bad'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'doc.pdf',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getMimeType: vi.fn(() => 'application/pdf'),
                    getFileID: vi.fn(() => 'file_pdf'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = claude.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(5);

            expect(parsed[0].type).toBe('text');
            expect(parsed[0].text).toBe('Binary data for good.jpg follows in next message');
            expect(parsed[1].type).toBe('image');
            expect(parsed[2]).toEqual({
                type: 'text',
                text: 'Unsupported mime type \'image/bmp\': bad.bmp'
            });
            expect(parsed[3].type).toBe('text');
            expect(parsed[3].text).toBe('Binary data for doc.pdf follows in next message');
            expect(parsed[4].type).toBe('document');
        });

        it('should skip files without file IDs', () => {
            const attachment = {
                fileName: 'image.png',
                mimeType: 'image/png',
                base64: 'imagedata',
                getMimeType: vi.fn(() => 'image/png'),
                getFileID: vi.fn(() => undefined), // No file ID
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            // Should return empty array when no file ID is available
            expect(parsed).toHaveLength(0);
        });

        it('should handle files with uppercase extensions', () => {
            const attachments = [
                {
                    fileName: 'document.PDF',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getMimeType: vi.fn(() => 'application/pdf'),
                    getFileID: vi.fn(() => 'file_pdf_upper'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'photo.JPG',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getMimeType: vi.fn(() => 'image/jpeg'),
                    getFileID: vi.fn(() => 'file_jpg_upper'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = claude.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(4);
            expect(parsed[0].text).toBe('Binary data for document.PDF follows in next message');
            expect(parsed[1].type).toBe('document');
            expect(parsed[2].text).toBe('Binary data for photo.JPG follows in next message');
            expect(parsed[3].type).toBe('image');
        });

        it('should handle empty files array', () => {
            const attachments: any[] = [];

            const result = claude.formatBinaryFiles(attachments);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(0);
        });

        it('should properly encode filenames with special characters', () => {
            const attachment = {
                fileName: 'report (final) v2.pdf',
                mimeType: 'application/pdf',
                base64: 'pdfdata',
                getMimeType: vi.fn(() => 'application/pdf'),
                getFileID: vi.fn(() => 'file_special'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed[0].text).toBe('Binary data for report (final) v2.pdf follows in next message');
        });

        it('should handle JPEG files with .jpeg extension', () => {
            const attachment = {
                fileName: 'photo.jpeg',
                mimeType: 'image/jpeg',
                base64: 'jpegdata',
                getMimeType: vi.fn(() => 'image/jpeg'),
                getFileID: vi.fn(() => 'file_jpeg_ext'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = claude.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed[1]).toEqual({
                type: 'image',
                source: {
                    type: 'file',
                    file_id: 'file_jpeg_ext'
                }
            });
        });
    });
});

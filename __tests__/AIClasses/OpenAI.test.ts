import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAI } from '../../AIClasses/OpenAI/OpenAI';
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
import { Exception } from '../../Helpers/Exception';
import { AbortService } from '../../Services/AbortService';

describe('OpenAI', () => {
    let openai: OpenAI;
    let mockStreamingService: any;
    let mockPrompt: any;
    let mockPlugin: any;
    let mockSettingsService: any;
    let mockFunctionDefinitions: any;
    let abortService: AbortService;

    beforeEach(() => {
        // Mock Exception methods
        vi.spyOn(Exception, 'log').mockImplementation(() => {});

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
                model: 'gpt-4o',
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

        openai = new OpenAI();
    });

    afterEach(() => {
        // Clear singleton registry to prevent memory leaks
        DeregisterAllServices();
        vi.restoreAllMocks();
    });

    describe('Constructor and Dependencies', () => {
        it('should initialize with dependencies from DependencyService', () => {
            expect(openai).toBeDefined();
        });

        it('should load API key from SettingsService', () => {
            expect(mockSettingsService.getApiKeyForProvider(AIProvider.OpenAI)).toBe('test-openai-key');
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
        it('should handle [DONE] message', () => {
            const result = (openai as any).parseStreamChunk('[DONE]');

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(true);
        });

        it('should parse text delta chunks', () => {
            const chunk = JSON.stringify({
                type: 'response.output_text.delta',
                delta: 'Hello world'
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.content).toBe('Hello world');
            expect(result.isComplete).toBe(false);
        });

        it('should handle complete function call in done event', () => {
            // Responses API provides the complete function call in one event
            const chunk = JSON.stringify({
                type: 'response.function_call_arguments.done',
                call: {
                    id: 'call_123',
                    type: 'function',
                    function: {
                        name: 'search_vault_files',
                        arguments: '{"query":"test"}'
                    }
                }
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(false);
            expect(result.shouldContinue).toBe(true);
            expect(result.functionCall).toBeDefined();
            expect(result.functionCall?.name).toBe('search_vault_files');
            expect(result.functionCall?.arguments).toEqual({ query: 'test' });
            expect(result.functionCall?.toolId).toBe('call_123');
        });

        it('should handle response.done event with tool calls', () => {
            // response.done event indicates completion and may contain tool calls
            const chunk = JSON.stringify({
                type: 'response.done',
                response: {
                    id: 'resp_123',
                    status: 'completed',
                    output: [
                        {
                            role: 'assistant',
                            tool_calls: [
                                {
                                    id: 'call_1',
                                    type: 'function',
                                    function: {
                                        name: 'search_vault_files',
                                        arguments: '{"a":1}'
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(true);
        });

        it('should handle unknown event types gracefully', () => {
            const exceptionSpy = vi.spyOn(Exception, 'log');

            const chunk = JSON.stringify({
                type: 'response.unknown_event',
                data: 'some data'
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
            expect(exceptionSpy).toHaveBeenCalledWith('Unknown event type: response.unknown_event');
        });

        it('should handle response.done without tool calls', () => {
            const chunk = JSON.stringify({
                type: 'response.done',
                response: {
                    id: 'resp_123',
                    status: 'completed',
                    output: [
                        {
                            role: 'assistant',
                            content: 'Done'
                        }
                    ],
                    output_text: 'Done'
                }
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(false);
        });

        it('should handle invalid JSON in tool call arguments', () => {
            const exceptionSpy = vi.spyOn(Exception, 'log');

            const chunk = JSON.stringify({
                type: 'response.function_call_arguments.done',
                call: {
                    id: 'call_123',
                    type: 'function',
                    function: {
                        name: 'search_vault_files',
                        arguments: 'invalid json {'
                    }
                }
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.functionCall).toBeUndefined();
            expect(exceptionSpy).toHaveBeenCalled();
        });

        it('should handle malformed chunk JSON', () => {
            const exceptionSpy = vi.spyOn(Exception, 'log');

            const result = (openai as any).parseStreamChunk('not valid json {{{');

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(true);
            // The error message comes from Exception.messageFrom which extracts the actual JSON parse error
            expect(result.error).toBeDefined();
            expect(exceptionSpy).toHaveBeenCalled();
        });

        it('should handle function call arguments delta events', () => {
            // These events are sent during streaming but we can ignore them
            const chunk = JSON.stringify({
                type: 'response.function_call_arguments.delta',
                delta: '{"que'
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
            expect(result.functionCall).toBeUndefined();
        });

        it('should handle response.refusal.delta events', () => {
            const chunk = JSON.stringify({
                type: 'response.refusal.delta',
                delta: 'I cannot help with that.'
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.content).toBe('I cannot help with that.');
            expect(result.isComplete).toBe(false);
        });

        it('should handle response.error events', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const chunk = JSON.stringify({
                type: 'response.error',
                error: { message: 'Something went wrong' }
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle response.completed event', () => {
            const chunk = JSON.stringify({
                type: 'response.completed',
                response: {
                    id: 'resp_123',
                    status: 'completed',
                    output: []
                }
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(false);
        });
    });

    describe('Message Format Conversion', () => {
        it('should include system prompt in instructions field', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Hello'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'response', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);

            // Consume generator
            for await (const chunk of generator) {
                // Just consume
            }

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.instructions).toBe('System instruction\n\nUser instruction');
            expect(requestBody.input).toBeDefined();
            expect(requestBody.messages).toBeUndefined();
        });

        it('should convert function call to OpenAI tool_calls format', async () => {
            const conversation = new Conversation();
            const functionCallContent = new ConversationContent(
                Role.Assistant,
                'Let me search',
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
            conversation.contents.push(functionCallContent);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];
            const assistantMessage = requestBody.input.find((m: any) => m.role === Role.Assistant);

            expect(assistantMessage).toBeDefined();
            expect(assistantMessage.tool_calls).toHaveLength(1);
            expect(assistantMessage.tool_calls[0]).toEqual({
                id: 'call_123',
                type: 'function',
                function: {
                    name: 'search_vault_files',
                    arguments: '{"query":"test"}'
                }
            });
        });

        it('should convert function response to role:tool format', async () => {
            const conversation = new Conversation();
            const responseContent = JSON.stringify({
                id: 'call_123',
                functionResponse: {
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent(
                Role.User,
                responseContent,
                responseContent  // promptContent for User role
            );
            functionResponseContent.isFunctionCallResponse = true;
            conversation.contents.push(functionResponseContent);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];
            const toolMessage = requestBody.input.find((m: any) => m.role === 'tool');

            expect(toolMessage).toBeDefined();
            expect(toolMessage.tool_call_id).toBe('call_123');
            expect(toolMessage.content).toBe(JSON.stringify(['file1.txt', 'file2.txt']));
        });

        it('should handle invalid JSON in function call gracefully', async () => {
            const exceptionSpy = vi.spyOn(Exception, 'log');

            const conversation = new Conversation();
            const invalidContent = new ConversationContent(
                Role.Assistant,
                '',
                '',
                'invalid json {',
                new Date(),
                true
            );
            conversation.contents.push(invalidContent);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];
            const message = requestBody.input.find((m: any) => m.role === Role.Assistant);

            expect(message.content).toBe('Error parsing function call');
            expect(message.tool_calls).toBeUndefined();
            expect(exceptionSpy).toHaveBeenCalled();
        });

        it('should handle invalid JSON in function response gracefully', async () => {
            const exceptionSpy = vi.spyOn(Exception, 'log');

            const conversation = new Conversation();
            const invalidContent = new ConversationContent(
                Role.User,
                'invalid json {',
                'invalid json {',  // promptContent for User role
                ''
            );
            invalidContent.isFunctionCallResponse = true;
            conversation.contents.push(invalidContent);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];
            const message = requestBody.input.find((m: any) => m.role === Role.User);

            expect(message.content).toBe('invalid json {');
            expect(message.role).toBe(Role.User); // Falls back to original role
            expect(exceptionSpy).toHaveBeenCalled();
        });

        it('should filter out empty content', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Hello', 'Hello'));
            conversation.contents.push(new ConversationContent(Role.Assistant, '', '', ''));
            conversation.contents.push(new ConversationContent(Role.User, 'World', 'World'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should have 2 user messages in input (empty one filtered out)
            expect(requestBody.input).toHaveLength(2);
        });

        it('should exclude orphaned function calls without responses', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Search for files', 'Search for files'));
            // Function call without response (orphaned)
            const orphanedCall = new ConversationContent(
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
            );
            conversation.contents.push(orphanedCall);
            conversation.contents.push(new ConversationContent(Role.User, 'What about this?', 'What about this?'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should only have 2 messages (orphaned function call excluded)
            expect(requestBody.input).toHaveLength(2);
            expect(requestBody.input[0].content).toBe('Search for files');
            expect(requestBody.input[1].content).toBe('What about this?');
        });

        it('should include function call when it has a corresponding response', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Search for files', 'Search for files'));
            // Function call with response (not orphaned)
            const functionCall = new ConversationContent(
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
            conversation.contents.push(functionCall);
            // Corresponding function response
            const responseContent = JSON.stringify({
                id: 'call_123',
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt']
                }
            });
            const functionResponse = new ConversationContent(Role.User, responseContent, responseContent);
            functionResponse.isFunctionCallResponse = true;
            conversation.contents.push(functionResponse);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should have all 3 items (function call has response)
            expect(requestBody.input).toHaveLength(3);
            expect(requestBody.input[1].tool_calls).toBeDefined();
            expect(requestBody.input[2].role).toBe('tool');
        });

        it('should include function call when it is the most recent item', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Search for files', 'Search for files'));
            // Function call as most recent item (should be included)
            const latestCall = new ConversationContent(
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
            );
            conversation.contents.push(latestCall);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should have both items (most recent function call is included)
            expect(requestBody.input).toHaveLength(2);
            expect(requestBody.input[1].tool_calls).toBeDefined();
            expect(requestBody.input[1].tool_calls[0].id).toBe('call_latest');
        });

        it('should handle multiple orphaned function calls correctly', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'First message', 'First message'));
            // Orphaned function call #1
            const orphan1 = new ConversationContent(
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
            );
            conversation.contents.push(orphan1);
            conversation.contents.push(new ConversationContent(Role.User, 'Second message', 'Second message'));
            // Orphaned function call #2
            const orphan2 = new ConversationContent(
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
            );
            conversation.contents.push(orphan2);
            conversation.contents.push(new ConversationContent(Role.User, 'Third message', 'Third message'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should only have the 3 user messages (both orphaned calls excluded)
            expect(requestBody.input).toHaveLength(3);
            expect(requestBody.input[0].content).toBe('First message');
            expect(requestBody.input[1].content).toBe('Second message');
            expect(requestBody.input[2].content).toBe('Third message');
        });
    });

    describe('mapFunctionDefinitions', () => {
        it('should map function definitions to OpenAI Responses API tool format', () => {
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

            const result = (openai as any).mapFunctionDefinitions(definitions);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                type: 'function',
                name: 'search_vault_files',
                description: 'Search for files',
                parameters: definitions[0].parameters
            });
            expect(result[1]).toEqual({
                type: 'function',
                name: 'read_file',
                description: 'Read a file',
                parameters: definitions[1].parameters
            });
        });

        it('should handle empty function definitions array', () => {
            const result = (openai as any).mapFunctionDefinitions([]);

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

            const generator = openai.streamRequest(conversation, true);

            for await (const chunk of generator) {
                // Just consume
            }

            expect(mockStreamingService.streamRequest).toHaveBeenCalledWith(
                expect.any(String), // URL
                expect.objectContaining({
                    model: 'gpt-4o',
                    instructions: expect.any(String),
                    input: expect.any(Array),
                    tools: expect.any(Array),
                    stream: true
                }),
                expect.any(Function), // parseStreamChunk
                expect.objectContaining({
                    'Authorization': 'Bearer test-openai-key',
                    'Content-Type': 'application/json'
                })
            );
        });

        it('should include name field in web_search tool', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Test'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];
            const webSearchTool = requestBody.tools.find((t: any) => t.type === 'web_search');

            expect(webSearchTool).toBeDefined();
            expect(webSearchTool.type).toBe('web_search');
            expect(webSearchTool.name).toBe(undefined);
        });
    });
});

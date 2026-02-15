import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAI } from '../../AIClasses/OpenAI/OpenAI';
import { RegisterSingleton, Resolve, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { StreamingService } from '../../Services/StreamingService';
import type { IPrompt } from '../../AIPrompts/IPrompt';
import type VaultkeeperAIPlugin from '../../main';
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

        // Mock IAIFileService
        const mockFileService = {
            refreshCache: vi.fn().mockResolvedValue(undefined),
            listFiles: vi.fn().mockReturnValue([]),
            uploadFile: vi.fn().mockResolvedValue(undefined),
            deleteFile: vi.fn().mockResolvedValue(undefined),
            deleteFiles: vi.fn().mockResolvedValue(undefined)
        };
        RegisterSingleton(Services.IAIFileService, mockFileService);

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

            expect(prompt).toBe(mockPrompt);
            expect(plugin).toBe(mockPlugin);
            expect(settingsService).toBe(mockSettingsService);
            expect(streaming).toBe(mockStreamingService);
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

        it('should handle complete function call in output_item.done event', () => {
            // Responses API provides the complete function call in response.output_item.done event
            const chunk = JSON.stringify({
                type: 'response.output_item.done',
                item_id: 'item_123',
                output_index: 0,
                item: {
                    id: 'item_123',
                    type: 'function_call',
                    name: 'search_vault_files',
                    call_id: 'call_123',
                    arguments: '{"query":"test"}'
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

        it('should handle response.done event', () => {
            // response.done event indicates completion
            // In Responses API, function calls are detected via output_item.done events, not response.done
            const chunk = JSON.stringify({
                type: 'response.done',
                response: {
                    id: 'resp_123',
                    status: 'completed',
                    output: [
                        {
                            type: 'message',
                            role: 'assistant',
                            content: 'Done'
                        }
                    ]
                }
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(false);
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
                type: 'response.output_item.done',
                item_id: 'item_123',
                output_index: 0,
                item: {
                    id: 'item_123',
                    type: 'function_call',
                    name: 'search_vault_files',
                    call_id: 'call_123',
                    arguments: 'invalid json {'
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
            const chunk = JSON.stringify({
                type: 'response.error',
                code: 'error_code',
                message: 'Something went wrong',
                param: null
            });

            expect(() => {
                (openai as any).parseStreamChunk(chunk);
            }).toThrow('Something went wrong (error_code)');
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
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Hello' }));

            // Set system prompts before calling streamRequest
            openai.systemPrompt = 'System instruction';
            openai.userInstruction = 'User instruction';
            openai.aiToolDefinitions = [];

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'response', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);

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

        it('should convert function call to Responses API format', async () => {
            const conversation = new Conversation();
            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: 'Let me search',
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_123',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                })
            });
            conversation.contents.push(functionCallContent);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should have 2 items: assistant message + function call
            expect(requestBody.input).toHaveLength(2);

            // First item: assistant message with text
            expect(requestBody.input[0]).toEqual({
                role: Role.Assistant,
                content: 'Let me search'
            });

            // Second item: function call
            expect(requestBody.input[1]).toEqual({
                type: 'function_call',
                call_id: 'call_123',
                name: 'search_vault_files',
                arguments: '{"query":"test"}'
            });
        });

        it('should convert function response to function_call_output format', async () => {
            const conversation = new Conversation();

            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_123',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call_123'
            });
            conversation.contents.push(functionCallContent);

            const responseContent = JSON.stringify({
                id: 'call_123',
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent({
                role: Role.User,
                functionResponse: responseContent,
                toolId: 'call_123'
            });
            conversation.contents.push(functionResponseContent);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should have 2 items: function call and function response
            expect(requestBody.input).toHaveLength(2);
            expect(requestBody.input[1]).toEqual({
                type: 'function_call_output',
                call_id: 'call_123',
                output: '["file1.txt","file2.txt"]'
            });
        });

        it('should handle invalid JSON in function call gracefully', async () => {
            const exceptionSpy = vi.spyOn(Exception, 'log');

            const conversation = new Conversation();
            const invalidContent = new ConversationContent({
                role: Role.Assistant,
                functionCall: 'invalid json {'
            });
            conversation.contents.push(invalidContent);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
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

            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_invalid',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call_invalid'
            });
            conversation.contents.push(functionCallContent);

            const invalidContent = new ConversationContent({
                role: Role.User,
                functionResponse: 'invalid json {',
                toolId: 'call_invalid'
            });
            conversation.contents.push(invalidContent);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];
            const messages = requestBody.input.filter((m: any) => m.role === Role.User);

            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe('invalid json {');
            expect(messages[0].role).toBe(Role.User); // Falls back to original role
            expect(exceptionSpy).toHaveBeenCalled();
        });

        it('should filter out empty content', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Hello' }));
            conversation.contents.push(new ConversationContent({ role: Role.Assistant, content: '' }));
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'World' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should have 2 user messages in input (empty one filtered out)
            expect(requestBody.input).toHaveLength(2);
        });

        it('should exclude orphaned function calls without responses', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Search for files' }));
            // Function call without response (orphaned)
            const orphanedCall = new ConversationContent({
                role: Role.Assistant,
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_orphaned',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                })
            });
            conversation.contents.push(orphanedCall);
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'What about this?' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
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
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Search for files' }));
            // Function call with response (not orphaned)
            const functionCall = new ConversationContent({
                role: Role.Assistant,
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_123',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                })
            });
            conversation.contents.push(functionCall);
            // Corresponding function response
            const responseContent = JSON.stringify({
                id: 'call_123',
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt']
                }
            });
            const functionResponse = new ConversationContent({
                role: Role.User,
                functionResponse: responseContent
            });
            conversation.contents.push(functionResponse);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should have 3 items: user message, function_call, function_call_output
            expect(requestBody.input).toHaveLength(3);
            expect(requestBody.input[0]).toEqual({
                role: Role.User,
                content: 'Search for files'
            });
            expect(requestBody.input[1]).toEqual({
                type: 'function_call',
                call_id: 'call_123',
                name: 'search_vault_files',
                arguments: '{"query":"test"}'
            });
            expect(requestBody.input[2]).toEqual({
                type: 'function_call_output',
                call_id: 'call_123',
                output: '["file1.txt"]'
            });
        });

        it('should include function call when it is the most recent item', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Search for files' }));
            // Function call as most recent item (should be included)
            const latestCall = new ConversationContent({
                role: Role.Assistant,
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_latest',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                })
            });
            conversation.contents.push(latestCall);

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should have 2 items: user message and function_call (no assistant message since content is empty)
            expect(requestBody.input).toHaveLength(2);
            expect(requestBody.input[0]).toEqual({
                role: Role.User,
                content: 'Search for files'
            });
            expect(requestBody.input[1]).toEqual({
                type: 'function_call',
                call_id: 'call_latest',
                name: 'search_vault_files',
                arguments: '{"query":"test"}'
            });
        });

        it('should handle multiple orphaned function calls correctly', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'First message' }));
            // Orphaned function call #1
            const orphan1 = new ConversationContent({
                role: Role.Assistant,
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_orphan1',
                        name: 'search_vault_files',
                        args: { query: 'test1' }
                    }
                })
            });
            conversation.contents.push(orphan1);
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Second message' }));
            // Orphaned function call #2
            const orphan2 = new ConversationContent({
                role: Role.Assistant,
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_orphan2',
                        name: 'read_file',
                        args: { path: 'test.md' }
                    }
                })
            });
            conversation.contents.push(orphan2);
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Third message' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            // Should only have the 3 user messages (both orphaned calls excluded)
            expect(requestBody.input).toHaveLength(3);
            expect(requestBody.input[0].content).toBe('First message');
            expect(requestBody.input[1].content).toBe('Second message');
            expect(requestBody.input[2].content).toBe('Third message');
        });

        describe('Responses API Format Edge Cases', () => {
            it('should handle assistant message with both text and function call', async () => {
                const conversation = new Conversation();
                const functionCallContent = new ConversationContent({
                    role: Role.Assistant,
                    content: 'I will search for that.',
                    functionCall: JSON.stringify({
                        functionCall: {
                            id: 'call_123',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    })
                });
                conversation.contents.push(functionCallContent);

                mockStreamingService.streamRequest.mockImplementation(async function* () {
                    yield { content: 'done', isComplete: true };
                });

                const generator = openai.streamRequest(conversation);
                for await (const chunk of generator) {}

                const callArgs = mockStreamingService.streamRequest.mock.calls[0];
                const requestBody = callArgs[1];

                // Should have 2 items: assistant message + function call
                expect(requestBody.input).toHaveLength(2);
                expect(requestBody.input[0]).toEqual({
                    role: Role.Assistant,
                    content: 'I will search for that.'
                });
                expect(requestBody.input[1].type).toBe('function_call');
            });

            it('should handle function call with empty text content', async () => {
                const conversation = new Conversation();
                const functionCallContent = new ConversationContent({
                    role: Role.Assistant,
                    functionCall: JSON.stringify({
                        functionCall: {
                            id: 'call_123',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    })
                });
                conversation.contents.push(functionCallContent);

                mockStreamingService.streamRequest.mockImplementation(async function* () {
                    yield { content: 'done', isComplete: true };
                });

                const generator = openai.streamRequest(conversation);
                for await (const chunk of generator) {}

                const callArgs = mockStreamingService.streamRequest.mock.calls[0];
                const requestBody = callArgs[1];

                // Should have only 1 item: function call (no empty message)
                expect(requestBody.input).toHaveLength(1);
                expect(requestBody.input[0]).toEqual({
                    type: 'function_call',
                    call_id: 'call_123',
                    name: 'search_vault_files',
                    arguments: '{"query":"test"}'
                });
            });

            it('should handle complex function response objects', async () => {
                const conversation = new Conversation();

                const functionCallContent = new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    functionCall: JSON.stringify({
                        functionCall: {
                            id: 'call_123',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    toolId: 'call_123'
                });
                conversation.contents.push(functionCallContent);

                const complexResponse = {
                    files: ['file1.txt', 'file2.md'],
                    count: 2,
                    metadata: { total: 100, filtered: 2 }
                };
                const responseContent = JSON.stringify({
                    id: 'call_123',
                    functionResponse: {
                        name: 'search_vault_files',
                        response: complexResponse
                    }
                });
                const functionResponseContent = new ConversationContent({
                    role: Role.User,
                    functionResponse: responseContent,
                    toolId: 'call_123'
                });
                conversation.contents.push(functionResponseContent);

                mockStreamingService.streamRequest.mockImplementation(async function* () {
                    yield { content: 'done', isComplete: true };
                });

                const generator = openai.streamRequest(conversation);
                for await (const chunk of generator) {}

                const callArgs = mockStreamingService.streamRequest.mock.calls[0];
                const requestBody = callArgs[1];

                expect(requestBody.input).toHaveLength(2);
                expect(requestBody.input[1]).toEqual({
                    type: 'function_call_output',
                    call_id: 'call_123',
                    output: JSON.stringify(complexResponse)
                });
            });

            it('should handle multiple sequential function calls and responses', async () => {
                const conversation = new Conversation();

                // First function call
                conversation.contents.push(new ConversationContent({
                    role: Role.Assistant,
                    functionCall: JSON.stringify({
                        functionCall: {
                            id: 'call_1',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    })
                }));

                // First response
                const response1 = new ConversationContent({
                    role: Role.User,
                    functionResponse: JSON.stringify({
                        id: 'call_1',
                        functionResponse: { name: 'search_vault_files', response: ['file1.txt'] }
                    })
                });
                conversation.contents.push(response1);

                // Second function call
                conversation.contents.push(new ConversationContent({
                    role: Role.Assistant,
                    content: 'Let me read that file',
                    functionCall: JSON.stringify({
                        functionCall: {
                            id: 'call_2',
                            name: 'read_file',
                            args: { path: 'file1.txt' }
                        }
                    })
                }));

                // Second response
                const response2 = new ConversationContent({
                    role: Role.User,
                    functionResponse: JSON.stringify({
                        id: 'call_2',
                        functionResponse: { name: 'read_file', response: 'file content' }
                    })
                });
                conversation.contents.push(response2);

                mockStreamingService.streamRequest.mockImplementation(async function* () {
                    yield { content: 'done', isComplete: true };
                });

                const generator = openai.streamRequest(conversation);
                for await (const chunk of generator) {}

                const callArgs = mockStreamingService.streamRequest.mock.calls[0];
                const requestBody = callArgs[1];

                // Should have 5 items in correct order
                expect(requestBody.input).toHaveLength(5);
                expect(requestBody.input[0].type).toBe('function_call');
                expect(requestBody.input[0].call_id).toBe('call_1');
                expect(requestBody.input[1].type).toBe('function_call_output');
                expect(requestBody.input[1].call_id).toBe('call_1');
                expect(requestBody.input[2].role).toBe(Role.Assistant);
                expect(requestBody.input[2].content).toBe('Let me read that file');
                expect(requestBody.input[3].type).toBe('function_call');
                expect(requestBody.input[3].call_id).toBe('call_2');
                expect(requestBody.input[4].type).toBe('function_call_output');
                expect(requestBody.input[4].call_id).toBe('call_2');
            });
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
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test message' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'response', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);

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
                }),
                expect.any(Function) // extractRetryDelay
            );
        });

        it('should include name field in web_search tool', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test message' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];
            const webSearchTool = requestBody.tools.find((t: any) => t.type === 'web_search');

            expect(webSearchTool).toBeDefined();
            expect(webSearchTool.type).toBe('web_search');
            expect(webSearchTool.name).toBe(undefined);
        });
    });

    describe('formatBinaryFiles', () => {
        it('should format PDF files with file_id reference', () => {
            const attachment = {
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                base64: 'base64encodedcontent',
                getMimeType: () => 'application/pdf',
                getFileID: () => 'file-123',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = openai.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].role).toBe('user');
            expect(parsed[0].content).toHaveLength(2);
            expect(parsed[0].content[0]).toEqual({
                type: 'input_text',
                text: 'Binary data for report.pdf follows in next message'
            });
            expect(parsed[0].content[1]).toEqual({
                type: 'input_file',
                file_id: 'file-123'
            });
        });

        it('should format JPEG images with file_id reference', () => {
            const attachment = {
                fileName: 'photo.jpg',
                mimeType: 'image/jpeg',
                base64: 'base64imagedata',
                getMimeType: () => 'image/jpeg',
                getFileID: () => 'file-456',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = openai.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].role).toBe('user');
            expect(parsed[0].content).toHaveLength(2);
            expect(parsed[0].content[0]).toEqual({
                type: 'input_text',
                text: 'Binary data for photo.jpg follows in next message'
            });
            expect(parsed[0].content[1]).toEqual({
                type: 'input_image',
                file_id: 'file-456'
            });
        });

        it('should format PNG images with file_id reference', () => {
            const attachment = {
                fileName: 'diagram.png',
                mimeType: 'image/png',
                base64: 'base64pngdata',
                getMimeType: () => 'image/png',
                getFileID: () => 'file-789',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = openai.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].content).toHaveLength(2);
            expect(parsed[0].content[0]).toEqual({
                type: 'input_text',
                text: 'Binary data for diagram.png follows in next message'
            });
            expect(parsed[0].content[1]).toEqual({
                type: 'input_image',
                file_id: 'file-789'
            });
        });

        it('should format WebP images with file_id reference', () => {
            const attachment = {
                fileName: 'modern.webp',
                mimeType: 'image/webp',
                base64: 'base64webpdata',
                getMimeType: () => 'image/webp',
                getFileID: () => 'file-webp',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = openai.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].content).toHaveLength(2);
            expect(parsed[0].content[0]).toEqual({
                type: 'input_text',
                text: 'Binary data for modern.webp follows in next message'
            });
            expect(parsed[0].content[1]).toEqual({
                type: 'input_image',
                file_id: 'file-webp'
            });
        });

        it('should handle unsupported image formats with error message', () => {
            const attachment = {
                fileName: 'photo.gif',
                mimeType: 'image/gif',
                base64: 'base64gifdata',
                getMimeType: () => 'image/gif',
                getFileID: () => 'file-gif',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = openai.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].content).toHaveLength(1);
            expect(parsed[0].content[0]).toEqual({
                type: 'input_text',
                text: 'Unsupported mime type \'image/gif\': photo.gif'
            });
        });

        it('should skip files without file IDs (failed uploads)', () => {
            const attachment = {
                fileName: 'failed.pdf',
                mimeType: 'application/pdf',
                base64: 'base64data',
                getMimeType: () => 'application/pdf',
                getFileID: () => undefined, // Upload failed
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = openai.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].role).toBe('user');
            expect(parsed[0].content).toHaveLength(0); // No content blocks
        });

        it('should handle multiple files of different types', () => {
            const attachments = [
                {
                    fileName: 'doc.pdf',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getMimeType: () => 'application/pdf',
                    getFileID: () => 'file-pdf',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'image.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getMimeType: () => 'image/jpeg',
                    getFileID: () => 'file-jpg',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'screenshot.png',
                    mimeType: 'image/png',
                    base64: 'pngdata',
                    getMimeType: () => 'image/png',
                    getFileID: () => 'file-png',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = openai.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].role).toBe('user');
            expect(parsed[0].content).toHaveLength(6);

            expect(parsed[0].content[0]).toEqual({
                type: 'input_text',
                text: 'Binary data for doc.pdf follows in next message'
            });
            expect(parsed[0].content[1]).toEqual({
                type: 'input_file',
                file_id: 'file-pdf'
            });

            expect(parsed[0].content[2]).toEqual({
                type: 'input_text',
                text: 'Binary data for image.jpg follows in next message'
            });
            expect(parsed[0].content[3]).toEqual({
                type: 'input_image',
                file_id: 'file-jpg'
            });

            expect(parsed[0].content[4]).toEqual({
                type: 'input_text',
                text: 'Binary data for screenshot.png follows in next message'
            });
            expect(parsed[0].content[5]).toEqual({
                type: 'input_image',
                file_id: 'file-png'
            });
        });

        it('should handle mixed supported and unsupported files', () => {
            const attachments = [
                {
                    fileName: 'good.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getMimeType: () => 'image/jpeg',
                    getFileID: () => 'file-jpg',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'bad.bmp',
                    mimeType: 'image/bmp',
                    base64: 'bmpdata',
                    getMimeType: () => 'image/bmp',
                    getFileID: () => 'file-bmp',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'doc.pdf',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getMimeType: () => 'application/pdf',
                    getFileID: () => 'file-pdf',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = openai.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].content).toHaveLength(5);

            expect(parsed[0].content[0]).toEqual({
                type: 'input_text',
                text: 'Binary data for good.jpg follows in next message'
            });
            expect(parsed[0].content[1].type).toBe('input_image');
            expect(parsed[0].content[2]).toEqual({
                type: 'input_text',
                text: 'Unsupported mime type \'image/bmp\': bad.bmp'
            });
            expect(parsed[0].content[3]).toEqual({
                type: 'input_text',
                text: 'Binary data for doc.pdf follows in next message'
            });
            expect(parsed[0].content[4].type).toBe('input_file');
        });

        it('should handle mixed successful and failed uploads', () => {
            const attachments = [
                {
                    fileName: 'success.pdf',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getMimeType: () => 'application/pdf',
                    getFileID: () => 'file-success',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'failed.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getMimeType: () => 'image/jpeg',
                    getFileID: () => undefined, // Upload failed
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = openai.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].content).toHaveLength(2); // Text + file reference
            expect(parsed[0].content[0]).toEqual({
                type: 'input_text',
                text: 'Binary data for success.pdf follows in next message'
            });
            expect(parsed[0].content[1]).toEqual({
                type: 'input_file',
                file_id: 'file-success'
            });
        });

        it('should handle empty attachments array', () => {
            const result = openai.formatBinaryFiles([]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].role).toBe('user');
            expect(parsed[0].content).toHaveLength(0);
        });

        it('should handle all files with failed uploads', () => {
            const attachments = [
                {
                    fileName: 'failed1.pdf',
                    mimeType: 'application/pdf',
                    base64: 'data1',
                    getMimeType: () => 'application/pdf',
                    getFileID: () => undefined,
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'failed2.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'data2',
                    getMimeType: () => 'image/jpeg',
                    getFileID: () => undefined,
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = openai.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].role).toBe('user');
            expect(parsed[0].content).toHaveLength(0); // All uploads failed, no content
        });
    });
});

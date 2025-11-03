import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAI } from '../../AIClasses/OpenAI/OpenAI';
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

describe('OpenAI', () => {
    let openai: OpenAI;
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

        openai = new OpenAI();
    });

    afterEach(() => {
        // Clear singleton registry to prevent memory leaks
        DeregisterAllServices();
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
        it('should handle [DONE] message', () => {
            const result = (openai as any).parseStreamChunk('[DONE]');

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(true);
        });

        it('should parse text delta chunks', () => {
            const chunk = JSON.stringify({
                choices: [{
                    delta: {
                        content: 'Hello world'
                    }
                }]
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.content).toBe('Hello world');
            expect(result.isComplete).toBe(false);
        });

        it('should accumulate tool calls by index', () => {
            // First chunk - start tool call at index 0
            const chunk1 = JSON.stringify({
                choices: [{
                    delta: {
                        tool_calls: [{
                            index: 0,
                            id: 'call_123',
                            function: {
                                name: 'search_files',
                                arguments: '{"qu'
                            }
                        }]
                    }
                }]
            });

            (openai as any).parseStreamChunk(chunk1);

            // Second chunk - continue accumulating
            const chunk2 = JSON.stringify({
                choices: [{
                    delta: {
                        tool_calls: [{
                            index: 0,
                            function: {
                                arguments: 'ery":"test"}'
                            }
                        }]
                    }
                }]
            });

            (openai as any).parseStreamChunk(chunk2);

            // Third chunk - finish with tool_calls reason
            const chunk3 = JSON.stringify({
                choices: [{
                    delta: {},
                    finish_reason: 'tool_calls'
                }]
            });

            const result = (openai as any).parseStreamChunk(chunk3);

            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(true);
            expect(result.functionCall).toBeDefined();
            expect(result.functionCall?.name).toBe('search_files');
            expect(result.functionCall?.arguments).toEqual({ query: 'test' });
            expect(result.functionCall?.toolId).toBe('call_123');
        });

        it('should handle multiple concurrent tool calls but only return first', () => {
            // OpenAI can send multiple tool calls with different indices
            const chunk = JSON.stringify({
                choices: [{
                    delta: {
                        tool_calls: [
                            {
                                index: 0,
                                id: 'call_1',
                                function: {
                                    name: 'first_func',
                                    arguments: '{"a":1}'
                                }
                            },
                            {
                                index: 1,
                                id: 'call_2',
                                function: {
                                    name: 'second_func',
                                    arguments: '{"b":2}'
                                }
                            }
                        ]
                    }
                }]
            });

            (openai as any).parseStreamChunk(chunk);

            // Finish
            const finishChunk = JSON.stringify({
                choices: [{
                    delta: {},
                    finish_reason: 'tool_calls'
                }]
            });

            const result = (openai as any).parseStreamChunk(finishChunk);

            // Should only return the first tool call (index 0)
            expect(result.functionCall).toBeDefined();
            expect(result.functionCall?.name).toBe('first_func');
            expect((openai as any).accumulatedToolCalls.size).toBe(2);
        });

        it('should handle missing choices gracefully', () => {
            const chunk = JSON.stringify({
                choices: []
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
        });

        it('should handle finish_reason without tool calls', () => {
            const chunk = JSON.stringify({
                choices: [{
                    delta: {
                        content: 'Done'
                    },
                    finish_reason: 'stop'
                }]
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.content).toBe('Done');
            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(false);
        });

        it('should handle invalid JSON in tool call arguments', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Setup invalid arguments
            (openai as any).accumulatedToolCalls.set(0, {
                id: 'call_123',
                name: 'test_func',
                arguments: 'invalid json {'
            });

            const chunk = JSON.stringify({
                choices: [{
                    delta: {},
                    finish_reason: 'tool_calls'
                }]
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(result.functionCall).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle malformed chunk JSON', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = (openai as any).parseStreamChunk('not valid json {{{');

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
            expect(result.error).toContain('Failed to parse chunk');
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle null content in delta', () => {
            const chunk = JSON.stringify({
                choices: [{
                    delta: {
                        content: null
                    }
                }]
            });

            const result = (openai as any).parseStreamChunk(chunk);

            expect(result.content).toBe('');
        });
    });

    describe('Message Format Conversion', () => {
        it('should include system prompt in messages array', async () => {
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

            expect(requestBody.messages[0]).toEqual({
                role: Role.System,
                content: 'System instruction\n\nUser instruction'
            });
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
                        name: 'search_files',
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
            const assistantMessage = requestBody.messages.find((m: any) => m.role === Role.Assistant);

            expect(assistantMessage).toBeDefined();
            expect(assistantMessage.tool_calls).toHaveLength(1);
            expect(assistantMessage.tool_calls[0]).toEqual({
                id: 'call_123',
                type: 'function',
                function: {
                    name: 'search_files',
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
            const toolMessage = requestBody.messages.find((m: any) => m.role === 'tool');

            expect(toolMessage).toBeDefined();
            expect(toolMessage.tool_call_id).toBe('call_123');
            expect(toolMessage.content).toBe(JSON.stringify(['file1.txt', 'file2.txt']));
        });

        it('should handle invalid JSON in function call gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
            const message = requestBody.messages.find((m: any) => m.role === Role.Assistant);

            expect(message.content).toBe('Error parsing function call');
            expect(message.tool_calls).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle invalid JSON in function response gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
            const message = requestBody.messages.find((m: any) => m.role === Role.User);

            expect(message.content).toBe('invalid json {');
            expect(message.role).toBe(Role.User); // Falls back to original role
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
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

            // Should have system + 2 user messages (empty one filtered out)
            expect(requestBody.messages).toHaveLength(3);
        });
    });

    describe('mapFunctionDefinitions', () => {
        it('should map function definitions to OpenAI tool format', () => {
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

            const result = (openai as any).mapFunctionDefinitions(definitions);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                type: 'function',
                function: {
                    name: 'search_files',
                    description: 'Search for files',
                    parameters: definitions[0].parameters
                }
            });
            expect(result[1]).toEqual({
                type: 'function',
                function: {
                    name: 'read_file',
                    description: 'Read a file',
                    parameters: definitions[1].parameters
                }
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

            const abortSignal = new AbortController().signal;
            const generator = openai.streamRequest(conversation, true, abortSignal);

            for await (const chunk of generator) {
                // Just consume
            }

            expect(mockStreamingService.streamRequest).toHaveBeenCalledWith(
                expect.any(String), // URL
                expect.objectContaining({
                    model: 'gpt-4o',
                    messages: expect.any(Array),
                    tools: expect.any(Array),
                    stream: true
                }),
                expect.any(Function), // parseStreamChunk
                abortSignal,
                expect.objectContaining({
                    'Authorization': 'Bearer test-openai-key',
                    'Content-Type': 'application/json'
                })
            );
        });

        it('should clear accumulated tool calls at start of streamRequest', async () => {
            // Set some accumulated state
            (openai as any).accumulatedToolCalls.set(0, {
                id: 'old_id',
                name: 'old_func',
                arguments: 'old_args'
            });

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Test'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = openai.streamRequest(conversation, false);
            await generator.next();

            // State should be cleared
            expect((openai as any).accumulatedToolCalls.size).toBe(0);
        });
    });
});

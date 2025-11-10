import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Gemini } from '../../AIClasses/Gemini/Gemini';
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

describe('Gemini', () => {
    let gemini: Gemini;
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

        // Mock VaultkeeperAIPlugin
        mockPlugin = {};
        RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);

        // Mock SettingsService
        mockSettingsService = {
            settings: {
                model: 'gemini-2.5-flash-lite',
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
            getApiKeyForCurrentModel: vi.fn(() => 'test-gemini-key')
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

        gemini = new Gemini();
    });

    afterEach(() => {
        // Clear singleton registry to prevent memory leaks
        DeregisterAllServices();
    });

    describe('Constructor and Dependencies', () => {
        it('should initialize with dependencies from DependencyService', () => {
            expect(gemini).toBeDefined();
        });

        it('should load API key from SettingsService', () => {
            expect(mockSettingsService.getApiKeyForProvider(AIProvider.Gemini)).toBe('test-gemini-key');
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
        it('should parse text from nested content.parts structure', () => {
            const chunk = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            text: 'Hello from Gemini'
                        }]
                    }
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.content).toBe('Hello from Gemini');
            expect(result.isComplete).toBe(false);
        });

        it('should parse text from candidate.text field', () => {
            const chunk = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{ text: 'Direct text' }]
                    }
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.content).toBe('Direct text');
        });

        it('should accumulate function call from parts', () => {
            const chunk = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            functionCall: {
                                name: 'search_vault_files',
                                args: {
                                    query: 'test'
                                }
                            }
                        }]
                    }
                }]
            });

            (gemini as any).parseStreamChunk(chunk);

            expect((gemini as any).accumulatedFunctionName).toBe('search_vault_files');
            expect((gemini as any).accumulatedFunctionArgs).toEqual({ query: 'test' });
        });

        it('should merge function arguments incrementally (object spread)', () => {
            // First chunk with partial args
            (gemini as any).parseStreamChunk(JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            functionCall: {
                                name: 'search_vault_files',
                                args: {
                                    param1: 'value1'
                                }
                            }
                        }]
                    }
                }]
            }));

            // Second chunk with more args
            (gemini as any).parseStreamChunk(JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            functionCall: {
                                args: {
                                    param2: 'value2'
                                }
                            }
                        }]
                    }
                }]
            }));

            expect((gemini as any).accumulatedFunctionArgs).toEqual({
                param1: 'value1',
                param2: 'value2'
            });
        });

        it('should finalize function call on completion', () => {
            // Setup accumulated state
            (gemini as any).accumulatedFunctionName = 'search_vault_files';
            (gemini as any).accumulatedFunctionArgs = { query: 'test' };

            const chunk = JSON.stringify({
                candidates: [{
                    finishReason: 'FUNCTION_CALL'
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(true);
            expect(result.functionCall).toBeDefined();
            expect(result.functionCall?.name).toBe('search_vault_files');
            expect(result.functionCall?.arguments).toEqual({ query: 'test' });
        });

        it('should detect completion with STOP finish reason', () => {
            const chunk = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{ text: 'Done' }]
                    },
                    finishReason: 'STOP'
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.content).toBe('Done');
            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(false);
        });

        it('should handle missing candidates gracefully', () => {
            const chunk = JSON.stringify({
                candidates: []
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
        });

        it('should handle malformed chunk JSON', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = (gemini as any).parseStreamChunk('invalid json {');

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
            expect(result.error).toContain('Failed to parse chunk');
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('Web Search Toggle', () => {
        it('should use custom tools by default', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Test'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.tools[0]).toHaveProperty('functionDeclarations');
            expect(requestBody.tools[0].functionDeclarations).toBeInstanceOf(Array);
            expect(requestBody.tools[0].functionDeclarations.length).toBeGreaterThan(0);

            // Should include request_web_search function
            const hasWebSearchFunc = requestBody.tools[0].functionDeclarations.some(
                (f: any) => f.name === 'request_web_search'
            );
            expect(hasWebSearchFunc).toBe(true);
        });

        it('should toggle to google_search after request_web_search is called', async () => {
            // Set accumulated function name to trigger web search mode
            (gemini as any).accumulatedFunctionName = 'request_web_search';

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'What is the weather today?'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.tools[0]).toEqual({ google_search: {} });
            expect(requestBody.tools[0].functionDeclarations).toBeUndefined();
        });
    });

    describe('Message Format Conversion', () => {
        it('should convert roles to User/Model', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Hello', 'Hello'));
            conversation.contents.push(new ConversationContent(Role.Assistant, 'Hi there'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.contents[0].role).toBe(Role.User);
            expect(requestBody.contents[1].role).toBe(Role.Model);
        });

        it('should format system instruction as parts array', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Test', 'Test'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, true);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.system_instruction).toBeDefined();
            expect(requestBody.system_instruction.parts).toBeInstanceOf(Array);
            expect(requestBody.system_instruction.parts).toHaveLength(3);
            expect(requestBody.system_instruction.parts[0].text).toBe('System instruction');
            expect(requestBody.system_instruction.parts[2].text).toBe('User instruction');
        });

        it('should convert function call to Gemini format', () => {
            const functionCallContent = new ConversationContent(
                Role.Assistant,
                '',
                '',
                JSON.stringify({
                    functionCall: {
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                new Date(),
                true
            );

            const result = (gemini as any).extractContents([functionCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].role).toBe(Role.Model);
            expect(result[0].parts).toHaveLength(1);
            expect(result[0].parts[0]).toEqual({
                functionCall: {
                    name: 'search_vault_files',
                    args: { query: 'test' }
                }
            });
        });

        it('should convert function response to Gemini format', () => {
            const responseContent = JSON.stringify({
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent(
                Role.User,
                responseContent,
                responseContent  // promptContent for User role
            );
            functionResponseContent.isFunctionCallResponse = true;

            const result = (gemini as any).extractContents([functionResponseContent]);

            expect(result).toHaveLength(1);
            expect(result[0].parts).toHaveLength(1);
            // Gemini API requires both 'name' and 'response' fields
            expect(result[0].parts[0]).toEqual({
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
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

            const result = (gemini as any).extractContents([invalidContent]);

            // Should be filtered out since it has no valid parts (no text, invalid function call)
            expect(result).toHaveLength(0);
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

            const result = (gemini as any).extractContents([invalidContent]);

            // Should fallback to text
            expect(result).toHaveLength(1);
            expect(result[0].parts).toHaveLength(1);
            expect(result[0].parts[0]).toEqual({ text: 'invalid json {' });
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should filter out empty content', () => {
            const contents = [
                new ConversationContent(Role.User, 'Hello', 'Hello'),
                new ConversationContent(Role.Assistant, ''), // Empty
                new ConversationContent(Role.User, 'World', 'World')
            ];

            const result = (gemini as any).extractContents(contents);

            expect(result).toHaveLength(2);
            expect(result[0].parts[0].text).toBe('Hello');
            expect(result[1].parts[0].text).toBe('World');
        });
    });

    describe('mapFunctionDefinitions', () => {
        it('should map function definitions to Gemini format', () => {
            const definitions = [
                {
                    name: 'search_vault_files',
                    description: 'Search for files',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string' }
                        }
                    }
                }
            ];

            const result = (gemini as any).mapFunctionDefinitions(definitions);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                name: 'search_vault_files',
                description: 'Search for files',
                parameters: definitions[0].parameters
            });
        });

        it('should handle empty function definitions array', () => {
            const result = (gemini as any).mapFunctionDefinitions([]);

            expect(result).toEqual([]);
        });
    });

    describe('streamRequest', () => {
        it('should call streamingService with correct URL and parameters', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Test'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const abortSignal = new AbortController().signal;
            const generator = gemini.streamRequest(conversation, true, abortSignal);

            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const url = callArgs[0];

            expect(url).toContain('gemini-2.5-flash-lite');
            expect(url).toContain('streamGenerateContent');
            expect(url).toContain('key=test-gemini-key');
            expect(url).toContain('alt=sse');

            const requestBody = callArgs[1];
            expect(requestBody.system_instruction).toBeDefined();
            expect(requestBody.contents).toBeInstanceOf(Array);
            expect(requestBody.tools).toBeInstanceOf(Array);
        });

        it('should reset accumulation state at start of streamRequest', async () => {
            // Set some accumulated state
            (gemini as any).accumulatedFunctionName = 'old_func';
            (gemini as any).accumulatedFunctionArgs = { old: 'args' };

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent(Role.User, 'Test'));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, false);
            await generator.next();

            // State should be reset (after checking web search mode)
            expect((gemini as any).accumulatedFunctionName).toBeNull();
            expect((gemini as any).accumulatedFunctionArgs).toEqual({});
        });
    });
});

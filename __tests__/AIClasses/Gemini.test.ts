import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Gemini } from '../../AIClasses/Gemini/Gemini';
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
import { AbortService } from '../../Services/AbortService';
import { Exception } from '../../Helpers/Exception';

describe('Gemini', () => {
    let gemini: Gemini;
    let mockStreamingService: any;
    let mockPrompt: any;
    let mockPlugin: any;
    let mockSettingsService: any;
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

            expect(prompt).toBe(mockPrompt);
            expect(plugin).toBe(mockPlugin);
            expect(settingsService).toBe(mockSettingsService);
            expect(streaming).toBe(mockStreamingService);
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

        it('should capture thoughtSignature when present in part', () => {
            const signature = 'base64EncodedSignature==';
            const chunk = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            functionCall: {
                                name: 'search_vault_files',
                                args: { query: 'test' }
                            },
                            thoughtSignature: signature
                        }]
                    }
                }]
            });

            (gemini as any).parseStreamChunk(chunk);

            expect((gemini as any).accumulatedFunctionName).toBe('search_vault_files');
            expect((gemini as any).accumulatedFunctionArgs).toEqual({ query: 'test' });
            expect((gemini as any).accumulatedThoughtSignature).toBe(signature);
        });

        it('should not set thoughtSignature when not present in part', () => {
            const chunk = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            functionCall: {
                                name: 'search_vault_files',
                                args: { query: 'test' }
                            }
                        }]
                    }
                }]
            });

            (gemini as any).parseStreamChunk(chunk);

            expect((gemini as any).accumulatedThoughtSignature).toBeNull();
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

        it('should finalize function call with thoughtSignature on completion', () => {
            const signature = 'finalSignature==';
            // Setup accumulated state
            (gemini as any).accumulatedFunctionName = 'search_vault_files';
            (gemini as any).accumulatedFunctionArgs = { query: 'test' };
            (gemini as any).accumulatedThoughtSignature = signature;

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
            expect(result.functionCall?.thoughtSignature).toBe(signature);
        });

        it('should finalize function call without thoughtSignature when not accumulated', () => {
            // Setup accumulated state without signature
            (gemini as any).accumulatedFunctionName = 'search_vault_files';
            (gemini as any).accumulatedFunctionArgs = { query: 'test' };
            (gemini as any).accumulatedThoughtSignature = null;

            const chunk = JSON.stringify({
                candidates: [{
                    finishReason: 'FUNCTION_CALL'
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.functionCall).toBeDefined();
            expect(result.functionCall?.thoughtSignature).toBeUndefined();
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
            const result = (gemini as any).parseStreamChunk('invalid json {');

            expect(result.content).toBe('');
            expect(result.isComplete).toBe(true);
            expect(result.error).toContain('Failed to parse chunk');
        });
    });

    describe('Web Search Toggle', () => {
        it('should use custom tools by default', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, false);
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
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'What is the weather today?' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, false);
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
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' }));
            conversation.contents.push(new ConversationContent({ role: Role.Assistant, content: 'Hi there' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, false);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.contents[0].role).toBe(Role.User);
            expect(requestBody.contents[1].role).toBe(Role.Model);
        });

        it('should format system instruction as parts array', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test', displayContent: 'Test' }));

            // Set system prompts before calling streamRequest
            gemini.systemPrompt = 'System instruction';
            gemini.userInstruction = 'User instruction';
            gemini.toolDefinitions = [];

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, false);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.system_instruction).toBeDefined();
            expect(requestBody.system_instruction.parts).toBeInstanceOf(Array);
            expect(requestBody.system_instruction.parts).toHaveLength(3);
            expect(requestBody.system_instruction.parts[0].text).toBe('System instruction');
            expect(requestBody.system_instruction.parts[2].text).toBe('User instruction');
        });

        it('should convert function call to Gemini format (with signature from Gemini)', async () => {
            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false,
                thoughtSignature: 'geminiSignatureFromAPI=='  // Has signature from Gemini
            });

            const result = await (gemini as any).extractContents([functionCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].role).toBe(Role.Model);
            expect(result[0].parts).toHaveLength(1);
            expect(result[0].parts[0]).toEqual({
                functionCall: {
                    name: 'search_vault_files',
                    args: { query: 'test' }
                },
                thoughtSignature: 'geminiSignatureFromAPI=='
            });
        });

        it('should convert function call with thoughtSignature to Gemini format with signature', async () => {
            const signature = 'geminiSignature==';
            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false,
                thoughtSignature: signature
            });

            const result = await (gemini as any).extractContents([functionCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].role).toBe(Role.Model);
            expect(result[0].parts).toHaveLength(1);
            expect(result[0].parts[0]).toEqual({
                functionCall: {
                    name: 'search_vault_files',
                    args: { query: 'test' }
                },
                thoughtSignature: signature
            });
        });

        it('should fall back to legacy text format for function call without thoughtSignature (cross-provider)', async () => {
            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'toolu_01234567',  // toolId indicates this came from Claude/OpenAI
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false
                // No thoughtSignature (came from Claude/OpenAI)
            });

            const result = await (gemini as any).extractContents([functionCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].role).toBe(Role.Model);
            expect(result[0].parts).toHaveLength(1);
            expect(result[0].parts[0]).toHaveProperty('text');
            expect(result[0].parts[0].text).toContain('<!-- Historical tool call');
            expect(result[0].parts[0].text).toContain('"name": "search_vault_files"');
            expect(result[0].parts[0].text).toContain('"args": {');
            expect(result[0].parts[0].text).toContain('  "query": "test"');
        });

        it('should use native format for Gemini function call without thoughtSignature', async () => {
            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        // No id field - this is a native Gemini function call
                        name: 'read_file',
                        args: { path: 'note.md' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false
                // No thoughtSignature (normal Gemini call without extended thinking)
            });

            const result = await (gemini as any).extractContents([functionCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].parts[0]).toHaveProperty('functionCall');
            expect(result[0].parts[0].functionCall.name).toBe('read_file');
            expect(result[0].parts[0].functionCall.args).toEqual({ path: 'note.md' });
            expect(result[0].parts[0].thoughtSignature).toBeUndefined();
        });

        it('should convert function response to Gemini format', async () => {
            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call-123',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call-123'
            });

            const responseContent = JSON.stringify({
                id: 'call-123',
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent({
                role: Role.User,
                content: responseContent,
                displayContent: responseContent,  // displayContent for User role
                functionResponse: responseContent,
                toolId: 'call-123'
            });

            const result = await (gemini as any).extractContents([functionCallContent, functionResponseContent]);

            expect(result).toHaveLength(2);
            expect(result[1].parts).toHaveLength(1);
            // Gemini API requires both 'name' and 'response' fields
            expect(result[1].parts[0]).toEqual({
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.txt', 'file2.txt']
                }
            });
        });

        it('should fall back to legacy text format for function response without id (cross-provider)', async () => {
            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_legacy1',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call_legacy1'
            });

            const responseContent = JSON.stringify({
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
                toolId: 'call_legacy1'
            });

            const result = await (gemini as any).extractContents([functionCallContent, functionResponseContent]);

            expect(result).toHaveLength(2);
            expect(result[1].parts).toHaveLength(1);
            expect(result[1].parts[0]).toHaveProperty('text');
            expect(result[1].parts[0].text).toContain('<!-- Historical tool result');
            expect(result[1].parts[0].text).toContain('"name": "search_vault_files"');
            expect(result[1].parts[0].text).toContain('"response": [');
            expect(result[1].parts[0].text).toContain('  "file1.txt"');
            expect(result[1].parts[0].text).toContain('  "file2.txt"');
        });

        it('should fall back to legacy text format for function response with empty id', async () => {
            const functionCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: JSON.stringify({
                    functionCall: {
                        id: 'call_legacy2',
                        name: 'read_file',
                        args: { path: 'test.md' }
                    }
                }),
                toolId: 'call_legacy2'
            });

            const responseContent = JSON.stringify({
                id: '',
                functionResponse: {
                    name: 'read_file',
                    response: { content: 'file contents' }
                }
            });
            const functionResponseContent = new ConversationContent({
                role: Role.User,
                content: responseContent,
                displayContent: responseContent,
                functionResponse: responseContent,
                toolId: 'call_legacy2'
            });

            const result = await (gemini as any).extractContents([functionCallContent, functionResponseContent]);

            expect(result).toHaveLength(2);
            expect(result[1].parts[0]).toHaveProperty('text');
            expect(result[1].parts[0].text).toContain('<!-- Historical tool result');
            expect(result[1].parts[0].text).toContain('"name": "read_file"');
            expect(result[1].parts[0].text).toContain('"response": {');
            expect(result[1].parts[0].text).toContain('  "content": "file contents"');
        });

        it('should handle invalid JSON in function call gracefully', async () => {
            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

            const invalidContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                functionCall: 'invalid json {',
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (gemini as any).extractContents([invalidContent]);

            // Should fallback to error message as text (since content is empty and function call is invalid)
            // The implementation includes an error message as text when parsing fails
            expect(result).toHaveLength(1);
            expect(result[0].parts[0]).toHaveProperty('text');
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should handle invalid JSON in function response gracefully', async () => {
            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

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

            const invalidContent = new ConversationContent({
                role: Role.User,
                content: 'invalid json {',
                displayContent: 'invalid json {',  // displayContent for User role
                functionResponse: 'invalid json {',
                toolId: 'call_invalid'
            });

            const result = await (gemini as any).extractContents([functionCallContent, invalidContent]);

            // Should fallback to text
            expect(result).toHaveLength(2);
            expect(result[1].parts).toHaveLength(1);
            expect(result[1].parts[0]).toEqual({ text: 'invalid json {' });
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should filter out empty content', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' }),
                new ConversationContent({ role: Role.Assistant, content: '' }), // Empty
                new ConversationContent({ role: Role.User, content: 'World', displayContent: 'World' })
            ];

            const result = await (gemini as any).extractContents(contents);

            expect(result).toHaveLength(2);
            expect(result[0].parts[0].text).toBe('Hello');
            expect(result[1].parts[0].text).toBe('World');
        });

        it('should exclude orphaned function calls without responses', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search for files', displayContent: 'Search for files' }),
                // Function call without response (orphaned)
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    functionCall: JSON.stringify({
                        functionCall: {
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false
                }),
                new ConversationContent({ role: Role.User, content: 'What about this?', displayContent: 'What about this?' })
            ];

            const result = await (gemini as any).extractContents(contents);

            // Should only have 2 messages (orphaned function call excluded)
            expect(result).toHaveLength(2);
            expect(result[0].parts[0].text).toBe('Search for files');
            expect(result[1].parts[0].text).toBe('What about this?');
        });

        it('should include function call when it has a corresponding response', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search for files', displayContent: 'Search for files' }),
                // Function call with response (not orphaned) - with thoughtSignature
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    functionCall: JSON.stringify({
                        functionCall: {
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false,
                    thoughtSignature: 'signature123=='  // Has signature
                }),
                // Corresponding function response
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'resp-1',
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

            const result = await (gemini as any).extractContents(contents);

            // Should have all 3 items (function call has response)
            expect(result).toHaveLength(3);
            expect(result[1].parts[0]).toHaveProperty('functionCall');
            expect(result[2].parts[0]).toHaveProperty('functionResponse');
        });

        it('should include function call when it is the most recent item', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search for files', displayContent: 'Search for files' }),
                // Function call as most recent item (should be included) - with signature
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    functionCall: JSON.stringify({
                        functionCall: {
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false,
                    thoughtSignature: 'latestCallSignature=='
                })
            ];

            const result = await (gemini as any).extractContents(contents);

            // Should have both items (most recent function call is included)
            expect(result).toHaveLength(2);
            expect(result[1].parts[0]).toEqual({
                functionCall: {
                    name: 'search_vault_files',
                    args: { query: 'test' }
                },
                thoughtSignature: 'latestCallSignature=='
            });
        });

        it('should handle multiple orphaned function calls correctly', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'First message', displayContent: 'First message' }),
                // Orphaned function call #1
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    functionCall: JSON.stringify({
                        functionCall: {
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
                    functionCall: JSON.stringify({
                        functionCall: {
                            name: 'read_file',
                            args: { path: 'test.md' }
                        }
                    }),
                    timestamp: new Date(),
                    shouldDisplayContent: false
                }),
                new ConversationContent({ role: Role.User, content: 'Third message', displayContent: 'Third message' })
            ];

            const result = await (gemini as any).extractContents(contents);

            // Should only have the 3 user messages (both orphaned calls excluded)
            expect(result).toHaveLength(3);
            expect(result[0].parts[0].text).toBe('First message');
            expect(result[1].parts[0].text).toBe('Second message');
            expect(result[2].parts[0].text).toBe('Third message');
        });

    });

    describe('Helper Methods', () => {
        describe('convertFunctionCallToText', () => {
            it('should convert function call to legacy text format', async () => {
                const parsedContent = {
                    functionCall: {
                        name: 'search_vault_files',
                        args: { query: 'test notes' }
                    }
                };

                const result = (gemini as any).convertFunctionCallToText(parsedContent);

                expect(result).toContain('<!-- Historical tool call');
                expect(result).toContain('This action was ALREADY COMPLETED');
                expect(result).toContain('"name": "search_vault_files"');
                expect(result).toContain('"args": {');
                expect(result).toContain('  "query": "test notes"');
            });

            it('should format complex arguments correctly', () => {
                const parsedContent = {
                    functionCall: {
                        name: 'write_file',
                        args: {
                            path: 'note.md',
                            content: 'Hello World',
                            metadata: { tags: ['important'] }
                        }
                    }
                };

                const result = (gemini as any).convertFunctionCallToText(parsedContent);

                expect(result).toContain('<!-- Historical tool call');
                expect(result).toContain('"name": "write_file"');
                expect(result).toContain('"args": {');
                expect(result).toContain('  "path": "note.md"');
                expect(result).toContain('  "content": "Hello World"');
                expect(result).toContain('  "metadata": {');
                expect(result).toContain('    "tags": [');
                expect(result).toContain('      "important"');
            });

            it('should handle function call with empty args', () => {
                const parsedContent = {
                    functionCall: {
                        name: 'list_files',
                        args: {}
                    }
                };

                const result = (gemini as any).convertFunctionCallToText(parsedContent);

                const expected = `<!-- Historical tool call. This action was ALREADY COMPLETED.
     Use your native function calling for any NEW operations. -->
{
  "name": "list_files",
  "args": {}
}`;
                expect(result).toBe(expected);
            });
        });

        describe('convertFunctionResponseToText', () => {
            it('should convert function response to legacy text format', () => {
                const parsedContent = {
                    functionResponse: {
                        name: 'search_vault_files',
                        response: ['file1.txt', 'file2.txt', 'file3.txt']
                    }
                };

                const result = (gemini as any).convertFunctionResponseToText(parsedContent);

                expect(result).toContain('<!-- Historical tool result');
                expect(result).toContain('This action was ALREADY COMPLETED');
                expect(result).toContain('"name": "search_vault_files"');
                expect(result).toContain('"response": [');
                expect(result).toContain('  "file1.txt"');
                expect(result).toContain('  "file2.txt"');
                expect(result).toContain('  "file3.txt"');
            });

            it('should format complex response objects correctly', () => {
                const parsedContent = {
                    functionResponse: {
                        name: 'read_file',
                        response: {
                            content: 'File contents here',
                            metadata: { size: 1024, modified: '2024-01-01' }
                        }
                    }
                };

                const result = (gemini as any).convertFunctionResponseToText(parsedContent);

                expect(result).toContain('<!-- Historical tool result');
                expect(result).toContain('"name": "read_file"');
                expect(result).toContain('"response": {');
                expect(result).toContain('  "content": "File contents here"');
                expect(result).toContain('  "metadata": {');
                expect(result).toContain('    "size": 1024');
                expect(result).toContain('    "modified": "2024-01-01"');
            });

            it('should handle empty response', () => {
                const parsedContent = {
                    functionResponse: {
                        name: 'delete_file',
                        response: null
                    }
                };

                const result = (gemini as any).convertFunctionResponseToText(parsedContent);

                const expected = `<!-- Historical tool result. This action was ALREADY COMPLETED. -->
{
  "name": "delete_file",
  "response": null
}`;
                expect(result).toBe(expected);
            });

            it('should handle string response', () => {
                const parsedContent = {
                    functionResponse: {
                        name: 'get_status',
                        response: 'Success'
                    }
                };

                const result = (gemini as any).convertFunctionResponseToText(parsedContent);

                const expected = `<!-- Historical tool result. This action was ALREADY COMPLETED. -->
{
  "name": "get_status",
  "response": "Success"
}`;
                expect(result).toBe(expected);
            });
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
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, false);

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
            (gemini as any).accumulatedThoughtSignature = 'oldSignature';

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation, false);
            await generator.next();

            // State should be reset (after checking web search mode)
            expect((gemini as any).accumulatedFunctionName).toBeNull();
            expect((gemini as any).accumulatedFunctionArgs).toEqual({});
            expect((gemini as any).accumulatedThoughtSignature).toBeNull();
        });
    });

    describe('formatBinaryFiles', () => {
        it('should format PDF files with fileData', () => {
            const attachment = {
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                base64: 'base64encodedcontent',
                getFileID: () => 'file-123',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = gemini.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({
                text: 'Binary data for report.pdf follows in next message'
            });
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'application/pdf',
                    fileUri: 'file-123'
                }
            });
        });

        it('should format JPEG images with fileData', () => {
            const attachment = {
                fileName: 'photo.jpg',
                mimeType: 'image/jpeg',
                base64: 'base64imagedata',
                getFileID: () => 'file-456',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = gemini.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({
                text: 'Binary data for photo.jpg follows in next message'
            });
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'image/jpeg',
                    fileUri: 'file-456'
                }
            });
        });

        it('should format PNG images with fileData', () => {
            const attachment = {
                fileName: 'diagram.png',
                mimeType: 'image/png',
                base64: 'base64pngdata',
                getFileID: () => 'file-789',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = gemini.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'image/png',
                    fileUri: 'file-789'
                }
            });
        });

        it('should handle unsupported image formats (GIF) with error message', () => {
            const attachment = {
                fileName: 'animation.gif',
                mimeType: 'image/gif',
                base64: 'base64gifdata',
                getFileID: () => 'file-gif',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = gemini.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                text: 'Unsupported mime type \'image/gif\': animation.gif'
            });
        });

        it('should handle unsupported image formats (BMP) with error message', () => {
            const attachment = {
                fileName: 'photo.bmp',
                mimeType: 'image/bmp',
                base64: 'base64bmpdata',
                getFileID: () => 'file-bmp',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = gemini.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                text: 'Unsupported mime type \'image/bmp\': photo.bmp'
            });
        });

        it('should handle multiple files of different types', () => {
            const attachments = [
                {
                    fileName: 'doc.pdf',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getFileID: () => 'file-pdf',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'image.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getFileID: () => 'file-jpg',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'screenshot.png',
                    mimeType: 'image/png',
                    base64: 'pngdata',
                    getFileID: () => 'file-png',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = gemini.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(6);

            // PDF file
            expect(parsed[0]).toEqual({ text: 'Binary data for doc.pdf follows in next message' });
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'application/pdf',
                    fileUri: 'file-pdf'
                }
            });

            // JPEG image
            expect(parsed[2]).toEqual({ text: 'Binary data for image.jpg follows in next message' });
            expect(parsed[3]).toEqual({
                fileData: {
                    mimeType: 'image/jpeg',
                    fileUri: 'file-jpg'
                }
            });

            // PNG image
            expect(parsed[4]).toEqual({ text: 'Binary data for screenshot.png follows in next message' });
            expect(parsed[5]).toEqual({
                fileData: {
                    mimeType: 'image/png',
                    fileUri: 'file-png'
                }
            });
        });

        it('should handle mixed supported and unsupported files', () => {
            const attachments = [
                {
                    fileName: 'good.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getFileID: () => 'file-jpg',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'bad.bmp',
                    mimeType: 'image/bmp',
                    base64: 'bmpdata',
                    getFileID: () => 'file-bmp',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'doc.pdf',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getFileID: () => 'file-pdf',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = gemini.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(5);

            expect(parsed[0]).toEqual({ text: 'Binary data for good.jpg follows in next message' });
            expect(parsed[1]).toHaveProperty('fileData');
            expect(parsed[2]).toEqual({
                text: 'Unsupported mime type \'image/bmp\': bad.bmp'
            });
            expect(parsed[3]).toEqual({ text: 'Binary data for doc.pdf follows in next message' });
            expect(parsed[4]).toHaveProperty('fileData');
        });

        it('should skip files without file IDs (failed uploads)', () => {
            const attachments = [
                {
                    fileName: 'success.pdf',
                    mimeType: 'application/pdf',
                    base64: 'pdfdata',
                    getFileID: () => 'file-success',
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'failed.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getFileID: () => undefined, // Upload failed
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = gemini.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2); // Only successful upload
            expect(parsed[0]).toEqual({ text: 'Binary data for success.pdf follows in next message' });
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'application/pdf',
                    fileUri: 'file-success'
                }
            });
        });

        it('should handle empty attachments array', () => {
            const result = gemini.formatBinaryFiles([]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(0);
        });

        it('should properly encode filenames with special characters', () => {
            const attachment = {
                fileName: 'report (final) v2.pdf',
                mimeType: 'application/pdf',
                base64: 'pdfdata',
                getFileID: () => 'file-123',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = gemini.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed[0].text).toBe('Binary data for report (final) v2.pdf follows in next message');
        });

        it('should handle JPEG files with .jpeg extension', () => {
            const attachment = {
                fileName: 'photo.jpeg',
                mimeType: 'image/jpeg',
                base64: 'jpegdata',
                getFileID: () => 'file-jpeg',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = gemini.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'image/jpeg',
                    fileUri: 'file-jpeg'
                }
            });
        });
    });
});

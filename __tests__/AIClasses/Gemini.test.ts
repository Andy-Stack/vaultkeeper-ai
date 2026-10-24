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
import { Copy } from 'Enums/Copy';
import { replaceCopy } from 'Helpers/Helpers';

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
                    gemini: 'test-gemini-key', mistral: 'test-mistral-key'
                }
            },
            getApiKeyForProvider: vi.fn((provider: AIProvider) => {
                if (provider === AIProvider.Claude) return 'test-claude-key';
                if (provider === AIProvider.OpenAI) return 'test-openai-key';
                if (provider === AIProvider.Gemini) return 'test-gemini-key';
                return '';
            }),
            getApiKeyForCurrentProvider: vi.fn(() => 'test-gemini-key'),
            subscribeToSettingsChanged: vi.fn()
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
        it('should keep every part of every chunk unmerged for replay', () => {
            const chunks = [
                [{ text: 'Thinking about it', thought: true }],
                [{ text: 'Hello' }],
                [{ text: ' there' }, { text: '', thoughtSignature: 'sig-text' }],
                [{ functionCall: { name: 'search_vault_files', args: { query: 'notes' } }, thoughtSignature: 'sig-call' }]
            ];

            const blocks = chunks.flatMap((parts, index) => (gemini as any).parseStreamChunk(JSON.stringify({
                candidates: [{ content: { parts }, ...(index === chunks.length - 1 ? { finishReason: 'STOP' } : {}) }]
            })).providerBlocks ?? []);

            expect(blocks).toEqual(chunks.flat());
        });

        it('should not emit provider blocks for a chunk without parts', () => {
            const result = (gemini as any).parseStreamChunk(JSON.stringify({ candidates: [{ finishReason: 'STOP' }] }));

            expect(result.providerBlocks).toBeUndefined();
        });

        it('should route thought parts to thought and join every answer text part', () => {
            const result = (gemini as any).parseStreamChunk(JSON.stringify({
                candidates: [{
                    content: {
                        parts: [
                            { text: 'Considering the vault', thought: true },
                            { text: 'Hello' },
                            { text: ' there' }
                        ]
                    }
                }]
            }));

            expect(result.thought).toBe('Considering the vault');
            expect(result.content).toBe('Hello there');
            expect(result.completedThought).toBeUndefined();
        });

        it('should emit the accumulated thought as completedThought on finish', () => {
            (gemini as any).parseStreamChunk(JSON.stringify({
                candidates: [{ content: { parts: [{ text: 'Step one. ', thought: true }] } }]
            }));
            (gemini as any).parseStreamChunk(JSON.stringify({
                candidates: [{ content: { parts: [{ text: 'Step two.', thought: true }] } }]
            }));

            const result = (gemini as any).parseStreamChunk(JSON.stringify({
                candidates: [{ content: { parts: [{ text: 'Answer' }] }, finishReason: 'STOP' }]
            }));

            expect(result.content).toBe('Answer');
            expect(result.completedThought).toEqual({ provider: AIProvider.Gemini, text: 'Step one. Step two.' });
        });

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

            expect((gemini as any).accumulatedToolCalls).toEqual([
                { name: 'search_vault_files', args: { query: 'test' } }
            ]);
        });

        it('should accumulate parallel function calls from separate parts in order', () => {
            const chunk = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [
                            { functionCall: { name: 'search_vault_files', args: { query: 'a' } } },
                            { functionCall: { name: 'read_vault_files', args: { paths: ['b.md'] } } }
                        ]
                    }
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect((gemini as any).accumulatedToolCalls).toEqual([
                { name: 'search_vault_files', args: { query: 'a' } },
                { name: 'read_vault_files', args: { paths: ['b.md'] } }
            ]);
            expect(result.toolCallStarted).toBe('search_vault_files');
        });

        it('should emit toolCallStarted on the first chunk revealing the function name, and not again for subsequent chunks', () => {
            const startChunk = JSON.stringify({
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

            const startResult = (gemini as any).parseStreamChunk(startChunk);
            expect(startResult.toolCallStarted).toBe('search_vault_files');
            expect(startResult.isComplete).toBe(false);

            const continuationChunk = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            functionCall: {
                                args: { limit: 10 }
                            }
                        }]
                    }
                }]
            });

            const continuationResult = (gemini as any).parseStreamChunk(continuationChunk);
            expect(continuationResult.toolCallStarted).toBeUndefined();
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

            expect((gemini as any).accumulatedToolCalls).toEqual([
                { name: 'search_vault_files', args: { query: 'test' }, thoughtSignature: signature }
            ]);
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

            expect((gemini as any).accumulatedToolCalls[0].thoughtSignature).toBeUndefined();
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

            expect((gemini as any).accumulatedToolCalls).toEqual([
                { name: 'search_vault_files', args: { param1: 'value1', param2: 'value2' } }
            ]);
        });

        it('should finalize function call on completion', () => {
            // Setup accumulated state
            (gemini as any).accumulatedToolCalls = [{ name: 'search_vault_files', args: { query: 'test' } }];

            const chunk = JSON.stringify({
                candidates: [{
                    finishReason: 'FUNCTION_CALL'
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(true);
            expect(result.toolCalls).toBeDefined();
            expect(result.toolCalls?.[0].name).toBe('search_vault_files');
            expect(result.toolCalls?.[0].arguments).toEqual({ query: 'test' });
        });

        it('should finalize function call with thoughtSignature on completion', () => {
            const signature = 'finalSignature==';
            // Setup accumulated state
            (gemini as any).accumulatedToolCalls = [
                { name: 'search_vault_files', args: { query: 'test' }, thoughtSignature: signature }
            ];

            const chunk = JSON.stringify({
                candidates: [{
                    finishReason: 'FUNCTION_CALL'
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(true);
            expect(result.toolCalls).toBeDefined();
            expect(result.toolCalls?.[0].name).toBe('search_vault_files');
            expect(result.toolCalls?.[0].arguments).toEqual({ query: 'test' });
            expect(result.toolCalls?.[0].thoughtSignature).toBe(signature);
        });

        it('should finalize function call without thoughtSignature when not accumulated', () => {
            // Setup accumulated state without signature
            (gemini as any).accumulatedToolCalls = [{ name: 'search_vault_files', args: { query: 'test' } }];

            const chunk = JSON.stringify({
                candidates: [{
                    finishReason: 'FUNCTION_CALL'
                }]
            });

            const result = (gemini as any).parseStreamChunk(chunk);

            expect(result.toolCalls).toBeDefined();
            expect(result.toolCalls?.[0].thoughtSignature).toBeUndefined();
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
        it('should use custom tools by default (no request_web_search when disabled)', async () => {
            mockSettingsService.settings.enableWebSearch = false;

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.tools[0]).toHaveProperty('functionDeclarations');
            expect(requestBody.tools[0].functionDeclarations).toBeInstanceOf(Array);

            // Should NOT include request_web_search when web search is disabled
            const hasWebSearchFunc = requestBody.tools[0].functionDeclarations.some(
                (f: any) => f.name === 'request_web_search'
            );
            expect(hasWebSearchFunc).toBe(false);
        });

        it('should include request_web_search function when web search is enabled', async () => {
            mockSettingsService.settings.enableWebSearch = true;

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.tools[0]).toHaveProperty('functionDeclarations');
            expect(requestBody.tools[0].functionDeclarations).toBeInstanceOf(Array);
            expect(requestBody.tools[0].functionDeclarations.length).toBeGreaterThan(0);

            const hasWebSearchFunc = requestBody.tools[0].functionDeclarations.some(
                (f: any) => f.name === 'request_web_search'
            );
            expect(hasWebSearchFunc).toBe(true);
        });

        it('should toggle to google_search after request_web_search is called', async () => {
            // An accumulated request_web_search call triggers web search mode
            (gemini as any).accumulatedToolCalls = [{ name: 'request_web_search', args: {} }];

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'What is the weather today?' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation);
            for await (const chunk of generator) {}

            const callArgs = mockStreamingService.streamRequest.mock.calls[0];
            const requestBody = callArgs[1];

            expect(requestBody.tools[0]).toEqual({ google_search: {} });
            expect(requestBody.tools[0].functionDeclarations).toBeUndefined();
        });
    });

    describe('Message Format Conversion', () => {
        it('should replay a Gemini turn exactly as it was received', async () => {
            const parts = [
                { text: 'Thinking about it', thought: true },
                { text: 'Hello' },
                { text: '', thoughtSignature: 'sig-text' }
            ];
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Hi' }),
                new ConversationContent({ role: Role.Assistant, content: 'Hello', providerContent: JSON.stringify({ provider: AIProvider.Gemini, blocks: parts }) })
            ];

            const result = await (gemini as any).extractContents(contents);

            expect(result[1]).toEqual({ role: 'model', parts });
        });

        it('should convert roles to User/Model', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' }));
            conversation.contents.push(new ConversationContent({ role: Role.Assistant, content: 'Hi there' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation);
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
            gemini.aiToolDefinitions = [];

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation);
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
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCalls: JSON.stringify([{
                    toolCall: {
                        thoughtSignature: 'geminiSignatureFromAPI==',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }]),
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (gemini as any).extractContents([toolCallContent]);

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
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCalls: JSON.stringify([{
                    toolCall: {
                        thoughtSignature: signature,
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }]),
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (gemini as any).extractContents([toolCallContent]);

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
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCalls: JSON.stringify([{
                    toolCall: {
                        id: 'toolu_01234567',  // toolId indicates this came from Claude/OpenAI
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }]),
                timestamp: new Date(),
                shouldDisplayContent: false
                // No thoughtSignature (came from Claude/OpenAI)
            });

            const result = await (gemini as any).extractContents([toolCallContent]);

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
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCalls: JSON.stringify([{
                    toolCall: {
                        // No id field - this is a native Gemini function call
                        name: 'read_file',
                        args: { path: 'note.md' }
                    }
                }]),
                timestamp: new Date(),
                shouldDisplayContent: false
                // No thoughtSignature (normal Gemini call without extended thinking)
            });

            const result = await (gemini as any).extractContents([toolCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].parts[0]).toHaveProperty('functionCall');
            expect(result[0].parts[0].functionCall.name).toBe('read_file');
            expect(result[0].parts[0].functionCall.args).toEqual({ path: 'note.md' });
            expect(result[0].parts[0].thoughtSignature).toBeUndefined();
        });

        it('should convert function response to Gemini format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCalls: JSON.stringify([{
                    toolCall: {
                        id: 'call-123',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }]),
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

            const result = await (gemini as any).extractContents([toolCallContent, functionResponseContent]);

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
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCalls: JSON.stringify([{
                    toolCall: {
                        id: 'call_legacy1',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }]),
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

            const result = await (gemini as any).extractContents([toolCallContent, functionResponseContent]);

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
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCalls: JSON.stringify([{
                    toolCall: {
                        id: 'call_legacy2',
                        name: 'read_file',
                        args: { path: 'test.md' }
                    }
                }]),
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

            const result = await (gemini as any).extractContents([toolCallContent, functionResponseContent]);

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
                toolCalls: 'invalid json {',
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

            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCalls: JSON.stringify([{
                    toolCall: {
                        id: 'call_invalid',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }]),
                toolId: 'call_invalid'
            });

            const invalidContent = new ConversationContent({
                role: Role.User,
                content: 'invalid json {',
                displayContent: 'invalid json {',  // displayContent for User role
                functionResponse: 'invalid json {',
                toolId: 'call_invalid'
            });

            const result = await (gemini as any).extractContents([toolCallContent, invalidContent]);

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

            // Consecutive same-role messages are merged into one
            expect(result).toHaveLength(1);
            expect(result[0].parts[0].text).toBe('Hello');
            expect(result[0].parts[1].text).toBe('World');
        });

        it('should include function call when it has a corresponding response', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Search for files', displayContent: 'Search for files' }),
                // Function call with response (not orphaned) - with thoughtSignature
                new ConversationContent({
                    role: Role.Assistant,
                    content: '',
                    displayContent: '',
                    toolCalls: JSON.stringify([{
                        toolCall: {
                            thoughtSignature: 'signature123==',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }]),
                    timestamp: new Date(),
                    shouldDisplayContent: false
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
                    toolCalls: JSON.stringify([{
                        toolCall: {
                            thoughtSignature: 'latestCallSignature==',
                            name: 'search_vault_files',
                            args: { query: 'test' }
                        }
                    }]),
                    timestamp: new Date(),
                    shouldDisplayContent: false
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

    });

    describe('Helper Methods', () => {
        describe('convertToolCallToText', () => {
            it('should convert function call to legacy text format', async () => {
                const parsedContent = {
                    toolCall: {
                        name: 'search_vault_files',
                        args: { query: 'test notes' }
                    }
                };

                const result = (gemini as any).convertToolCallToText(parsedContent);

                expect(result).toContain('<!-- Historical tool call');
                expect(result).toContain('This action was ALREADY COMPLETED');
                expect(result).toContain('"name": "search_vault_files"');
                expect(result).toContain('"args": {');
                expect(result).toContain('  "query": "test notes"');
            });

            it('should format complex arguments correctly', () => {
                const parsedContent = {
                    toolCall: {
                        name: 'write_file',
                        args: {
                            path: 'note.md',
                            content: 'Hello World',
                            metadata: { tags: ['important'] }
                        }
                    }
                };

                const result = (gemini as any).convertToolCallToText(parsedContent);

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
                    toolCall: {
                        name: 'list_files',
                        args: {}
                    }
                };

                const result = (gemini as any).convertToolCallToText(parsedContent);

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

            const generator = gemini.streamRequest(conversation);

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
            (gemini as any).accumulatedToolCalls = [{ name: 'old_func', args: { old: 'args' }, thoughtSignature: 'oldSignature' }];

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = gemini.streamRequest(conversation);
            await generator.next();

            // State should be reset (after checking web search mode)
            expect((gemini as any).accumulatedToolCalls).toEqual([]);
        });
    });

    describe('formatBinaryFiles', () => {
        it('should format PDF files with fileData', async () => {
            const attachment = {
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                base64: 'base64encodedcontent',
                getMimeType: () => 'application/pdf',
                getFileID: () => 'file-123',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (gemini as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({
                text: replaceCopy(Copy.AttachedFile, ["report.pdf"])
            });
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'application/pdf',
                    fileUri: 'file-123'
                }
            });
        });

        it('should format JPEG images with fileData', async () => {
            const attachment = {
                fileName: 'photo.jpg',
                mimeType: 'image/jpeg',
                base64: 'base64imagedata',
                getMimeType: () => 'image/jpeg',
                getFileID: () => 'file-456',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (gemini as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({
                text: replaceCopy(Copy.AttachedFile, ["photo.jpg"])
            });
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'image/jpeg',
                    fileUri: 'file-456'
                }
            });
        });

        it('should format PNG images with fileData', async () => {
            const attachment = {
                fileName: 'diagram.png',
                mimeType: 'image/png',
                base64: 'base64pngdata',
                getMimeType: () => 'image/png',
                getFileID: () => 'file-789',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (gemini as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'image/png',
                    fileUri: 'file-789'
                }
            });
        });

        it('should handle unsupported image formats (GIF) with error message', async () => {
            const attachment = {
                fileName: 'animation.gif',
                mimeType: 'image/gif',
                base64: 'base64gifdata',
                getMimeType: () => 'image/gif',
                getFileID: () => 'file-gif',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (gemini as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                text: 'User attempted to share a file with an unsupported mime type \'image/gif\': animation.gif'
            });
        });

        it('should handle unsupported image formats (BMP) with error message', async () => {
            const attachment = {
                fileName: 'photo.bmp',
                mimeType: 'image/bmp',
                base64: 'base64bmpdata',
                getMimeType: () => 'image/bmp',
                getFileID: () => 'file-bmp',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (gemini as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                text: 'User attempted to share a file with an unsupported mime type \'image/bmp\': photo.bmp'
            });
        });

        it('should handle multiple files of different types', async () => {
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

            const result = await (gemini as any).formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(6);

            // PDF file
            expect(parsed[0]).toEqual({ text: replaceCopy(Copy.AttachedFile, ["doc.pdf"]) });
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'application/pdf',
                    fileUri: 'file-pdf'
                }
            });

            // JPEG image
            expect(parsed[2]).toEqual({ text: replaceCopy(Copy.AttachedFile, ["image.jpg"]) });
            expect(parsed[3]).toEqual({
                fileData: {
                    mimeType: 'image/jpeg',
                    fileUri: 'file-jpg'
                }
            });

            // PNG image
            expect(parsed[4]).toEqual({ text: replaceCopy(Copy.AttachedFile, ["screenshot.png"]) });
            expect(parsed[5]).toEqual({
                fileData: {
                    mimeType: 'image/png',
                    fileUri: 'file-png'
                }
            });
        });

        it('should handle mixed supported and unsupported files', async () => {
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

            const result = await (gemini as any).formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(5);

            expect(parsed[0]).toEqual({ text: replaceCopy(Copy.AttachedFile, ["good.jpg"]) });
            expect(parsed[1]).toHaveProperty('fileData');
            expect(parsed[2]).toEqual({
                text: 'User attempted to share a file with an unsupported mime type \'image/bmp\': bad.bmp'
            });
            expect(parsed[3]).toEqual({ text: replaceCopy(Copy.AttachedFile, ["doc.pdf"]) });
            expect(parsed[4]).toHaveProperty('fileData');
        });

        it('should skip files without file IDs (failed uploads)', async () => {
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

            const result = await (gemini as any).formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2); // Only successful upload
            expect(parsed[0]).toEqual({ text: replaceCopy(Copy.AttachedFile, ["success.pdf"]) });
            expect(parsed[1]).toEqual({
                fileData: {
                    mimeType: 'application/pdf',
                    fileUri: 'file-success'
                }
            });
        });

        it('should handle empty attachments array', async () => {
            const result = await (gemini as any).formatBinaryFiles([]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(0);
        });

        it('should properly encode filenames with special characters', async () => {
            const attachment = {
                fileName: 'report (final) v2.pdf',
                mimeType: 'application/pdf',
                base64: 'pdfdata',
                getMimeType: () => 'application/pdf',
                getFileID: () => 'file-123',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (gemini as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed[0].text).toBe(replaceCopy(Copy.AttachedFile, ["report (final) v2.pdf"]));
        });

        it('should handle JPEG files with .jpeg extension', async () => {
            const attachment = {
                fileName: 'photo.jpeg',
                mimeType: 'image/jpeg',
                base64: 'jpegdata',
                getMimeType: () => 'image/jpeg',
                getFileID: () => 'file-jpeg',
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (gemini as any).formatBinaryFiles([attachment as any]);
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

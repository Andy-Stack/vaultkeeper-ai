import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Mistral } from '../../AIClasses/Mistral/Mistral';
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

describe('Mistral', () => {
    let mistral: Mistral;
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
                model: 'mistral-large-latest',
                apiKeys: {
                    claude: 'test-claude-key',
                    openai: 'test-openai-key',
                    gemini: 'test-gemini-key',
                    mistral: 'test-mistral-key'
                }
            },
            getApiKeyForProvider: vi.fn((provider: AIProvider) => {
                if (provider === AIProvider.Claude) return 'test-claude-key';
                if (provider === AIProvider.OpenAI) return 'test-openai-key';
                if (provider === AIProvider.Gemini) return 'test-gemini-key';
                if (provider === AIProvider.Mistral) return 'test-mistral-key';
                return '';
            }),
            getApiKeyForCurrentModel: vi.fn(() => 'test-mistral-key')
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
            deleteFiles: vi.fn().mockResolvedValue(undefined),
            getSignedUrl: vi.fn((fileId: string) => `https://signed-url.com/${fileId}`)
        };
        RegisterSingleton(Services.IAIFileService, mockFileService);

        mistral = new Mistral();
    });

    afterEach(() => {
        // Clear singleton registry to prevent memory leaks
        DeregisterAllServices();
    });

    describe('Constructor and Dependencies', () => {
        it('should initialize with dependencies from DependencyService', () => {
            expect(mistral).toBeDefined();
        });

        it('should load API key from SettingsService', () => {
            expect(mockSettingsService.getApiKeyForProvider(AIProvider.Mistral)).toBe('test-mistral-key');
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
        it('should handle [DONE] chunk as completion', () => {
            const result = (mistral as any).parseStreamChunk('[DONE]');
            expect(result.content).toBe('');
            expect(result.isComplete).toBe(true);
        });

        it('should parse text content from delta', () => {
            const chunk = JSON.stringify({
                choices: [{
                    delta: {
                        content: 'Hello world'
                    },
                    finish_reason: null
                }]
            });

            const result = (mistral as any).parseStreamChunk(chunk);
            expect(result.content).toBe('Hello world');
            expect(result.isComplete).toBe(false);
        });

        it('should handle tool call start and accumulate arguments', () => {
            // Start tool call
            const chunk1 = JSON.stringify({
                choices: [{
                    delta: {
                        tool_calls: [{
                            index: 0,
                            id: 'call_123',
                            type: 'function',
                            function: {
                                name: 'search_vault_files',
                                arguments: '{"query":'
                            }
                        }]
                    },
                    finish_reason: null
                }]
            });

            const result1 = (mistral as any).parseStreamChunk(chunk1);
            expect(result1.toolCallStarted).toBe('search_vault_files');

            // Continue with more arguments
            const chunk2 = JSON.stringify({
                choices: [{
                    delta: {
                        tool_calls: [{
                            index: 0,
                            function: {
                                arguments: '"test"}'
                            }
                        }]
                    },
                    finish_reason: null
                }]
            });

            const result2 = (mistral as any).parseStreamChunk(chunk2);
            expect(result2.content).toBe('');
        });

        it('should finalize tool call on tool_calls finish_reason', () => {
            // Start and accumulate tool call
            const chunk1 = JSON.stringify({
                choices: [{
                    delta: {
                        tool_calls: [{
                            index: 0,
                            id: 'call_123',
                            type: 'function',
                            function: {
                                name: 'search_vault_files',
                                arguments: '{"query":"test"}'
                            }
                        }]
                    },
                    finish_reason: null
                }]
            });
            (mistral as any).parseStreamChunk(chunk1);

            // Complete with tool_calls finish reason
            const chunk2 = JSON.stringify({
                choices: [{
                    delta: {},
                    finish_reason: 'tool_calls'
                }]
            });

            const result = (mistral as any).parseStreamChunk(chunk2);
            expect(result.isComplete).toBe(true);
            expect(result.shouldContinue).toBe(true);
            expect(result.toolCall).toBeDefined();
            expect(result.toolCall?.name).toBe('search_vault_files');
            expect(result.toolCall?.arguments).toEqual({ query: 'test' });
            expect(result.toolCall?.toolId).toBe('call_123');
        });

        it('should handle invalid JSON in tool call arguments gracefully', () => {
            // Start tool call with invalid JSON
            const chunk1 = JSON.stringify({
                choices: [{
                    delta: {
                        tool_calls: [{
                            index: 0,
                            id: 'call_invalid',
                            type: 'function',
                            function: {
                                name: 'search_vault_files',
                                arguments: 'invalid json {'
                            }
                        }]
                    },
                    finish_reason: null
                }]
            });
            (mistral as any).parseStreamChunk(chunk1);

            const exceptionSpy = vi.spyOn(Exception, 'log').mockImplementation(() => {});

            // Complete with tool_calls finish reason
            const chunk2 = JSON.stringify({
                choices: [{
                    delta: {},
                    finish_reason: 'tool_calls'
                }]
            });

            const result = (mistral as any).parseStreamChunk(chunk2);
            expect(result.toolCall).toBeUndefined();
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should handle malformed chunk JSON', () => {
            const result = (mistral as any).parseStreamChunk('invalid json {{{');
            expect(result.content).toBe('');
            expect(result.isComplete).toBe(true);
            expect(result.error).toContain('Failed to parse chunk');
        });

        it('should handle empty choices array', () => {
            const chunk = JSON.stringify({
                choices: []
            });

            const result = (mistral as any).parseStreamChunk(chunk);
            expect(result.content).toBe('');
            expect(result.isComplete).toBe(false);
        });

        it('should reset accumulation state after tool call completion', () => {
            // Start and complete a tool call
            const chunk1 = JSON.stringify({
                choices: [{
                    delta: {
                        tool_calls: [{
                            index: 0,
                            id: 'call_1',
                            type: 'function',
                            function: {
                                name: 'search_vault_files',
                                arguments: '{"query":"test"}'
                            }
                        }]
                    },
                    finish_reason: 'tool_calls'
                }]
            });
            (mistral as any).parseStreamChunk(chunk1);

            // Accumulation state should be cleared
            expect((mistral as any).accumulatedToolCalls.size).toBe(0);
        });
    });

    describe('extractContents', () => {
        it('should convert simple text content to Mistral message format', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' }),
                new ConversationContent({ role: Role.Assistant, content: 'Hi there' })
            ];

            const result = await (mistral as any).extractContents(contents);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                role: Role.User,
                content: 'Hello'
            });
            expect(result[1]).toEqual({
                role: Role.Assistant,
                content: 'Hi there'
            });
        });

        it('should convert function call to tool_calls format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'abc123456',  // Valid Mistral ID: 9 alphanumeric chars
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (mistral as any).extractContents([toolCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].tool_calls).toHaveLength(1);
            expect(result[0].tool_calls?.[0]).toEqual({
                id: 'abc123456',
                type: 'function',
                function: {
                    name: 'search_vault_files',
                    arguments: JSON.stringify({ query: 'test' })
                }
            });
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

            const result = await (mistral as any).extractContents([toolCallContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toContain('Historical tool call');
            expect(result[0].content).toContain('search_vault_files');
        });



        it('should convert function response to tool format', async () => {
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'abc123456',  // Valid Mistral ID: 9 alphanumeric chars
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'abc123456'
            });

            const responseContent = JSON.stringify({
                id: 'abc123456',
                functionResponse: {
                    response: ['file1.txt', 'file2.txt']
                }
            });
            const functionResponseContent = new ConversationContent({
                role: Role.User,
                content: responseContent,
                displayContent: responseContent,
                functionResponse: responseContent,
                toolId: 'abc123456'
            });

            const result = await (mistral as any).extractContents([toolCallContent, functionResponseContent]);

            expect(result).toHaveLength(2);
            expect(result[1].role).toBe('tool');
            expect(result[1].tool_call_id).toBe('abc123456');
            expect(result[1].content).toBe(JSON.stringify(['file1.txt', 'file2.txt']));
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

            const result = await (mistral as any).extractContents([toolCallContent, functionResponseContent]);

            expect(result).toHaveLength(2);
            expect(result[1].content).toContain('Historical tool result');
            expect(result[1].content).toContain('search_vault_files');
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

            const result = await (mistral as any).extractContents([invalidContent]);

            // Should have fallback text
            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Error parsing function call');
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

            const result = await (mistral as any).extractContents([toolCallContent, invalidContent]);

            // Should fallback to text
            expect(result).toHaveLength(2);
            expect(result[1].content).toBe('invalid json {');
            expect(exceptionSpy).toHaveBeenCalled();

            exceptionSpy.mockRestore();
        });

        it('should filter out empty content', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' }),
                new ConversationContent({ role: Role.Assistant, content: '' }), // Empty
                new ConversationContent({ role: Role.User, content: 'World', displayContent: 'World' })
            ];

            const result = await (mistral as any).extractContents(contents);

            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('Hello');
            expect(result[1].content).toBe('World');
        });

        it('should handle mixed content with text and function call', async () => {
            const mixedContent = new ConversationContent({
                role: Role.Assistant,
                content: 'Let me search for that',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'def456789',  // Valid Mistral ID: 9 alphanumeric chars
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: false
            });

            const result = await (mistral as any).extractContents([mixedContent]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Let me search for that');
            expect(result[0].tool_calls).toHaveLength(1);
        });

        it('should handle attachments with images correctly', async () => {
            const attachment = {
                fileName: 'test-image.png',
                mimeType: 'image/png',
                base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                getMimeType: vi.fn(() => 'image/png'),
                getFileID: vi.fn(() => 'file_123'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const content = new ConversationContent({
                role: Role.User,
                content: 'Please analyze this image',
                displayContent: 'Please analyze this image',
                attachments: [attachment as any]
            });

            const result = await (mistral as any).extractContents([content]);

            expect(result).toHaveLength(1);
            const contentParts = result[0].content as any[];
            expect(contentParts.length).toBeGreaterThan(1);

            // Should have text and image_url parts
            const textPart = contentParts.find(p => p.type === 'text');
            expect(textPart).toBeDefined();
            expect(textPart.text).toBe('Please analyze this image');

            const imagePart = contentParts.find(p => p.type === 'image_url');
            expect(imagePart).toBeDefined();
            expect(imagePart.image_url).toBe('https://signed-url.com/file_123');
        });

        it('should handle attachments with PDFs correctly', async () => {
            const attachment = {
                fileName: 'document.pdf',
                mimeType: 'application/pdf',
                base64: 'JVBERi0xLjQKJeLjz9MK',
                getMimeType: vi.fn(() => 'application/pdf'),
                getFileID: vi.fn(() => 'file_456'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const content = new ConversationContent({
                role: Role.User,
                content: 'Review this document',
                displayContent: 'Review this document',
                attachments: [attachment as any]
            });

            const result = await (mistral as any).extractContents([content]);

            expect(result).toHaveLength(1);
            const contentParts = result[0].content as any[];
            expect(contentParts.length).toBeGreaterThan(1);

            // Should have text and document_url parts
            const textPart = contentParts.find(p => p.type === 'text');
            expect(textPart).toBeDefined();

            const docPart = contentParts.find(p => p.type === 'document_url');
            expect(docPart).toBeDefined();
            expect(docPart.document_url).toBe('https://signed-url.com/file_456');
        });

        it('should handle unsupported attachment mime types', async () => {
            const attachment = {
                fileName: 'photo.bmp',
                mimeType: 'image/bmp',
                base64: 'base64bmpdata',
                getMimeType: vi.fn(() => 'image/bmp'),
                getFileID: vi.fn(() => 'file_bmp'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const content = new ConversationContent({
                role: Role.User,
                content: 'Analyze this image',
                displayContent: 'Analyze this image',
                attachments: [attachment as any]
            });

            const result = await (mistral as any).extractContents([content]);

            expect(result).toHaveLength(1);
            const contentParts = result[0].content as any[];
            expect(contentParts.length).toBeGreaterThan(1);

            // Should have text part with error message
            const errorPart = contentParts.find(p => p.text?.includes('Unsupported mime type'));
            expect(errorPart).toBeDefined();
        });
    });

    describe('mapFunctionDefinitions', () => {
        it('should map function definitions to Mistral tool format', () => {
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

            const result = (mistral as any).mapFunctionDefinitions(definitions);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                type: 'function',
                function: {
                    name: 'search_vault_files',
                    description: 'Search for files',
                    parameters: {
                        type: 'object',
                        properties: { query: { type: 'string' } },
                        required: ['query']
                    }
                }
            });
            expect(result[1]).toEqual({
                type: 'function',
                function: {
                    name: 'read_file',
                    description: 'Read a file',
                    parameters: {
                        type: 'object',
                        properties: { path: { type: 'string' } },
                        required: undefined
                    }
                }
            });
        });

        it('should handle empty function definitions array', () => {
            const result = (mistral as any).mapFunctionDefinitions([]);
            expect(result).toEqual([]);
        });
    });

    describe('formatBinaryFiles', () => {
        it('should format PDF files with document_url type', () => {
            const attachment = {
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                base64: 'base64encodedcontent',
                getMimeType: vi.fn(() => 'application/pdf'),
                getFileID: vi.fn(() => 'file_pdf_123'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = mistral.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({
                type: 'text',
                text: 'Document: report.pdf'
            });
            expect(parsed[1]).toEqual({
                type: 'document_url',
                document_url: 'https://signed-url.com/file_pdf_123'
            });
        });

        it('should format JPEG images with image_url type', () => {
            const attachment = {
                fileName: 'photo.jpg',
                mimeType: 'image/jpeg',
                base64: 'base64imagedata',
                getMimeType: vi.fn(() => 'image/jpeg'),
                getFileID: vi.fn(() => 'file_img_jpeg'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = mistral.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({
                type: 'text',
                text: 'Image: photo.jpg'
            });
            expect(parsed[1]).toEqual({
                type: 'image_url',
                image_url: 'https://signed-url.com/file_img_jpeg'
            });
        });

        it('should format PNG images with image_url type', () => {
            const attachment = {
                fileName: 'diagram.png',
                mimeType: 'image/png',
                base64: 'base64pngdata',
                getMimeType: vi.fn(() => 'image/png'),
                getFileID: vi.fn(() => 'file_img_png'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = mistral.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[1]).toEqual({
                type: 'image_url',
                image_url: 'https://signed-url.com/file_img_png'
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

            const result = mistral.formatBinaryFiles([attachment as any]);
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
                }
            ];

            const result = mistral.formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(4);

            // PDF file
            expect(parsed[0]).toEqual({ type: 'text', text: 'Document: doc.pdf' });
            expect(parsed[1]).toEqual({
                type: 'document_url',
                document_url: 'https://signed-url.com/file_1'
            });

            // JPEG image
            expect(parsed[2]).toEqual({ type: 'text', text: 'Image: image.jpg' });
            expect(parsed[3]).toEqual({
                type: 'image_url',
                image_url: 'https://signed-url.com/file_2'
            });
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

            const result = mistral.formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            // Should return empty array when no file ID is available
            expect(parsed).toHaveLength(0);
        });

        it('should handle empty files array', () => {
            const attachments: any[] = [];

            const result = mistral.formatBinaryFiles(attachments);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(0);
        });
    });

    describe('streamRequest', () => {
        it('should call streamingService with correct parameters', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test message' }));

            // Set system prompts before calling streamRequest
            mistral.systemPrompt = 'System instruction';
            mistral.userInstruction = 'User instruction';
            mistral.aiToolDefinitions = [];

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'response', isComplete: true };
            });

            const generator = mistral.streamRequest(conversation);

            // Consume the generator
            for await (const chunk of generator) {
                // Just consume
            }

            expect(mockStreamingService.streamRequest).toHaveBeenCalledWith(
                expect.any(String), // URL
                expect.objectContaining({
                    model: 'mistral-large-latest',
                    max_tokens: 16384,
                    messages: expect.any(Array),
                    stream: true
                }),
                expect.any(Function), // parseStreamChunk
                expect.objectContaining({
                    'Authorization': 'Bearer test-mistral-key',
                    'Content-Type': 'application/json'
                }),
                expect.any(Function) // extractRetryDelay
            );
        });

        it('should reset accumulation state at start of streamRequest', async () => {
            // Set some accumulated state
            (mistral as any).accumulatedToolCalls.set(0, {
                id: 'old_id',
                name: 'old_func',
                args: 'old_args'
            });

            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = mistral.streamRequest(conversation);

            // Start consuming
            await generator.next();

            // State should be reset
            expect((mistral as any).accumulatedToolCalls.size).toBe(0);
        });

        it('should include tools in request when available', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test' }));

            mistral.systemPrompt = 'System';
            mistral.userInstruction = 'Instruction';
            mistral.aiToolDefinitions = [
                {
                    name: 'search_vault_files',
                    description: 'Search files',
                    parameters: {
                        type: 'object',
                        properties: { query: { type: 'string' } },
                        required: ['query']
                    }
                }
            ];

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'done', isComplete: true };
            });

            const generator = mistral.streamRequest(conversation);
            await generator.next();

            expect(mockStreamingService.streamRequest).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    tools: expect.any(Array),
                    tool_choice: expect.any(String)
                }),
                expect.any(Function),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });
});
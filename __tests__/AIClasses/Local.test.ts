import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Local } from '../../AIClasses/Local/Local';
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
import { AgentType } from '../../Enums/AgentType';
import { AbortService } from '../../Services/AbortService';
import { Copy } from 'Enums/Copy';
import { AITool } from 'Enums/AITool';
import { replaceCopy } from 'Helpers/Helpers';
import { arrayBufferToBase64 } from 'obsidian';

vi.mock('Helpers/DocumentHelper', () => ({
    pdfToImages: vi.fn()
}));

import { pdfToImages } from 'Helpers/DocumentHelper';

describe('Local', () => {
    let local: Local;
    let mockStreamingService: any;
    let mockPrompt: any;
    let mockPlugin: any;
    let mockSettingsService: any;
    let abortService: AbortService;

    beforeEach(() => {
        mockPrompt = {
            systemInstruction: vi.fn().mockReturnValue('System instruction'),
            userInstruction: vi.fn().mockResolvedValue('User instruction')
        };
        RegisterSingleton(Services.IPrompt, mockPrompt);

        mockPlugin = {};
        RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);

        mockSettingsService = {
            settings: {
                provider: AIProvider.Local,
                localUrl: 'http://localhost:1234/v1/chat/completions',
                localModels: {
                    model: 'local-main-model',
                    planningModel: 'local-planning-model',
                    quickActionModel: 'local-quick-model'
                },
                apiKeys: {
                    local: ''
                }
            },
            getApiKeyForProvider: vi.fn(() => ''),
            getApiKeyForCurrentProvider: vi.fn(() => ''),
            subscribeToSettingsChanged: vi.fn()
        };
        RegisterSingleton(Services.SettingsService, mockSettingsService);

        abortService = new AbortService();
        RegisterSingleton(Services.AbortService, abortService);

        mockStreamingService = {
            streamRequest: vi.fn()
        };
        RegisterSingleton(Services.StreamingService, mockStreamingService);

        const mockFileService = {
            refreshCache: vi.fn().mockResolvedValue(undefined),
            listFiles: vi.fn().mockReturnValue([]),
            uploadFile: vi.fn().mockResolvedValue(undefined),
            deleteFile: vi.fn().mockResolvedValue(undefined)
        };
        RegisterSingleton(Services.IAIFileService, mockFileService);

        local = new Local();

        vi.mocked(pdfToImages).mockReset();
    });

    afterEach(() => {
        DeregisterAllServices();
        vi.restoreAllMocks();
    });

    describe('Constructor and Dependencies', () => {
        it('should initialize with dependencies from DependencyService', () => {
            expect(local).toBeDefined();
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

    describe('apiUrl', () => {
        it('should return settings.localUrl verbatim', () => {
            expect((local as any).apiUrl).toBe('http://localhost:1234/v1/chat/completions');
        });

        it('should reflect updated localUrl values', () => {
            mockSettingsService.settings.localUrl = 'http://127.0.0.1:11434/v1/chat/completions';
            expect((local as any).apiUrl).toBe('http://127.0.0.1:11434/v1/chat/completions');
        });
    });

    describe('model', () => {
        it('should return localModels.model for Main agent type', () => {
            local.agentType = AgentType.Main;
            expect((local as any).model()).toBe('local-main-model');
        });

        it('should return localModels.model for Execution agent type', () => {
            local.agentType = AgentType.Execution;
            expect((local as any).model()).toBe('local-main-model');
        });

        it('should return localModels.planningModel for Orchestration agent type', () => {
            local.agentType = AgentType.Orchestration;
            expect((local as any).model()).toBe('local-planning-model');
        });

        it('should return localModels.planningModel for Planning agent type', () => {
            local.agentType = AgentType.Planning;
            expect((local as any).model()).toBe('local-planning-model');
        });

        it('should return localModels.quickActionModel for QuickAction agent type', () => {
            local.agentType = AgentType.QuickAction;
            expect((local as any).model()).toBe('local-quick-model');
        });
    });

    describe('formatBinaryFiles', () => {
        it('should inline plain text attachments as decoded text', async () => {
            const text = 'hello from a text file';
            const base64 = Buffer.from(text, 'utf-8').toString('base64');

            const attachment = {
                fileName: 'notes.txt',
                mimeType: 'text/plain',
                base64,
                getMimeType: vi.fn(() => 'text/plain'),
                getFileID: vi.fn(() => 'file_1'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (local as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                type: 'text',
                text: `${replaceCopy(Copy.AttachedFile, ['notes.txt'])}\n\n${text}`
            });
        });

        it('should inline JPEG images as base64 data URLs, not signed URLs', async () => {
            const attachment = {
                fileName: 'photo.jpg',
                mimeType: 'image/jpeg',
                base64: 'base64imagedata',
                getMimeType: vi.fn(() => 'image/jpeg'),
                getFileID: vi.fn(() => 'file_2'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (local as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({ type: 'text', text: replaceCopy(Copy.AttachedFile, ['photo.jpg']) });
            expect(parsed[1]).toEqual({
                type: 'image_url',
                image_url: { url: 'data:image/jpeg;base64,base64imagedata' }
            });
        });

        it('should inline PNG images as base64 data URLs', async () => {
            const attachment = {
                fileName: 'diagram.png',
                mimeType: 'image/png',
                base64: 'base64pngdata',
                getMimeType: vi.fn(() => 'image/png'),
                getFileID: vi.fn(() => 'file_3'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (local as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed[1]).toEqual({
                type: 'image_url',
                image_url: { url: 'data:image/png;base64,base64pngdata' }
            });
        });

        it('should report the corrected unsupported mime type message (regression: no duplicated phrase)', async () => {
            const attachment = {
                fileName: 'photo.bmp',
                mimeType: 'image/bmp',
                base64: 'base64bmpdata',
                getMimeType: vi.fn(() => 'image/bmp'),
                getFileID: vi.fn(() => 'file_4'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (local as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                type: 'text',
                text: "User attempted to share a file with an unsupported mime type 'image/bmp': photo.bmp"
            });
        });

        it('should rasterize PDF pages to image_url parts via pdfToImages', async () => {
            const pageBuffer1 = new TextEncoder().encode('page1').buffer;
            const pageBuffer2 = new TextEncoder().encode('page2').buffer;

            vi.mocked(pdfToImages).mockResolvedValue([
                { image: pageBuffer1, pageNumber: 1, mimeType: 'image/png' },
                { image: pageBuffer2, pageNumber: 2, mimeType: 'image/png' }
            ]);

            const attachment = {
                fileName: 'document.pdf',
                mimeType: 'application/pdf',
                base64: 'JVBERi0xLjQKJeLjz9MK',
                getMimeType: vi.fn(() => 'application/pdf'),
                getFileID: vi.fn(() => 'file_5'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (local as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(3);
            expect(parsed[0]).toEqual({ type: 'text', text: replaceCopy(Copy.AttachedFile, ['document.pdf']) });
            expect(parsed[1]).toEqual({
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${arrayBufferToBase64(pageBuffer1)}` }
            });
            expect(parsed[2]).toEqual({
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${arrayBufferToBase64(pageBuffer2)}` }
            });
        });

        it('should report a failure message when pdfToImages yields no pages', async () => {
            vi.mocked(pdfToImages).mockResolvedValue([]);

            const attachment = {
                fileName: 'corrupt.pdf',
                mimeType: 'application/pdf',
                base64: 'JVBERi0xLjQKJeLjz9MK',
                getMimeType: vi.fn(() => 'application/pdf'),
                getFileID: vi.fn(() => 'file_6'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            const result = await (local as any).formatBinaryFiles([attachment as any]);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                type: 'text',
                text: 'Failed to render any pages from corrupt.pdf'
            });
        });

        it('should handle multiple attachments of mixed types', async () => {
            vi.mocked(pdfToImages).mockResolvedValue([]);

            const attachments = [
                {
                    fileName: 'image.jpg',
                    mimeType: 'image/jpeg',
                    base64: 'jpegdata',
                    getMimeType: vi.fn(() => 'image/jpeg'),
                    getFileID: vi.fn(() => 'file_a'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                },
                {
                    fileName: 'photo.bmp',
                    mimeType: 'image/bmp',
                    base64: 'bmpdata',
                    getMimeType: vi.fn(() => 'image/bmp'),
                    getFileID: vi.fn(() => 'file_b'),
                    setFileID: vi.fn(),
                    deleteFileID: vi.fn()
                }
            ];

            const result = await (local as any).formatBinaryFiles(attachments as any);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(3);
            expect(parsed[0]).toEqual({ type: 'text', text: replaceCopy(Copy.AttachedFile, ['image.jpg']) });
            expect(parsed[1]).toEqual({
                type: 'image_url',
                image_url: { url: 'data:image/jpeg;base64,jpegdata' }
            });
            expect(parsed[2]).toEqual({
                type: 'text',
                text: "User attempted to share a file with an unsupported mime type 'image/bmp': photo.bmp"
            });
        });

        it('should handle an empty attachments array', async () => {
            const result = await (local as any).formatBinaryFiles([]);
            const parsed = JSON.parse(result);

            expect(parsed).toEqual([]);
        });

        it('should not depend on the file service for signed URLs or uploads', async () => {
            const fileService = Resolve<any>(Services.IAIFileService);

            const attachment = {
                fileName: 'photo.jpg',
                mimeType: 'image/jpeg',
                base64: 'jpegdata',
                getMimeType: vi.fn(() => 'image/jpeg'),
                getFileID: vi.fn(() => 'file_x'),
                setFileID: vi.fn(),
                deleteFileID: vi.fn()
            };

            await (local as any).formatBinaryFiles([attachment as any]);

            expect(fileService.uploadFile).not.toHaveBeenCalled();
        });
    });

    describe('getTools / isNativeToolCallId (inherited defaults, no web search)', () => {
        it('should return an empty tools array when there are no tool definitions', () => {
            local.aiToolDefinitions = [];
            expect((local as any).getTools()).toEqual([]);
        });

        it('should map plain tool definitions without injecting a web-search tool', () => {
            local.aiToolDefinitions = [
                {
                    name: AITool.SearchVaultFiles,
                    description: 'Search for files',
                    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
                }
            ];

            const tools = (local as any).getTools();

            expect(tools).toHaveLength(1);
            expect(tools[0].function.name).toBe(AITool.SearchVaultFiles);
        });

        it('should treat any non-empty id as native, unlike Mistral\'s stricter format check', () => {
            // Local has no provider-specific id format to validate against, so a tool-call id
            // shaped like another provider's (e.g. Claude's "toolu_" prefix) is still accepted.
            expect((local as any).isNativeToolCallId('toolu_01AbCdEfGhIjKlMnOpQrStUv')).toBe(true);
            expect((local as any).isNativeToolCallId('')).toBe(false);
        });
    });

    describe('streamRequest (inherited from ChatCompletionsAIClass)', () => {
        it('should call streamingService with the local URL and free-text model', async () => {
            const conversation = new Conversation();
            conversation.contents.push(new ConversationContent({ role: Role.User, content: 'Test message' }));

            local.systemPrompt = 'System instruction';
            local.userInstruction = 'User instruction';
            local.aiToolDefinitions = [];
            local.agentType = AgentType.Main;

            mockStreamingService.streamRequest.mockImplementation(async function* () {
                yield { content: 'response', isComplete: true };
            });

            const generator = local.streamRequest(conversation);
            for await (const _chunk of generator) {
                // consume
            }

            expect(mockStreamingService.streamRequest).toHaveBeenCalledWith(
                'http://localhost:1234/v1/chat/completions',
                expect.objectContaining({
                    model: 'local-main-model',
                    max_tokens: 16384,
                    messages: expect.any(Array),
                    stream: true
                }),
                expect.any(Function),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should parse a simple text delta chunk', () => {
            const chunk = JSON.stringify({
                choices: [{ delta: { content: 'Hello world' }, finish_reason: null }]
            });

            const result = (local as any).parseStreamChunk(chunk);
            expect(result.content).toBe('Hello world');
            expect(result.isComplete).toBe(false);
        });

        it('should extract simple text content via the shared extractContents', async () => {
            const contents = [
                new ConversationContent({ role: Role.User, content: 'Hello', displayContent: 'Hello' })
            ];

            const result = await (local as any).extractContents(contents);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ role: Role.User, content: 'Hello' });
        });
    });
});

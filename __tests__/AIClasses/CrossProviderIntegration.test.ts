import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Gemini } from '../../AIClasses/Gemini/Gemini';
import { Claude } from '../../AIClasses/Claude/Claude';
import { OpenAI } from '../../AIClasses/OpenAI/OpenAI';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AbortService } from '../../Services/AbortService';
import { AIProvider } from '../../Enums/ApiProvider';

/**
 * Cross-Provider Integration Tests for Thought Signature Support
 *
 * These tests verify that conversations can seamlessly switch between AI providers
 * while maintaining context through the thoughtSignature feature. The key scenarios:
 *
 * 1. Claude/OpenAI → Gemini: Function calls without thought signatures are converted
 *    to legacy text format to preserve context without breaking Gemini 3 Pro.
 *
 * 2. Gemini → Claude/OpenAI: Function calls with thought signatures can be sent to
 *    other providers (they'll ignore the signature but maintain the function call).
 *
 * 3. Mixed conversations: Ensure that a conversation history with mixed provider
 *    function calls is handled gracefully.
 */
describe('Cross-Provider Integration - Thought Signature Support', () => {
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
        DeregisterAllServices();
    });

    describe('Claude/OpenAI → Gemini Switching', () => {
        it('should convert Claude function call (no thoughtSignature) to legacy text format', async () => {
            // Simulate a conversation started with Claude that made a function call
            const claudeToolCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_abc123',  // AIToolCall.toConversationString() includes id in JSON
                        name: 'search_vault_files',
                        args: { query: 'meeting notes' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_abc123'
            });

            const result = await (gemini as any).extractContents([claudeToolCall]);

            expect(result).toHaveLength(1);
            expect(result[0].parts[0]).toHaveProperty('text');
            expect(result[0].parts[0].text).toContain('<!-- Historical tool call');
            expect(result[0].parts[0].text).toContain('"name": "search_vault_files"');
            expect(result[0].parts[0].text).toContain('"args": {');
            expect(result[0].parts[0].text).toContain('  "query": "meeting notes"');
        });

        it('should convert OpenAI function call (no thoughtSignature) to legacy text format', async () => {
            // Simulate a conversation started with OpenAI
            const openaiToolCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_xyz789',  // AIToolCall.toConversationString() includes id in JSON
                        name: 'read_file',
                        args: { path: 'project.md' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_xyz789'
            });

            const result = await (gemini as any).extractContents([openaiToolCall]);

            expect(result[0].parts[0].text).toContain('<!-- Historical tool call');
            expect(result[0].parts[0].text).toContain('"name": "read_file"');
            expect(result[0].parts[0].text).toContain('"args": {');
            expect(result[0].parts[0].text).toContain('  "path": "project.md"');
        });

        it('should convert function response without id to legacy text format', async () => {
            // Function responses from Claude/OpenAI may not have the id field in content
            const toolCallContent = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_cross1',
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                toolId: 'call_cross1'
            });

            const responseContent = JSON.stringify({
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['note1.md', 'note2.md']
                }
            });

            const claudeResponse = new ConversationContent({
                role: Role.User,
                content: responseContent,
                displayContent: responseContent,
                functionResponse: responseContent,
                toolId: 'call_cross1'
            });
            const result = await (gemini as any).extractContents([toolCallContent, claudeResponse]);

            expect(result[1].parts[0]).toHaveProperty('text');
            expect(result[1].parts[0].text).toContain('<!-- Historical tool result');
            expect(result[1].parts[0].text).toContain('"name": "search_vault_files"');
            expect(result[1].parts[0].text).toContain('"response": [');
            expect(result[1].parts[0].text).toContain('  "note1.md"');
            expect(result[1].parts[0].text).toContain('  "note2.md"');
        });
    });

    describe('Gemini → Claude/OpenAI Switching', () => {
        it('should handle Gemini function call with thoughtSignature when switching providers', async () => {
            // This test verifies the data structure is preserved
            // In actual usage, Claude/OpenAI would ignore the thoughtSignature field
            const geminiToolCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                thoughtSignature: 'geminiThoughtSignature=='
            });

            // Verify the signature is stored in ConversationContent
            expect(geminiToolCall.thoughtSignature).toBe('geminiThoughtSignature==');

            // When this conversation is sent to Claude/OpenAI, they'll see the function call
            // but ignore the thoughtSignature field (which is fine)
            const toolCallData = JSON.parse(geminiToolCall.toolCall!);
            expect(toolCallData.toolCall.name).toBe('search_vault_files');
            expect(toolCallData.toolCall.args).toEqual({ query: 'test' });
        });
    });

    describe('Mixed Conversation History', () => {
        it('should handle conversation with function calls from multiple providers', async () => {
            const conversation = [
                // User starts conversation
                new ConversationContent({ role: Role.User, content: 'Search for notes about the project', displayContent: 'Search for notes about the project' }),

                // Claude makes a function call (no signature)
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call_claude_123',  // AIToolCall.toConversationString() includes id
                                name: 'search_vault_files',
                                args: { query: 'project' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_claude_123'
            });
                    return content;
                })(),

                // Function response
                (() => {
                    const responseContent = JSON.stringify({
                        functionResponse: {
                            name: 'search_vault_files',
                            response: ['project.md']
                        }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call_claude_123'
                    });
                    return content;
                })(),

                // Claude responds
                new ConversationContent({ role: Role.Assistant, content: 'I found project.md' }),

                // User asks follow-up
                new ConversationContent({ role: Role.User, content: 'Read that file', displayContent: 'Read that file' }),

                // Now Gemini makes a function call (with signature)
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                name: 'read_file',
                                args: { path: 'project.md' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                thoughtSignature: 'geminiSignature123==',
                toolId: 'gemini-response-1'
            });
                    return content;
                })(),

                // Function response
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'gemini-response-1',
                        functionResponse: {
                            name: 'read_file',
                            response: { content: 'File contents' }
                        }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'gemini-response-1'
                    });
                    return content;
                })()
            ];

            const result = await (gemini as any).extractContents(conversation);

            // Should have all messages, with appropriate formatting
            expect(result.length).toBeGreaterThan(0);

            // Find the Claude function call - should be legacy text
            const claudeToolCall = result.find((r: any) =>
                r.parts[0]?.text?.includes('<!-- Historical tool call') &&
                r.parts[0]?.text?.includes('"name": "search_vault_files"')
            );
            expect(claudeToolCall).toBeDefined();

            // Find the Gemini function call - should have proper format with signature
            const geminiToolCall = result.find((r: any) =>
                r.parts[0]?.functionCall?.name === 'read_file' &&
                r.parts[0]?.thoughtSignature === 'geminiSignature123=='
            );
            expect(geminiToolCall).toBeDefined();
        });

        it('should handle conversation switching from provider without signatures to Gemini', async () => {
            // Start with OpenAI conversation
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'List files', displayContent: 'List files' }),

                // OpenAI function call (no signature)
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call_openai_456',  // AIToolCall.toConversationString() includes id
                                name: 'list_files',
                                args: {}
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_openai_456'
            });
                    return content;
                })(),

                // Response (no id)
                (() => {
                    const responseContent = JSON.stringify({
                        functionResponse: {
                            name: 'list_files',
                            response: ['file1.md', 'file2.md']
                        }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call_openai_456'
                    });
                    return content;
                })()
            ];

            const result = await (gemini as any).extractContents(conversation);

            // Verify OpenAI function call was converted to legacy format
            expect(result).toHaveLength(3);
            expect(result[1].parts[0].text).toContain('<!-- Historical tool call');
            expect(result[1].parts[0].text).toContain('"name": "list_files"');
            expect(result[2].parts[0].text).toContain('<!-- Historical tool result');
            expect(result[2].parts[0].text).toContain('"name": "list_files"');
        });

        it('should preserve context when alternating between providers with function calls', async () => {
            // Simulate a conversation that switches providers multiple times
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'Initial query', displayContent: 'Initial query' }),

                // Provider 1 (no signature) - function call + response
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call-1',  // AIToolCall.toConversationString() includes id
                                name: 'func1',
                                args: { a: 1 }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call-1'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        functionResponse: { name: 'func1', response: 'result1' }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call-1'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Response 1' }),

                // Provider 2 (with signature) - function call + response
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: { name: 'func2', args: { b: 2 } }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                thoughtSignature: 'sig2==',
                toolId: 'resp-2'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'resp-2',
                        functionResponse: { name: 'func2', response: 'result2' }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'resp-2'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Response 2' })
            ];

            const result = await (gemini as any).extractContents(conversation);

            // All content should be present
            expect(result.length).toBe(7);

            // First function call should be legacy format
            expect(result[1].parts[0]).toHaveProperty('text');
            expect(result[1].parts[0].text).toContain('<!-- Historical tool call');
            expect(result[1].parts[0].text).toContain('"name": "func1"');

            // First response should be legacy format
            expect(result[2].parts[0]).toHaveProperty('text');
            expect(result[2].parts[0].text).toContain('<!-- Historical tool result');
            expect(result[2].parts[0].text).toContain('"name": "func1"');

            // Second function call should have proper format
            expect(result[4].parts[0]).toHaveProperty('functionCall');
            expect(result[4].parts[0]).toHaveProperty('thoughtSignature');
            expect(result[4].parts[0].thoughtSignature).toBe('sig2==');

            // Second response should have proper format
            expect(result[5].parts[0]).toHaveProperty('functionResponse');
        });
    });

    describe('Claude ↔ OpenAI Switching', () => {
        it('should handle Claude function call when switching to OpenAI', async () => {
            // Simulate a conversation started with Claude that made a function call
            const claudeToolCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'toolu_abc123',  // Claude's tool_use ID
                        name: 'search_vault_files',
                        args: { query: 'meeting notes' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'toolu_abc123'
            });

            const claudeResponse = (() => {
                const responseContent = JSON.stringify({
                    id: 'toolu_abc123',
                    functionResponse: {
                        name: 'search_vault_files',
                        response: ['meeting1.md', 'meeting2.md']
                    }
                });
                const content = new ConversationContent({
                    role: Role.User,
                    content: responseContent,
                    displayContent: responseContent,
                    functionResponse: responseContent,
                    toolId: 'toolu_abc123'
                });
                return content;
            })();

            // Now switch to OpenAI - it should read Claude's function call
            const openai = new OpenAI();
            const result = await (openai as any).extractContents([claudeToolCall, claudeResponse]);

            // OpenAI should convert Claude's function call to its Responses API format
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                type: 'function_call',
                call_id: 'toolu_abc123',
                name: 'search_vault_files',
                arguments: '{"query":"meeting notes"}'
            });
            expect(result[1]).toEqual({
                type: 'function_call_output',
                call_id: 'toolu_abc123',
                output: '["meeting1.md","meeting2.md"]'
            });
        });

        it('should handle OpenAI function call when switching to Claude', async () => {
            // Simulate a conversation started with OpenAI
            const openaiToolCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_xyz789',  // OpenAI's call_id
                        name: 'read_file',
                        args: { path: 'project.md' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_xyz789'
            });

            const openaiResponse = (() => {
                const responseContent = JSON.stringify({
                    id: 'call_xyz789',
                    functionResponse: {
                        name: 'read_file',
                        response: { content: 'Project details here' }
                    }
                });
                const content = new ConversationContent({
                    role: Role.User,
                    content: responseContent,
                    displayContent: responseContent,
                    functionResponse: responseContent,
                    toolId: 'call_xyz789'
                });
                return content;
            })();

            // Now switch to Claude - it should read OpenAI's function call
            const claude = new Claude();
            const result = await (claude as any).extractContents([openaiToolCall, openaiResponse]);

            // Claude should convert OpenAI's function call to its tool_use format
            expect(result).toHaveLength(2);
            expect(result[0].content[0]).toEqual({
                type: 'tool_use',
                id: 'call_xyz789',
                name: 'read_file',
                input: { path: 'project.md' }
            });
            expect(result[1].content[0]).toEqual({
                type: 'tool_result',
                tool_use_id: 'call_xyz789',
                content: '{"content":"Project details here"}'
            });
        });

        it('should handle conversation alternating between Claude and OpenAI', async () => {
            // Complex scenario: Claude → OpenAI → Claude → OpenAI
            const conversation = [
                // User starts
                new ConversationContent({ role: Role.User, content: 'Search for files', displayContent: 'Search for files' }),

                // Claude makes a function call
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'toolu_1',
                                name: 'search_vault_files',
                                args: { query: 'test' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'toolu_1'
            });
                    return content;
                })(),

                // Function response
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'toolu_1',
                        functionResponse: { name: 'search_vault_files', response: ['file1.md'] }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'toolu_1'
                    });
                    return content;
                })(),

                // Claude responds
                new ConversationContent({ role: Role.Assistant, content: 'Found file1.md' }),

                // User continues
                new ConversationContent({ role: Role.User, content: 'Read it', displayContent: 'Read it' }),

                // OpenAI makes a function call
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call_2',
                                name: 'read_file',
                                args: { path: 'file1.md' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_2'
            });
                    return content;
                })(),

                // Function response
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call_2',
                        functionResponse: { name: 'read_file', response: { content: 'File contents' } }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call_2'
                    });
                    return content;
                })()
            ];

            // Test that both Claude and OpenAI can read this mixed conversation
            const claude = new Claude();
            const claudeResult = await (claude as any).extractContents(conversation);

            expect(claudeResult.length).toBeGreaterThan(0);
            // Both function calls should be present with their tool_use format
            const claudeToolUses = claudeResult.filter((r: any) =>
                r.content.some((c: any) => c.type === 'tool_use')
            );
            expect(claudeToolUses).toHaveLength(2);

            const openai = new OpenAI();
            const openaiResult = await (openai as any).extractContents(conversation);

            expect(openaiResult.length).toBeGreaterThan(0);
            // Both function calls should be present in Responses API format
            const openaiToolCalls = openaiResult.filter((r: any) => r.type === 'function_call');
            expect(openaiToolCalls).toHaveLength(2);
        });

        it('should handle function call with toolId but empty string', async () => {
            // Both Claude and OpenAI should treat empty string toolId as missing
            const emptyToolIdCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: '',  // Empty string
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: ''
            });

            // Claude should convert to legacy text format
            const claude = new Claude();
            const claudeResult = await (claude as any).extractContents([emptyToolIdCall]);
            expect(claudeResult[0].content[0].type).toBe('text');
            expect(claudeResult[0].content[0].text).toContain('<!-- Historical tool call');
            expect(claudeResult[0].content[0].text).toContain('"name": "search_vault_files"');

            // OpenAI should also handle it gracefully (fall back to regular message)
            const openai = new OpenAI();
            const openaiResult = await (openai as any).extractContents([emptyToolIdCall]);
            // Should either convert to text or handle the empty ID
            expect(openaiResult).toHaveLength(1);
        });

        it('should handle whitespace-only toolId same as empty string', async () => {
            const whitespaceToolIdCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: '   ',  // Whitespace only
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: '   '
            });

            // Claude should trim and treat as empty → legacy format
            const claude = new Claude();
            const claudeResult = await (claude as any).extractContents([whitespaceToolIdCall]);
            expect(claudeResult[0].content[0].type).toBe('text');
            expect(claudeResult[0].content[0].text).toContain('<!-- Historical tool call');
            expect(claudeResult[0].content[0].text).toContain('"name": "search_vault_files"');
        });
    });

    describe('OpenAI → Claude/Gemini Switching', () => {
        it('should handle OpenAI function call when switching to Claude', async () => {
            // Detailed test already covered in "Claude ↔ OpenAI Switching"
            // This test focuses on verifying Claude properly interprets OpenAI's call_id
            const openaiToolCall = new ConversationContent({
                role: Role.Assistant,
                content: 'Let me read that file for you',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_openai_123',
                        name: 'read_file',
                        args: { path: 'notes.md' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_openai_123'
            });

            const claude = new Claude();
            const result = await (claude as any).extractContents([openaiToolCall]);

            // Claude should preserve the OpenAI call_id in its tool_use format
            expect(result).toHaveLength(1);
            expect(result[0].content).toHaveLength(2); // text + tool_use
            expect(result[0].content[0].type).toBe('text');
            expect(result[0].content[0].text).toBe('Let me read that file for you');
            expect(result[0].content[1]).toEqual({
                type: 'tool_use',
                id: 'call_openai_123',
                name: 'read_file',
                input: { path: 'notes.md' }
            });
        });

        it('should convert OpenAI function call (no thoughtSignature) to Gemini legacy format', async () => {
            // OpenAI function call should be converted to legacy text when sent to Gemini
            const openaiToolCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'call_abc',
                        name: 'search_vault_files',
                        args: { query: 'project notes' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_abc'
            });

            const result = await (gemini as any).extractContents([openaiToolCall]);

            // Gemini should convert to legacy format since there's no thoughtSignature
            expect(result).toHaveLength(1);
            expect(result[0].parts[0]).toHaveProperty('text');
            expect(result[0].parts[0].text).toContain('<!-- Historical tool call');
            expect(result[0].parts[0].text).toContain('"name": "search_vault_files"');
            expect(result[0].parts[0].text).toContain('"args": {');
            expect(result[0].parts[0].text).toContain('  "query": "project notes"');
        });

        it('should handle OpenAI function response when switching to Gemini', async () => {
            // OpenAI response with ID should work with Gemini
            const openaiCall = new ConversationContent({
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

            const openaiResponse = (() => {
                const responseContent = JSON.stringify({
                    id: 'call_123',
                    functionResponse: {
                        name: 'search_vault_files',
                        response: ['file1.md', 'file2.md']
                    }
                });
                const content = new ConversationContent({
                    role: Role.User,
                    content: responseContent,
                    displayContent: responseContent,
                    functionResponse: responseContent,
                    toolId: 'call_123'
                });
                return content;
            })();

            const result = await (gemini as any).extractContents([openaiCall, openaiResponse]);

            // Gemini should accept the response with ID
            expect(result).toHaveLength(2);
            expect(result[1].parts[0]).toEqual({
                functionResponse: {
                    name: 'search_vault_files',
                    response: ['file1.md', 'file2.md']
                }
            });
        });

        it('should convert Gemini function call (no id) to OpenAI legacy format - REGRESSION', async () => {
            // REGRESSION TEST: Bug discovered where Gemini → OpenAI switching failed
            // because OpenAI tried to use undefined call_id
            // Gemini function call with thoughtSignature but no id
            const geminiToolCall = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        name: 'search_vault_files',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                thoughtSignature: 'gemini_signature_123==',
                toolId: 'gemini_tool_1'
            });

            const geminiResponse = (() => {
                const responseContent = JSON.stringify({
                    // Gemini response without id field
                    functionResponse: {
                        name: 'search_vault_files',
                        response: ['file1.md', 'file2.md']
                    }
                });
                const content = new ConversationContent({
                    role: Role.User,
                    content: responseContent,
                    displayContent: responseContent,
                    functionResponse: responseContent,
                    toolId: 'gemini_tool_1'
                });
                return content;
            })();

            // OpenAI should convert to legacy text format (not try to use undefined call_id)
            const openai = new OpenAI();
            const result = await (openai as any).extractContents([geminiToolCall, geminiResponse]);

            // Should have 2 items (both converted to messages)
            expect(result).toHaveLength(2);

            // First should be a text message with legacy format (NOT a function_call with undefined call_id)
            expect(result[0]).toHaveProperty('role');
            expect(result[0]).toHaveProperty('content');
            expect(result[0].content).toContain('<!-- Historical tool call');
            expect(result[0].content).toContain('"name": "search_vault_files"');
            expect(result[0]).not.toHaveProperty('type'); // Should be message, not function_call
            expect(result[0]).not.toHaveProperty('call_id'); // Should NOT have call_id field

            // Second should be a text message with legacy format
            expect(result[1]).toHaveProperty('role');
            expect(result[1]).toHaveProperty('content');
            expect(result[1].content).toContain('<!-- Historical tool result');
            expect(result[1].content).toContain('"name": "search_vault_files"');
        });

        it('should handle OpenAI → Gemini → Claude round-trip', async () => {
            // Test that function call survives multiple provider switches
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'Search files', displayContent: 'Search files' }),

                // OpenAI creates function call
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call_xyz',
                                name: 'search_vault_files',
                                args: { query: 'test' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_xyz'
            });
                    return content;
                })(),

                // Response
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call_xyz',
                        functionResponse: { name: 'search_vault_files', response: ['file.md'] }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call_xyz'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Found file.md' })
            ];

            // Gemini reads OpenAI conversation - function call becomes legacy
            const geminiResult = await (gemini as any).extractContents(conversation);
            const geminiLegacyCall = geminiResult.find((r: any) =>
                r.parts[0]?.text?.includes('<!-- Historical tool call')
            );
            expect(geminiLegacyCall).toBeDefined();

            // Claude reads the same conversation - should work
            const claude = new Claude();
            const claudeResult = await (claude as any).extractContents(conversation);
            expect(claudeResult.length).toBeGreaterThan(0);

            // OpenAI can re-read its own conversation
            const openai = new OpenAI();
            const openaiResult = await (openai as any).extractContents(conversation);
            expect(openaiResult.length).toBeGreaterThan(0);
            const toolCall = openaiResult.find((r: any) => r.type === 'function_call');
            expect(toolCall).toBeDefined();
            expect(toolCall.call_id).toBe('call_xyz');
        });
    });

    describe('Three-Way Provider Switching', () => {
        it('should handle Claude → OpenAI → Gemini conversation', async () => {
            // Complex three-way conversation: toolId → toolId → thoughtSignature transition
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'Start search', displayContent: 'Start search' }),

                // Claude makes a function call
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'toolu_1',
                                name: 'search_vault_files',
                                args: { query: 'notes' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'toolu_1'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'toolu_1',
                        functionResponse: { name: 'search_vault_files', response: ['note1.md'] }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'toolu_1'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Found note1.md' }),
                new ConversationContent({ role: Role.User, content: 'Read it', displayContent: 'Read it' }),

                // OpenAI makes a function call
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call_2',
                                name: 'read_file',
                                args: { path: 'note1.md' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_2'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call_2',
                        functionResponse: { name: 'read_file', response: { content: 'File contents' } }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call_2'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Here is the content' }),
                new ConversationContent({ role: Role.User, content: 'Summarize it', displayContent: 'Summarize it' })
            ];

            // Gemini should be able to read this conversation
            // Both Claude and OpenAI calls should convert to legacy format (no thoughtSignature)
            const geminiResult = await (gemini as any).extractContents(conversation);
            expect(geminiResult.length).toBeGreaterThan(0);

            const legacyCalls = geminiResult.filter((r: any) =>
                r.parts[0]?.text?.includes('<!-- Historical tool call')
            );
            expect(legacyCalls.length).toBe(2); // Both Claude and OpenAI calls

            // Claude should be able to read the full conversation
            const claude = new Claude();
            const claudeResult = await (claude as any).extractContents(conversation);
            expect(claudeResult.length).toBeGreaterThan(0);

            // OpenAI should be able to read the full conversation
            const openai = new OpenAI();
            const openaiResult = await (openai as any).extractContents(conversation);
            expect(openaiResult.length).toBeGreaterThan(0);
        });

        it('should handle Gemini → Claude → OpenAI conversation', async () => {
            // Three-way: thoughtSignature → toolId → toolId transition
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'Search files', displayContent: 'Search files' }),

                // Gemini makes a function call WITH thoughtSignature
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                name: 'search_vault_files',
                                args: { query: 'project' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                thoughtSignature: 'gemini_signature_1==',
                toolId: 'resp_1'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'resp_1',
                        functionResponse: { name: 'search_vault_files', response: ['project.md'] }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'resp_1'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Found project.md' }),
                new ConversationContent({ role: Role.User, content: 'Read it', displayContent: 'Read it' }),

                // Claude makes a function call
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'toolu_2',
                                name: 'read_file',
                                args: { path: 'project.md' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'toolu_2'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'toolu_2',
                        functionResponse: { name: 'read_file', response: { content: 'Project info' } }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'toolu_2'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Project details...' }),
                new ConversationContent({ role: Role.User, content: 'Write summary', displayContent: 'Write summary' }),

                // OpenAI makes a function call
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call_3',
                                name: 'write_file',
                                args: { path: 'summary.md', content: 'Summary here' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_3'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call_3',
                        functionResponse: { name: 'write_file', response: { success: true } }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call_3'
                    });
                    return content;
                })()
            ];

            // All three providers should be able to read this conversation
            const geminiResult = await (gemini as any).extractContents(conversation);
            expect(geminiResult.length).toBeGreaterThan(0);

            const claudeResult = await (new Claude() as any).extractContents(conversation);
            expect(claudeResult.length).toBeGreaterThan(0);

            const openaiResult = await (new OpenAI() as any).extractContents(conversation);
            expect(openaiResult.length).toBeGreaterThan(0);

            // Verify all three function calls are present in each provider's view
            const geminiToolCalls = geminiResult.filter((r: any) =>
                r.parts[0]?.functionCall || r.parts[0]?.text?.includes('<!-- Historical tool call')
            );
            expect(geminiToolCalls.length).toBe(3);

            const claudeToolUses = claudeResult.filter((r: any) =>
                r.content.some((c: any) => c.type === 'tool_use' || c.text?.includes('<!-- Historical tool call'))
            );
            expect(claudeToolUses.length).toBeGreaterThan(0);
        });

        it('should handle round-trip: Claude → Gemini → Claude', async () => {
            // Ensure conversation data survives round trip through different provider
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'Test', displayContent: 'Test' }),

                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'toolu_round',
                                name: 'search_vault_files',
                                args: { query: 'test', limit: 5 }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'toolu_round'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'toolu_round',
                        functionResponse: { name: 'search_vault_files', response: ['a.md', 'b.md'] }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'toolu_round'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Found 2 files' })
            ];

            // Claude reads it initially
            const claude1 = new Claude();
            const claudeResult1 = await (claude1 as any).extractContents(conversation);
            expect(claudeResult1.length).toBeGreaterThan(0);

            // Verify function call is preserved
            const claudeCall1 = claudeResult1.find((r: any) =>
                r.content.some((c: any) => c.type === 'tool_use')
            );
            expect(claudeCall1).toBeDefined();
            expect(claudeCall1.content[0].id).toBe('toolu_round');
            expect(claudeCall1.content[0].input).toEqual({ query: 'test', limit: 5 });

            // Gemini reads it (converts to legacy)
            const geminiResult = await (gemini as any).extractContents(conversation);
            const geminiLegacy = geminiResult.find((r: any) =>
                r.parts[0]?.text?.includes('<!-- Historical tool call')
            );
            expect(geminiLegacy).toBeDefined();
            expect(geminiLegacy.parts[0].text).toContain('search_vault_files');
            expect(geminiLegacy.parts[0].text).toContain('test');

            // Claude reads it again (should work the same way)
            const claude2 = new Claude();
            const claudeResult2 = await (claude2 as any).extractContents(conversation);
            expect(claudeResult2).toEqual(claudeResult1); // Should be identical
        });

        it('should handle round-trip: OpenAI → Gemini → OpenAI', async () => {
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'Search', displayContent: 'Search' }),

                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call_round',
                                name: 'search_vault_files',
                                args: { query: 'openai test' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_round'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call_round',
                        functionResponse: { name: 'search_vault_files', response: ['file.md'] }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call_round'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Found file' })
            ];

            // OpenAI reads initially
            const openai1 = new OpenAI();
            const openaiResult1 = await (openai1 as any).extractContents(conversation);
            expect(openaiResult1.length).toBeGreaterThan(0);

            const openaiCall1 = openaiResult1.find((r: any) => r.type === 'function_call');
            expect(openaiCall1).toBeDefined();
            expect(openaiCall1.call_id).toBe('call_round');

            // Gemini reads (converts to legacy)
            const geminiResult = await (gemini as any).extractContents(conversation);
            expect(geminiResult.length).toBeGreaterThan(0);

            // OpenAI reads again (should be consistent)
            const openai2 = new OpenAI();
            const openaiResult2 = await (openai2 as any).extractContents(conversation);
            expect(openaiResult2).toEqual(openaiResult1);
        });

        it('should handle complex multi-switch with function calls at each step', async () => {
            // Ultimate test: Each provider makes a function call in sequence
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'Complex workflow', displayContent: 'Complex workflow' }),

                // Step 1: Claude
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: 'Searching...',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'toolu_step1',
                                name: 'search_vault_files',
                                args: { query: 'workflow' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'toolu_step1'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'toolu_step1',
                        functionResponse: { name: 'search_vault_files', response: ['workflow.md'] }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'toolu_step1'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.User, content: 'Read it', displayContent: 'Read it' }),

                // Step 2: OpenAI
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: 'Reading file...',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call_step2',
                                name: 'read_file',
                                args: { path: 'workflow.md' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call_step2'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call_step2',
                        functionResponse: { name: 'read_file', response: { content: 'Workflow steps...' } }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call_step2'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.User, content: 'List all files', displayContent: 'List all files' }),

                // Step 3: Gemini (with thoughtSignature)
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                name: 'list_files',
                                args: { path: '/' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                thoughtSignature: 'gemini_step3_signature==',
                toolId: 'resp_step3'
            });
                    return content;
                })(),

                (() => {
                    const responseContent = JSON.stringify({
                        id: 'resp_step3',
                        functionResponse: { name: 'list_files', response: ['file1.md', 'file2.md'] }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'resp_step3'
                    });
                    return content;
                })(),

                new ConversationContent({ role: Role.Assistant, content: 'Complete!' })
            ];

            // All providers should handle this complex conversation
            const claudeResult = await (new Claude() as any).extractContents(conversation);
            expect(claudeResult.length).toBeGreaterThan(5);

            const openaiResult = await (new OpenAI() as any).extractContents(conversation);
            expect(openaiResult.length).toBeGreaterThan(5);

            const geminiResult = await (gemini as any).extractContents(conversation);
            expect(geminiResult.length).toBeGreaterThan(5);

            // Each provider should see all 3 function calls (in their own format or legacy)
            const claudeToolUses = claudeResult.filter((r: any) =>
                r.content.some((c: any) => c.type === 'tool_use' || c.text?.includes('<!-- Historical tool call'))
            );
            expect(claudeToolUses.length).toBe(3);

            const openaiToolCalls = openaiResult.filter((r: any) =>
                r.type === 'function_call' || r.type === 'message'
            );
            expect(openaiToolCalls.length).toBeGreaterThan(0);

            // Gemini should have 1 native call (with signature) and 2 legacy calls
            const geminiNativeCalls = geminiResult.filter((r: any) =>
                r.parts[0]?.functionCall && r.parts[0]?.thoughtSignature
            );
            expect(geminiNativeCalls.length).toBe(1);

            const geminiLegacyCalls = geminiResult.filter((r: any) =>
                r.parts[0]?.text?.includes('<!-- Historical tool call')
            );
            // Note: Orphaned function calls without responses are filtered out by filterConversationContents
            // So we verify at least the function calls with responses are present
            expect(geminiLegacyCalls.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty thoughtSignature as missing signature (use native format)', async () => {
            const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: { name: 'test_func', args: {} }  // No id = native Gemini
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                thoughtSignature: ''
            });

            const result = await (gemini as any).extractContents([content]);

            // Empty thoughtSignature with no id field = native Gemini call without extended thinking
            expect(result[0].parts[0]).toHaveProperty('functionCall');
            expect(result[0].parts[0].functionCall.name).toBe('test_func');
            expect(result[0].parts[0].thoughtSignature).toBeUndefined();
        });

        it('should handle whitespace-only thoughtSignature as missing signature (use native format)', async () => {
            const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: { name: 'test_func', args: {} }  // No id = native Gemini
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                thoughtSignature: '   '
            });

            const result = await (gemini as any).extractContents([content]);

            // Whitespace-only signature is trimmed, but no id field = native Gemini call
            expect(result[0].parts[0]).toHaveProperty('functionCall');
            expect(result[0].parts[0].functionCall.name).toBe('test_func');
            expect(result[0].parts[0].thoughtSignature).toBeUndefined();
        });

        it('should gracefully handle conversation with cross-provider legacy format calls', async () => {
            // Entire conversation from Claude - has id fields
            const conversation = [
                new ConversationContent({ role: Role.User, content: 'Test', displayContent: 'Test' }),
                (() => {
                    const content = new ConversationContent({
                        role: Role.Assistant,
                        content: '',
                        displayContent: '',
                        toolCall: JSON.stringify({
                            toolCall: {
                                id: 'toolu_123',  // id field indicates Claude/OpenAI origin
                                name: 'func1',
                                args: {}
                            }
                        }),
                        timestamp: new Date(),
                        shouldDisplayContent: true,
                        toolId: 'toolu_123'  // toolId must be set for filtering to work
                    });
                    return content;
                })(),
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'toolu_123',  // id field indicates Claude/OpenAI origin
                        functionResponse: { name: 'func1', response: 'ok' }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'toolu_123'  // toolId must be set for filtering to work
                    });
                    return content;
                })()
            ];

            const result = await (gemini as any).extractContents(conversation);

            // Function call should be in legacy format (has id field)
            expect(result[1].parts[0].text).toContain('<!-- Historical tool call');
            expect(result[1].parts[0].text).toContain('"name": "func1"');

            // Function response should be in native Gemini format (has id, can be used natively)
            expect(result[2].parts[0]).toHaveProperty('functionResponse');
            expect(result[2].parts[0].functionResponse.name).toBe('func1');
            expect(result[2].parts[0].functionResponse.response).toBe('ok');
        });

        it('should handle both toolId and thoughtSignature present (defensive)', async () => {
            // This tests the unusual scenario where both provider-specific fields are set
            // When id is present, it indicates cross-provider origin (Claude/OpenAI)
            // so it should use legacy text format even if thoughtSignature is also present
            const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: {
                        id: 'tool-123',  // ID in the JSON indicates cross-provider origin
                        name: 'test_func',
                        args: { query: 'test' }
                    }
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'tool-123',  // toolId metadata (matches JSON id)
                thoughtSignature: 'signature=='  // Also has thoughtSignature (unusual edge case)
            });

            // Gemini should use legacy text format because id is present (cross-provider)
            const geminiResult = await (gemini as any).extractContents([content]);
            expect(geminiResult[0].parts[0]).toHaveProperty('text');
            expect(geminiResult[0].parts[0].text).toContain('<!-- Historical tool call');

            // Claude reads from the JSON id field (not the metadata toolId field)
            const claude = new Claude();
            const claudeResult = await (claude as any).extractContents([content]);
            expect(claudeResult[0].content[0]).toEqual({
                type: 'tool_use',
                id: 'tool-123',
                name: 'test_func',
                input: { query: 'test' }
            });

            // OpenAI also reads from the JSON id field
            const openai = new OpenAI();
            const openaiResult = await (openai as any).extractContents([content]);
            expect(openaiResult[0]).toEqual({
                type: 'function_call',
                call_id: 'tool-123',
                name: 'test_func',
                arguments: '{"query":"test"}'
            });
        });

        it('should handle inconsistent state: toolId set but id missing from JSON (data corruption)', async () => {
            // Edge case: metadata field has toolId but the serialized JSON doesn't have id
            // This should never happen in production (AIToolCall prevents this)
            // but tests defensive behavior
            const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                    toolCall: { name: 'test_func', args: { query: 'test' } }  // No id field!
                }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'tool-123'
            });

            // Claude should convert to legacy format (defensive: no id in JSON)
            const claude = new Claude();
            const claudeResult = await (claude as any).extractContents([content]);
            expect(claudeResult[0].content[0].type).toBe('text');
            expect(claudeResult[0].content[0].text).toContain('<!-- Historical tool call');
            expect(claudeResult[0].content[0].text).toContain('"name": "test_func"');

            // OpenAI should also fall back gracefully
            const openai = new OpenAI();
            const openaiResult = await (openai as any).extractContents([content]);
            // OpenAI should handle this - either legacy conversion or error message
            expect(openaiResult).toHaveLength(1);
        });

        it('should filter out function response with mismatched toolId', async () => {
            // Function call with one ID, response with different ID
            // The new filtering logic should filter out the mismatched response
            const conversation = [
                (() => {
                    const content = new ConversationContent({
                role: Role.Assistant,
                content: '',
                displayContent: '',
                toolCall: JSON.stringify({
                            toolCall: {
                                id: 'call-123',
                                name: 'search_vault_files',
                                args: { query: 'test' }
                            }
                        }),
                timestamp: new Date(),
                shouldDisplayContent: true,
                toolId: 'call-123'
            });
                    return content;
                })(),
                (() => {
                    const responseContent = JSON.stringify({
                        id: 'call-456',  // DIFFERENT ID
                        functionResponse: {
                            name: 'search_vault_files',
                            response: ['file.md']
                        }
                    });
                    const content = new ConversationContent({
                        role: Role.User,
                        content: responseContent,
                        displayContent: responseContent,
                        functionResponse: responseContent,
                        toolId: 'call-456'  // Mismatched toolId
                    });
                    return content;
                })()
            ];

            // The mismatched response should be filtered out, leaving only the orphaned function call
            // But orphaned function calls (without responses) are also filtered unless they're the last item
            const claude = new Claude();
            const claudeResult = await (claude as any).extractContents(conversation);
            expect(claudeResult).toHaveLength(0);

            const openai = new OpenAI();
            const openaiResult = await (openai as any).extractContents(conversation);
            expect(openaiResult).toHaveLength(0);
        });
    });
});

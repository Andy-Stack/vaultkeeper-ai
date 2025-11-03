import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SettingsService, IAIAgentSettings } from '../../Services/SettingsService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIProvider, AIProviderModel } from '../../Enums/ApiProvider';
import type AIAgentPlugin from '../../main';

describe('SettingsService', () => {
    let settingsService: SettingsService;
    let mockPlugin: any;

    beforeEach(() => {
        // Mock AIAgentPlugin
        mockPlugin = {
            saveData: vi.fn().mockResolvedValue(undefined)
        };
        RegisterSingleton(Services.AIAgentPlugin, mockPlugin);
    });

    afterEach(() => {
        DeregisterAllServices();
        vi.clearAllMocks();
    });

    describe('Constructor and Initialization', () => {
        it('should initialize with default settings when no loaded settings provided', () => {
            settingsService = new SettingsService({});

            expect(settingsService.settings.firstTimeStart).toBe(true);
            expect(settingsService.settings.model).toBe(AIProviderModel.ClaudeSonnet_4_5);
            expect(settingsService.settings.apiKeys).toEqual({
                claude: '',
                openai: '',
                gemini: ''
            });
            expect(settingsService.settings.exclusions).toEqual([]);
            expect(settingsService.settings.userInstruction).toBe('');
        });

        it('should merge loaded settings with defaults', () => {
            const loadedSettings: Partial<IAIAgentSettings> = {
                firstTimeStart: false,
                model: AIProviderModel.GeminiFlash_2_5,
                apiKeys: {
                    claude: 'claude-key-123',
                    openai: 'openai-key-456',
                    gemini: 'gemini-key-789'
                }
            };

            settingsService = new SettingsService(loadedSettings as IAIAgentSettings);

            expect(settingsService.settings.firstTimeStart).toBe(false);
            expect(settingsService.settings.model).toBe(AIProviderModel.GeminiFlash_2_5);
            expect(settingsService.settings.apiKeys.claude).toBe('claude-key-123');
            expect(settingsService.settings.apiKeys.openai).toBe('openai-key-456');
            expect(settingsService.settings.apiKeys.gemini).toBe('gemini-key-789');
        });

        it('should handle partially loaded settings and fill missing properties with defaults', () => {
            const loadedSettings: Partial<IAIAgentSettings> = {
                model: AIProviderModel.GPT_4o,
                apiKeys: {
                    claude: '',
                    openai: 'partial-key',
                    gemini: ''
                }
            };

            settingsService = new SettingsService(loadedSettings as IAIAgentSettings);

            expect(settingsService.settings.firstTimeStart).toBe(true); // Default
            expect(settingsService.settings.model).toBe(AIProviderModel.GPT_4o); // Loaded
            expect(settingsService.settings.apiKeys.openai).toBe('partial-key'); // Loaded
            expect(settingsService.settings.exclusions).toEqual([]); // Default
            expect(settingsService.settings.userInstruction).toBe(''); // Default
        });
    });

    describe('getApiKeyForProvider', () => {
        beforeEach(() => {
            const loadedSettings: IAIAgentSettings = {
                firstTimeStart: false,
                model: AIProviderModel.ClaudeSonnet_4_5,
                apiKeys: {
                    claude: 'claude-api-key',
                    openai: 'openai-api-key',
                    gemini: 'gemini-api-key'
                },
                exclusions: [],
                userInstruction: ''
            };
            settingsService = new SettingsService(loadedSettings);
        });

        it('should return Claude API key for Claude provider', () => {
            const key = settingsService.getApiKeyForProvider(AIProvider.Claude);
            expect(key).toBe('claude-api-key');
        });

        it('should return OpenAI API key for OpenAI provider', () => {
            const key = settingsService.getApiKeyForProvider(AIProvider.OpenAI);
            expect(key).toBe('openai-api-key');
        });

        it('should return Gemini API key for Gemini provider', () => {
            const key = settingsService.getApiKeyForProvider(AIProvider.Gemini);
            expect(key).toBe('gemini-api-key');
        });

        it('should return empty string when no API key is set', () => {
            settingsService.settings.apiKeys.claude = '';
            const key = settingsService.getApiKeyForProvider(AIProvider.Claude);
            expect(key).toBe('');
        });
    });

    describe('getApiKeyForCurrentModel', () => {
        it('should return Claude key when current model is Claude', () => {
            const loadedSettings: IAIAgentSettings = {
                firstTimeStart: false,
                model: AIProviderModel.ClaudeSonnet_4_5,
                apiKeys: {
                    claude: 'claude-key',
                    openai: 'openai-key',
                    gemini: 'gemini-key'
                },
                exclusions: [],
                userInstruction: ''
            };
            settingsService = new SettingsService(loadedSettings);

            const key = settingsService.getApiKeyForCurrentModel();
            expect(key).toBe('claude-key');
        });

        it('should return OpenAI key when current model is GPT', () => {
            const loadedSettings: IAIAgentSettings = {
                firstTimeStart: false,
                model: AIProviderModel.GPT_4o,
                apiKeys: {
                    claude: 'claude-key',
                    openai: 'openai-key',
                    gemini: 'gemini-key'
                },
                exclusions: [],
                userInstruction: ''
            };
            settingsService = new SettingsService(loadedSettings);

            const key = settingsService.getApiKeyForCurrentModel();
            expect(key).toBe('openai-key');
        });

        it('should return Gemini key when current model is Gemini', () => {
            const loadedSettings: IAIAgentSettings = {
                firstTimeStart: false,
                model: AIProviderModel.GeminiFlash_2_5,
                apiKeys: {
                    claude: 'claude-key',
                    openai: 'openai-key',
                    gemini: 'gemini-key'
                },
                exclusions: [],
                userInstruction: ''
            };
            settingsService = new SettingsService(loadedSettings);

            const key = settingsService.getApiKeyForCurrentModel();
            expect(key).toBe('gemini-key');
        });

        it('should use AIProvider.fromModel to determine provider', () => {
            // Test with various Claude models
            settingsService = new SettingsService({
                model: AIProviderModel.ClaudeOpus_4,
                apiKeys: { claude: 'opus-key', openai: '', gemini: '' }
            });
            expect(settingsService.getApiKeyForCurrentModel()).toBe('opus-key');

            // Test with various Gemini models
            settingsService = new SettingsService({
                model: AIProviderModel.GeminiPro_2_5,
                apiKeys: { claude: '', openai: '', gemini: 'pro-key' }
            });
            expect(settingsService.getApiKeyForCurrentModel()).toBe('pro-key');

            // Test with various GPT models
            settingsService = new SettingsService({
                model: AIProviderModel.GPT_5,
                apiKeys: { claude: '', openai: 'gpt5-key', gemini: '' }
            });
            expect(settingsService.getApiKeyForCurrentModel()).toBe('gpt5-key');
        });
    });

    describe('setApiKeyForProvider', () => {
        beforeEach(() => {
            const loadedSettings: IAIAgentSettings = {
                firstTimeStart: false,
                model: AIProviderModel.ClaudeSonnet_4_5,
                apiKeys: {
                    claude: '',
                    openai: '',
                    gemini: ''
                },
                exclusions: [],
                userInstruction: ''
            };
            settingsService = new SettingsService(loadedSettings);
        });

        it('should update Claude API key', () => {
            settingsService.setApiKeyForProvider(AIProvider.Claude, 'new-claude-key');
            expect(settingsService.settings.apiKeys.claude).toBe('new-claude-key');
        });

        it('should update OpenAI API key', () => {
            settingsService.setApiKeyForProvider(AIProvider.OpenAI, 'new-openai-key');
            expect(settingsService.settings.apiKeys.openai).toBe('new-openai-key');
        });

        it('should update Gemini API key', () => {
            settingsService.setApiKeyForProvider(AIProvider.Gemini, 'new-gemini-key');
            expect(settingsService.settings.apiKeys.gemini).toBe('new-gemini-key');
        });

        it('should not affect other provider keys when updating one', () => {
            settingsService.settings.apiKeys = {
                claude: 'existing-claude',
                openai: 'existing-openai',
                gemini: 'existing-gemini'
            };

            settingsService.setApiKeyForProvider(AIProvider.Claude, 'updated-claude');

            expect(settingsService.settings.apiKeys.claude).toBe('updated-claude');
            expect(settingsService.settings.apiKeys.openai).toBe('existing-openai');
            expect(settingsService.settings.apiKeys.gemini).toBe('existing-gemini');
        });

        it('should allow setting empty string as API key', () => {
            settingsService.settings.apiKeys.claude = 'some-key';
            settingsService.setApiKeyForProvider(AIProvider.Claude, '');
            expect(settingsService.settings.apiKeys.claude).toBe('');
        });
    });

    describe('saveSettings', () => {
        beforeEach(() => {
            const loadedSettings: IAIAgentSettings = {
                firstTimeStart: false,
                model: AIProviderModel.ClaudeSonnet_4_5,
                apiKeys: {
                    claude: 'test-key',
                    openai: '',
                    gemini: ''
                },
                exclusions: ['node_modules'],
                userInstruction: 'Be helpful'
            };
            settingsService = new SettingsService(loadedSettings);
        });

        it('should call plugin.saveData with current settings', async () => {
            await settingsService.saveSettings();

            expect(mockPlugin.saveData).toHaveBeenCalledWith(settingsService.settings);
            expect(mockPlugin.saveData).toHaveBeenCalledTimes(1);
        });

        it('should call plugin.saveData with updated settings after modification', async () => {
            settingsService.setApiKeyForProvider(AIProvider.Claude, 'updated-key');
            settingsService.settings.userInstruction = 'Updated instruction';

            await settingsService.saveSettings();

            expect(mockPlugin.saveData).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiKeys: expect.objectContaining({
                        claude: 'updated-key'
                    }),
                    userInstruction: 'Updated instruction'
                })
            );
        });

        it('should handle saveData errors gracefully', async () => {
            mockPlugin.saveData.mockRejectedValue(new Error('Save failed'));

            await expect(settingsService.saveSettings()).rejects.toThrow('Save failed');
        });
    });

    describe('Provider Detection from Model Names', () => {
        it('should correctly identify Claude models', () => {
            const claudeModels = [
                AIProviderModel.ClaudeSonnet_4_5,
                AIProviderModel.ClaudeSonnet_4,
                AIProviderModel.ClaudeOpus_4,
                AIProviderModel.ClaudeHaiku_4_5
            ];

            claudeModels.forEach(model => {
                settingsService = new SettingsService({
                    model,
                    apiKeys: { claude: 'test-claude', openai: '', gemini: '' }
                });

                expect(settingsService.getApiKeyForCurrentModel()).toBe('test-claude');
            });
        });

        it('should correctly identify Gemini models', () => {
            const geminiModels = [
                AIProviderModel.GeminiFlash_2_5,
                AIProviderModel.GeminiFlash_2_5_Lite,
                AIProviderModel.GeminiPro_2_5
            ];

            geminiModels.forEach(model => {
                settingsService = new SettingsService({
                    model,
                    apiKeys: { claude: '', openai: '', gemini: 'test-gemini' }
                });

                expect(settingsService.getApiKeyForCurrentModel()).toBe('test-gemini');
            });
        });

        it('should correctly identify OpenAI models', () => {
            const openaiModels = [
                AIProviderModel.GPT_4o,
                AIProviderModel.GPT_4o_Mini,
                AIProviderModel.GPT_5,
                AIProviderModel.GPT_5_Mini
            ];

            openaiModels.forEach(model => {
                settingsService = new SettingsService({
                    model,
                    apiKeys: { claude: '', openai: 'test-openai', gemini: '' }
                });

                expect(settingsService.getApiKeyForCurrentModel()).toBe('test-openai');
            });
        });
    });

    describe('Settings Immutability and Reference', () => {
        it('should maintain reference to settings object', () => {
            settingsService = new SettingsService({
                model: AIProviderModel.ClaudeSonnet_4_5,
                apiKeys: { claude: 'key', openai: '', gemini: '' }
            });

            const settingsRef = settingsService.settings;
            settingsService.setApiKeyForProvider(AIProvider.Claude, 'new-key');

            // The reference should still point to the same object
            expect(settingsRef.apiKeys.claude).toBe('new-key');
        });

        it('should allow direct modification of settings properties', () => {
            settingsService = new SettingsService({
                model: AIProviderModel.ClaudeSonnet_4_5,
                apiKeys: { claude: '', openai: '', gemini: '' },
                exclusions: []
            });

            settingsService.settings.exclusions.push('test-exclusion');
            expect(settingsService.settings.exclusions).toContain('test-exclusion');

            settingsService.settings.userInstruction = 'Direct modification';
            expect(settingsService.settings.userInstruction).toBe('Direct modification');
        });
    });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SettingsService, type IVaultkeeperAISettings } from '../../Services/SettingsService';
import { makeTestSettings } from '../Helpers/makeTestSettings';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AIProvider, AIProviderModel } from '../../Enums/ApiProvider';

describe('SettingsService', () => {
    let settingsService: SettingsService;
    let mockPlugin: any;

    beforeEach(() => {
        // Mock VaultkeeperAIPlugin
        mockPlugin = {
            saveData: vi.fn().mockResolvedValue(undefined)
        };
        RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);
    });

    afterEach(() => {
        DeregisterAllServices();
        vi.clearAllMocks();
    });

    describe('Constructor and Initialization', () => {
        it('should initialize with default settings when no loaded settings provided', () => {
            settingsService = new SettingsService({});

            expect(settingsService.settings.firstTimeStart).toBe(true);
            expect(settingsService.settings.model).toBe(AIProviderModel.ClaudeSonnet_5);
            expect(settingsService.settings.apiKeys).toEqual({
                claude: '',
                openai: '',
                gemini: '', mistral: '', local: ''
            });
            expect(settingsService.settings.exclusions).toEqual([]);
            expect(settingsService.settings.userInstruction).toBe('');
            expect(settingsService.settings.searchResultsLimit).toBe(30);
            expect(settingsService.settings.snippetSizeLimit).toBe(100);
        });

        it('should merge loaded settings with defaults', () => {
            const loadedSettings: Partial<IVaultkeeperAISettings> = {
                firstTimeStart: false,
                provider: AIProvider.Gemini,
                model: AIProviderModel.GeminiFlash_3_5_Flash,
                planningModel: AIProviderModel.GeminiPro_3_1_Preview,
                apiKeys: {
                    claude: 'claude-key-123',
                    openai: 'openai-key-456',
                    gemini: 'gemini-key-789', mistral: '', local: ''
                },
                searchResultsLimit: 25,
                snippetSizeLimit: 200
            };

            settingsService = new SettingsService(loadedSettings as IVaultkeeperAISettings);

            expect(settingsService.settings.firstTimeStart).toBe(false);
            expect(settingsService.settings.model).toBe(AIProviderModel.GeminiFlash_3_5_Flash);
            expect(settingsService.settings.apiKeys.claude).toBe('claude-key-123');
            expect(settingsService.settings.apiKeys.openai).toBe('openai-key-456');
            expect(settingsService.settings.apiKeys.gemini).toBe('gemini-key-789');
            expect(settingsService.settings.searchResultsLimit).toBe(25);
            expect(settingsService.settings.snippetSizeLimit).toBe(200);
        });

        it('should handle partially loaded settings and fill missing properties with defaults', () => {
            const loadedSettings: Partial<IVaultkeeperAISettings> = {
                provider: AIProvider.OpenAI,
                model: AIProviderModel.GPT_5_6_Terra,
                apiKeys: {
                    claude: '',
                    openai: 'partial-key',
                    gemini: '', mistral: '', local: ''
                }
            };

            settingsService = new SettingsService(loadedSettings as IVaultkeeperAISettings);

            expect(settingsService.settings.firstTimeStart).toBe(true); // Default
            expect(settingsService.settings.model).toBe(AIProviderModel.GPT_5_6_Terra); // Loaded
            expect(settingsService.settings.apiKeys.openai).toBe('partial-key'); // Loaded
            expect(settingsService.settings.exclusions).toEqual([]); // Default
            expect(settingsService.settings.userInstruction).toBe(''); // Default
            expect(settingsService.settings.searchResultsLimit).toBe(30); // Default
            expect(settingsService.settings.snippetSizeLimit).toBe(100); // Default
        });

        it('should default localUrl and localModels when not provided', () => {
            settingsService = new SettingsService({});

            expect(settingsService.settings.localUrl).toBe('');
            expect(settingsService.settings.localModels).toEqual({
                model: '',
                planningModel: '',
                quickActionModel: ''
            });
        });

        it('should merge loaded localUrl and localModels with defaults', () => {
            const loadedSettings: Partial<IVaultkeeperAISettings> = {
                provider: AIProvider.Local,
                localUrl: 'http://localhost:11434',
                localModels: {
                    model: 'llama3',
                    planningModel: 'llama3',
                    quickActionModel: 'llama3-mini'
                },
                apiKeys: {
                    claude: '', openai: '', gemini: '', mistral: '', local: 'local-key'
                }
            };

            settingsService = new SettingsService(loadedSettings as IVaultkeeperAISettings);

            expect(settingsService.settings.localUrl).toBe('http://localhost:11434');
            expect(settingsService.settings.localModels).toEqual({
                model: 'llama3',
                planningModel: 'llama3',
                quickActionModel: 'llama3-mini'
            });
            expect(settingsService.settings.apiKeys.local).toBe('local-key');
        });

        it('should partially merge localModels, filling missing properties with defaults', () => {
            const loadedSettings: Partial<IVaultkeeperAISettings> = {
                localModels: {
                    model: 'llama3',
                    planningModel: '',
                    quickActionModel: ''
                } as IVaultkeeperAISettings['localModels']
            };

            settingsService = new SettingsService(loadedSettings as IVaultkeeperAISettings);

            expect(settingsService.settings.localModels.model).toBe('llama3');
        });

        it('should merge loaded Mistral API key with defaults', () => {
            const loadedSettings: Partial<IVaultkeeperAISettings> = {
                provider: AIProvider.Mistral,
                model: AIProviderModel.MistralMedium,
                apiKeys: {
                    claude: '', openai: '', gemini: '', mistral: 'mistral-key-123', local: ''
                }
            };

            settingsService = new SettingsService(loadedSettings as IVaultkeeperAISettings);

            expect(settingsService.settings.apiKeys.mistral).toBe('mistral-key-123');
            expect(settingsService.settings.model).toBe(AIProviderModel.MistralMedium);
        });

        it('should default cachedModelSettings for Mistral and Local providers', () => {
            settingsService = new SettingsService({});

            expect(settingsService.settings.cachedModelSettings[AIProvider.Mistral]).toEqual({
                model: AIProviderModel.MistralMedium,
                planningModel: AIProviderModel.MistralMedium,
                quickActionModel: AIProviderModel.MistralSmall
            });
            expect(settingsService.settings.cachedModelSettings[AIProvider.Local]).toEqual({
                model: AIProviderModel.None,
                planningModel: AIProviderModel.None,
                quickActionModel: AIProviderModel.None
            });
        });
    });

    describe('getApiKeyForProvider', () => {
        beforeEach(() => {
            const loadedSettings = makeTestSettings({
                provider: AIProvider.Claude,
                model: AIProviderModel.ClaudeSonnet_5,
                apiKeys: {
                    claude: 'claude-api-key',
                    openai: 'openai-api-key',
                    gemini: 'gemini-api-key', mistral: '', local: ''
                }
            });
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

        it('should return Mistral API key for Mistral provider', () => {
            settingsService.settings.apiKeys.mistral = 'mistral-api-key';
            const key = settingsService.getApiKeyForProvider(AIProvider.Mistral);
            expect(key).toBe('mistral-api-key');
        });

        it('should return Local API key for Local provider', () => {
            settingsService.settings.apiKeys.local = 'local-api-key';
            const key = settingsService.getApiKeyForProvider(AIProvider.Local);
            expect(key).toBe('local-api-key');
        });

        it('should return empty string when no API key is set', () => {
            settingsService.settings.apiKeys.claude = '';
            const key = settingsService.getApiKeyForProvider(AIProvider.Claude);
            expect(key).toBe('');
        });
    });

    describe('getApiKeyForCurrentProvider', () => {
        it('should return Claude key when current model is Claude', () => {
            const loadedSettings = makeTestSettings({
                provider: AIProvider.Claude,
                model: AIProviderModel.ClaudeSonnet_5,
                apiKeys: {
                    claude: 'claude-key',
                    openai: 'openai-key',
                    gemini: 'gemini-key', mistral: '', local: ''
                }
            });
            settingsService = new SettingsService(loadedSettings);

            const key = settingsService.getApiKeyForCurrentProvider();
            expect(key).toBe('claude-key');
        });

        it('should return OpenAI key when current model is GPT', () => {
            const loadedSettings = makeTestSettings({
                provider: AIProvider.OpenAI,
                model: AIProviderModel.GPT_5_6_Luna,
                apiKeys: {
                    claude: 'claude-key',
                    openai: 'openai-key',
                    gemini: 'gemini-key', mistral: '', local: ''
                }
            });
            settingsService = new SettingsService(loadedSettings);

            const key = settingsService.getApiKeyForCurrentProvider();
            expect(key).toBe('openai-key');
        });

        it('should return Gemini key when current model is Gemini', () => {
            const loadedSettings = makeTestSettings({
                provider: AIProvider.Gemini,
                model: AIProviderModel.GeminiFlash_3_5_Flash,
                apiKeys: {
                    claude: 'claude-key',
                    openai: 'openai-key',
                    gemini: 'gemini-key', mistral: '', local: ''
                }
            });
            settingsService = new SettingsService(loadedSettings);

            const key = settingsService.getApiKeyForCurrentProvider();
            expect(key).toBe('gemini-key');
        });

        it('should use fromModel to determine provider', () => {
            // Test with various Claude models
            settingsService = new SettingsService({
                provider: AIProvider.Claude,
                model: AIProviderModel.ClaudeOpus_4_8,
                apiKeys: { claude: 'opus-key', openai: '', gemini: '', mistral: '', local: '' }
            });
            expect(settingsService.getApiKeyForCurrentProvider()).toBe('opus-key');

            // Test with various Gemini models
            settingsService = new SettingsService({
                provider: AIProvider.Gemini,
                model: AIProviderModel.GeminiPro_3_1_Preview,
                apiKeys: { claude: '', openai: '', gemini: 'pro-key', mistral: '', local: '' }
            });
            expect(settingsService.getApiKeyForCurrentProvider()).toBe('pro-key');

            // Test with various GPT models
            settingsService = new SettingsService({
                provider: AIProvider.OpenAI,
                model: AIProviderModel.GPT_5_6_Terra,
                apiKeys: { claude: '', openai: 'gpt5-key', gemini: '', mistral: '', local: '' }
            });
            expect(settingsService.getApiKeyForCurrentProvider()).toBe('gpt5-key');

            // Test with various Mistral models
            settingsService = new SettingsService({
                provider: AIProvider.Mistral,
                model: AIProviderModel.MistralMedium,
                apiKeys: { claude: '', openai: '', gemini: '', mistral: 'mistral-key', local: '' }
            });
            expect(settingsService.getApiKeyForCurrentProvider()).toBe('mistral-key');
        });

        it('should return Mistral key when current model is Mistral', () => {
            const loadedSettings = makeTestSettings({
                provider: AIProvider.Mistral,
                model: AIProviderModel.MistralMedium,
                apiKeys: {
                    claude: 'claude-key',
                    openai: 'openai-key',
                    gemini: 'gemini-key', mistral: 'mistral-key', local: ''
                }
            });
            settingsService = new SettingsService(loadedSettings);

            const key = settingsService.getApiKeyForCurrentProvider();
            expect(key).toBe('mistral-key');
        });

        it('should return Local key when current provider is Local', () => {
            const loadedSettings = makeTestSettings({
                provider: AIProvider.Local,
                model: AIProviderModel.None,
                apiKeys: {
                    claude: 'claude-key',
                    openai: 'openai-key',
                    gemini: 'gemini-key', mistral: '', local: 'local-key'
                }
            });
            settingsService = new SettingsService(loadedSettings);

            const key = settingsService.getApiKeyForCurrentProvider();
            expect(key).toBe('local-key');
        });
    });

    describe('setApiKeyForProvider', () => {
        beforeEach(() => {
            const loadedSettings = makeTestSettings({
                provider: AIProvider.Claude,
                model: AIProviderModel.ClaudeSonnet_5
            });
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

        it('should update Mistral API key', () => {
            settingsService.setApiKeyForProvider(AIProvider.Mistral, 'new-mistral-key');
            expect(settingsService.settings.apiKeys.mistral).toBe('new-mistral-key');
        });

        it('should update Local API key', () => {
            settingsService.setApiKeyForProvider(AIProvider.Local, 'new-local-key');
            expect(settingsService.settings.apiKeys.local).toBe('new-local-key');
        });

        it('should not affect other provider keys when updating one', () => {
            settingsService = new SettingsService({
                apiKeys: {
                    claude: 'existing-claude',
                    openai: 'existing-openai',
                    gemini: 'existing-gemini',
                    mistral: 'existing-mistral', local: 'existing-local'
                }
            });

            settingsService.setApiKeyForProvider(AIProvider.Claude, 'updated-claude');

            expect(settingsService.settings.apiKeys.claude).toBe('updated-claude');
            expect(settingsService.settings.apiKeys.openai).toBe('existing-openai');
            expect(settingsService.settings.apiKeys.gemini).toBe('existing-gemini');
            expect(settingsService.settings.apiKeys.mistral).toBe('existing-mistral');
            expect(settingsService.settings.apiKeys.local).toBe('existing-local');
        });

        it('should allow setting empty string as API key', () => {
            settingsService.settings.apiKeys.claude = 'some-key';
            settingsService.setApiKeyForProvider(AIProvider.Claude, '');
            expect(settingsService.settings.apiKeys.claude).toBe('');
        });
    });

    describe('saveSettings', () => {
        beforeEach(() => {
            const loadedSettings = makeTestSettings({
                provider: AIProvider.Claude,
                model: AIProviderModel.ClaudeSonnet_5,
                apiKeys: {
                    claude: 'test-key',
                    openai: '',
                    gemini: '', mistral: '', local: ''
                },
                exclusions: ['node_modules'],
                userInstruction: 'Be helpful'
            });
            settingsService = new SettingsService(loadedSettings);
            mockPlugin.saveData.mockClear();
        });

        it('should call plugin.saveData with current settings', async () => {
            await settingsService.updateSettings(() => {});

            expect(mockPlugin.saveData).toHaveBeenCalledWith(settingsService.settings);
        });

        it('should call plugin.saveData with updated settings after modification', async () => {
            await settingsService.updateSettings(settings => {
                settings.apiKeys.claude = 'updated-key';
                settings.userInstruction = 'Updated instruction';
            });

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

            await expect(settingsService.updateSettings(() => {})).rejects.toThrow('Save failed');
        });
    });

    describe('Provider Detection from Model Names', () => {
        it('should correctly identify Claude models', () => {
            const claudeModels = [
                AIProviderModel.ClaudeSonnet_5,
                AIProviderModel.ClaudeSonnet_5,
                AIProviderModel.ClaudeOpus_4_8,
                AIProviderModel.ClaudeHaiku_4_5
            ];

            claudeModels.forEach(model => {
                settingsService = new SettingsService({
                    provider: AIProvider.Claude,
                    model,
                    apiKeys: { claude: 'test-claude', openai: '', gemini: '', mistral: '', local: '' }
                });

                expect(settingsService.getApiKeyForCurrentProvider()).toBe('test-claude');
            });
        });

        it('should correctly identify Gemini models', () => {
            const geminiModels = [
                AIProviderModel.GeminiFlash_3_1_Lite,
                AIProviderModel.GeminiFlash_3_5_Flash,
                AIProviderModel.GeminiPro_3_1_Preview
            ];

            geminiModels.forEach(model => {
                settingsService = new SettingsService({
                    provider: AIProvider.Gemini,
                    model,
                    apiKeys: { claude: '', openai: '', gemini: 'test-gemini', mistral: '', local: '' }
                });

                expect(settingsService.getApiKeyForCurrentProvider()).toBe('test-gemini');
            });
        });

        it('should correctly identify OpenAI models', () => {
            const openaiModels = [
                AIProviderModel.GPT_5_6_Sol,
                AIProviderModel.GPT_5_6_Terra,
                AIProviderModel.GPT_5_6_Luna
            ];

            openaiModels.forEach(model => {
                settingsService = new SettingsService({
                    provider: AIProvider.OpenAI,
                    model,
                    apiKeys: { claude: '', openai: 'test-openai', gemini: '', mistral: '', local: '' }
                });

                expect(settingsService.getApiKeyForCurrentProvider()).toBe('test-openai');
            });
        });

        it('should correctly identify Mistral models', () => {
            const mistralModels = [
                AIProviderModel.MistralMedium,
                AIProviderModel.MistralSmall
            ];

            mistralModels.forEach(model => {
                settingsService = new SettingsService({
                    provider: AIProvider.Mistral,
                    model,
                    apiKeys: { claude: '', openai: '', gemini: '', mistral: 'test-mistral', local: '' }
                });

                expect(settingsService.getApiKeyForCurrentProvider()).toBe('test-mistral');
            });
        });

        it('should correctly identify Local provider regardless of model', () => {
            settingsService = new SettingsService({
                provider: AIProvider.Local,
                model: AIProviderModel.None,
                apiKeys: { claude: '', openai: '', gemini: '', mistral: '', local: 'test-local' }
            });

            expect(settingsService.getApiKeyForCurrentProvider()).toBe('test-local');
        });
    });

    describe('Settings Immutability and Reference', () => {
        it('should maintain reference to settings object', () => {
            settingsService = new SettingsService({
                model: AIProviderModel.ClaudeSonnet_5,
                apiKeys: { claude: 'key', openai: '', gemini: '', mistral: '', local: '' }
            });

            const settingsRef = settingsService.settings;
            settingsService.setApiKeyForProvider(AIProvider.Claude, 'new-key');

            // The reference should still point to the same object
            expect(settingsRef.apiKeys.claude).toBe('new-key');
        });

        it('should allow modification of settings properties via updateSettings', async () => {
            settingsService = new SettingsService({
                model: AIProviderModel.ClaudeSonnet_5,
                apiKeys: { claude: '', openai: '', gemini: '', mistral: '', local: '' },
                exclusions: []
            });

            await settingsService.updateSettings(s => { s.exclusions.push('test-exclusion'); });
            expect(settingsService.settings.exclusions).toContain('test-exclusion');

            await settingsService.updateSettings(s => { s.userInstruction = 'Direct modification'; });
            expect(settingsService.settings.userInstruction).toBe('Direct modification');
        });
    });

    describe('Search and Snippet Limit Settings', () => {
        it('should use default searchResultsLimit when not specified', () => {
            settingsService = new SettingsService({});
            expect(settingsService.settings.searchResultsLimit).toBe(30);
        });

        it('should use default snippetSizeLimit when not specified', () => {
            settingsService = new SettingsService({});
            expect(settingsService.settings.snippetSizeLimit).toBe(100);
        });

        it('should allow custom searchResultsLimit values', () => {
            settingsService = new SettingsService({
                searchResultsLimit: 30
            });
            expect(settingsService.settings.searchResultsLimit).toBe(30);
        });

        it('should allow custom snippetSizeLimit values', () => {
            settingsService = new SettingsService({
                snippetSizeLimit: 300
            });
            expect(settingsService.settings.snippetSizeLimit).toBe(300);
        });

        it('should allow zero values for searchResultsLimit', () => {
            settingsService = new SettingsService({
                searchResultsLimit: 0
            });
            expect(settingsService.settings.searchResultsLimit).toBe(0);
        });

        it('should allow zero values for snippetSizeLimit', () => {
            settingsService = new SettingsService({
                snippetSizeLimit: 0
            });
            expect(settingsService.settings.snippetSizeLimit).toBe(0);
        });

        it('should allow modification of searchResultsLimit via updateSettings', async () => {
            settingsService = new SettingsService({});
            await settingsService.updateSettings(s => { s.searchResultsLimit = 50; });
            expect(settingsService.settings.searchResultsLimit).toBe(50);
        });

        it('should allow modification of snippetSizeLimit via updateSettings', async () => {
            settingsService = new SettingsService({});
            await settingsService.updateSettings(s => { s.snippetSizeLimit = 500; });
            expect(settingsService.settings.snippetSizeLimit).toBe(500);
        });

        it('should persist searchResultsLimit and snippetSizeLimit when saving settings', async () => {
            settingsService = new SettingsService({
                searchResultsLimit: 20,
                snippetSizeLimit: 250
            });

            await settingsService.updateSettings(() => {});

            expect(mockPlugin.saveData).toHaveBeenCalledWith(
                expect.objectContaining({
                    searchResultsLimit: 20,
                    snippetSizeLimit: 250
                })
            );
        });

        it('should handle modified limits in saveSettings', async () => {
            settingsService = new SettingsService({});

            await settingsService.updateSettings(settings => {
                settings.searchResultsLimit = 100;
                settings.snippetSizeLimit = 600;
            });

            expect(mockPlugin.saveData).toHaveBeenCalledWith(
                expect.objectContaining({
                    searchResultsLimit: 100,
                    snippetSizeLimit: 600
                })
            );
        });
    });
});

import { AIProvider, AIProviderModel, fromModel, isValidProviderModel } from "Enums/ApiProvider";
import { Copy } from "Enums/Copy";
import { Selector } from "Enums/Selector";
import type VaultkeeperAIPlugin from "main";
import { HelpModal } from "Modals/HelpModal";
import { DropdownComponent, PluginSettingTab, Setting, ToggleComponent, setIcon, setTooltip } from "obsidian";
import { Resolve } from "Services/DependencyService";
import type { EventService } from "Services/EventService";
import type { SettingsService } from "Services/SettingsService";
import { Services } from "Services/Services";
import { closePluginSettings } from "Helpers/Helpers";
import type { MemoriesService } from "Services/MemoriesService";
import { RegisterAiProvider } from "Services/ServiceRegistration";

export class VaultkeeperAISettingTab extends PluginSettingTab {
	private readonly plugin: VaultkeeperAIPlugin;
	private readonly settingsService: SettingsService;
	private readonly memoriesService: MemoriesService;
	private readonly eventService: EventService;

	private apiKeySetting: Setting | null = null;
	private apiKeyInputEl: HTMLInputElement | null = null;
	private fileDisclaimerSetting: Setting | null = null;
	private planningModelDropdown: DropdownComponent | null = null;
	private quickActionModelDropdown: DropdownComponent | null = null;
	private allowUpdatingMemoriesSetting: Setting | null = null;
	private allowUpdatingMemoriesToggleComponent: ToggleComponent | null = null;

	constructor() {
		const plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
		
		super(plugin.app, plugin);
		this.plugin = plugin;

		this.settingsService = Resolve<SettingsService>(Services.SettingsService);
		this.memoriesService = Resolve<MemoriesService>(Services.MemoriesService);
		this.eventService = Resolve<EventService>(Services.EventService);
	}

	public display() {
		const { containerEl } = this;

		containerEl.empty();

		/* Model Selection Setting */
		new Setting(containerEl)
			.setName(Copy.SettingModel)
			.setDesc(Copy.SettingModelDesc)
			.addDropdown((dropdown) => {
				this.populateModelDropdown(dropdown);
				dropdown.setValue(this.settingsService.settings.model);
				dropdown.onChange(async (value) => {
					if (!isValidProviderModel(value)) {
						return;
					}
					await this.settingsService.updateSettings(settings => {
						settings.model = value;
						settings.provider = fromModel(value);
					});
					if (this.apiKeyInputEl) {
						this.apiKeyInputEl.value = this.settingsService.getApiKeyForCurrentModel();
						this.highlightApiKey();
					}
					this.updateFileDisclaimer();
					await this.updateModelDropdowns();
					RegisterAiProvider();
				});
			});

		/* Planning Model Selection Setting */
		const currentProvider = fromModel(this.settingsService.settings.model);
		const planningModelDescFragment = createFragment();
		planningModelDescFragment.appendText(Copy.SettingPlanningModelDesc);
		planningModelDescFragment.createEl("br");
		planningModelDescFragment.createEl("br");
		planningModelDescFragment.createSpan({ text: Copy.SettingPlanningModelTip, cls: "planning-model-description-tip" });
		new Setting(containerEl)
			.setName(Copy.SettingPlanningModel)
			.setDesc(planningModelDescFragment)
			.addDropdown((dropdown) => {
				this.planningModelDropdown = dropdown;
				this.populateModelDropdown(dropdown, currentProvider);
				dropdown.setValue(this.settingsService.settings.planningModel);
				dropdown.onChange(async (value) => {
					if (!isValidProviderModel(value)) {
						return;
					}
					await this.settingsService.updateSettings(settings => {
						settings.planningModel = value;
					});
					RegisterAiProvider();
				});
			});

		/* Quick Action Model Selection Setting */
		new Setting(containerEl)
			.setName(Copy.SettingQuickActionModel)
			.setDesc(Copy.SettingQuickActionModelDesc)
			.addDropdown((dropdown) => {
				this.quickActionModelDropdown = dropdown;
				this.populateModelDropdown(dropdown);
				dropdown.setValue(this.settingsService.settings.quickActionModel);
				dropdown.onChange(async (value) => {
					if (!isValidProviderModel(value)) {
						return;
					}
					await this.settingsService.updateSettings(settings => {
						settings.quickActionModel = value;
					});
					RegisterAiProvider();
				});
			});

		/* API Key Setting */
		this.apiKeySetting = new Setting(containerEl)
			.setName(Copy.SettingApiKey)
			.setDesc(Copy.SettingApiKeyDesc)
			.addText(text => {
				text.setPlaceholder(Copy.PlaceholderEnterApiKey)
					.setValue(this.settingsService.getApiKeyForCurrentModel())
					.onChange(async (value) => {
						await this.settingsService.updateSettings(async settings => {
							await this.settingsService.setApiKeyForProvider(fromModel(settings.model), value);
						});
						this.highlightApiKey();
						RegisterAiProvider();
					});
				text.inputEl.type = "password";
				this.apiKeyInputEl = text.inputEl;
			})
			.addExtraButton(button => {
				button
					.setTooltip(Copy.TooltipShowApiKey)
					.onClick(() => {
						if (this.apiKeyInputEl && this.apiKeyInputEl.type === "password") {
							this.apiKeyInputEl.type = "text";
							setIcon(button.extraSettingsEl, "eye-off");
							setTooltip(button.extraSettingsEl, Copy.TooltipHideApiKey);
						} else if (this.apiKeyInputEl) {
							this.apiKeyInputEl.type = "password";
							setIcon(button.extraSettingsEl, "eye");
							setTooltip(button.extraSettingsEl, Copy.TooltipShowApiKey);
						}
					});
				setIcon(button.extraSettingsEl, "eye");
			});
		this.highlightApiKey();

		/* Model files API disclaimer */
		this.fileDisclaimerSetting = new Setting(containerEl)
		.setDesc(Copy.SettingFileMonitoringClaude)
		.addExtraButton(button => {
			button
				.setTooltip(Copy.TooltipLearnMoreFileMonitoring)
				.onClick(() => {
					const modal = Resolve<HelpModal>(Services.HelpModal);
					modal.open(2); // Opens HelpModal to "Plugin Guide" (topic 2)
				});
			setIcon(button.extraSettingsEl, "help-circle");
		});
		this.updateFileDisclaimer();

		/* Exclusions Setting */
		new Setting(containerEl)
			.setName(Copy.SettingFileExclusions)
			.setDesc(Copy.SettingFileExclusionsDesc)
			.addTextArea(text => {
				text.setPlaceholder(Copy.PlaceholderFileExclusions)
					.setValue(this.settingsService.settings.exclusions.join("\n"))
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.exclusions = value.split("\n").map(line => line.trim()).filter(line => line.length > 0);
						});
					});
				text.inputEl.classList.add(Selector.AIExclusionsInput);
			});

		/* Context Header */
		new Setting(containerEl)
			.setHeading()
			.setName(Copy.SettingContext);

		/* Search Results Limit Setting */
		new Setting(containerEl)
			.setName(Copy.SettingSearchResultsLimit)
			.setDesc(Copy.SettingSearchResultsLimitDesc)
			.addSlider(slider => {
				slider
					.setLimits(5, 40, 1)
					.setValue(this.settingsService.settings.searchResultsLimit)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.searchResultsLimit = value;
						});
					});
			});

		/* Snippet Size Limit Setting */
		new Setting(containerEl)
			.setName(Copy.SettingSnippetSizeLimit)
			.setDesc(Copy.SettingSnippetSizeLimitDesc)
			.addSlider(slider => {
				slider
					.setLimits(50, 1000, 10)
					.setValue(this.settingsService.settings.snippetSizeLimit)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.snippetSizeLimit = value;
						});
					});
			});

		/* Web Access Header */
		new Setting(containerEl)
			.setHeading()
			.setName(Copy.SettingWebViewerAccess);

		/* Enable Web Viewer Setting */
		new Setting(containerEl)
			.setName(Copy.SettingEnableWebViewer)
			.setDesc(Copy.SettingEnableWebViewerDesc)
			.addToggle(toggle => {
				toggle
					.setValue(this.settingsService.settings.enableWebViewer)
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.enableWebViewer = value;
						});
					});
			});

		/* Memories Header */
		new Setting(containerEl)
			.setHeading()
			.setName(Copy.SettingMemories);

		/* Enable Memories Setting */
		new Setting(containerEl)
			.setName(Copy.SettingEnableMemories)
			.setDesc(Copy.SettingEnableMemoriesDesc)
			.addToggle(toggle => {
				toggle
					.setValue(this.settingsService.settings.enableMemories)
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.enableMemories = value;
						});
						this.updateAllowUpdatingMemoriesSetting();
					});
			});

		/* Allow Updating Memories Setting */
		this.allowUpdatingMemoriesSetting = new Setting(containerEl)
			.setName(Copy.SettingAllowUpdatingMemories)
			.setDesc(Copy.SettingAllowUpdatingMemoriesDesc)
			.addToggle(toggle => {
				this.allowUpdatingMemoriesToggleComponent = toggle;
				toggle
					.setValue(this.settingsService.settings.allowUpdatingMemories)
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.allowUpdatingMemories = value;
						});
					})
			});
		this.updateAllowUpdatingMemoriesSetting();

		/* Access Memories banner */
		new Setting(containerEl)
		.setDesc(Copy.SettingAccessMemories)
		.addExtraButton(button => {
			button
				.setTooltip(Copy.TooltipAccessMemories)
				.onClick(async () => {
					await this.memoriesService.openMemories();
					closePluginSettings(this.plugin);
				});
			setIcon(button.extraSettingsEl, "clipboard-clock");
		});
		this.updateFileDisclaimer();

		/* Quick Actions Header */
		new Setting(containerEl)
			.setHeading()
			.setName(Copy.SettingQuickActions);

		/* Enable Context Menu Actions */
		new Setting(containerEl)
			.setName(Copy.SettingEnableContextMenuActions)
			.setDesc(Copy.SettingEnableContextMenuActionsDesc)
			.addToggle(toggle => {
				toggle
					.setValue(this.settingsService.settings.enableContextMenuActions)
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.enableContextMenuActions = value;
						});
					});
			});

		/* Enable Toolbar Actions */
		new Setting(containerEl)
			.setName(Copy.SettingEnableToolbarActions)
			.setDesc(Copy.SettingEnableToolbarActionsDesc)
			.addToggle(toggle => {
				toggle
					.setValue(this.settingsService.settings.enableToolbarActions)
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.enableToolbarActions = value;
						});
					});
			});

		/* Advanced Settings Header */
		new Setting(containerEl)
			.setHeading()
			.setName(Copy.SettingAdvancedSettings);

		/* Hide Drawer Elements */
		new Setting(containerEl)
			.setName(Copy.SettingHideDrawerElements)
			.setDesc(Copy.SettingHideDrawerElementsDesc)
			.addToggle(toggle => {
				toggle
					.setValue(this.settingsService.settings.hideDrawerElements)
					.onChange(async (value) => {
						await this.settingsService.updateSettings(settings => {
							settings.hideDrawerElements = value;
						});
					});
			});
	}

	private populateModelDropdown(dropdown: DropdownComponent, providerFilter?: AIProvider): void {
		const select = dropdown.selectEl;

		// Claude models
		if (!providerFilter || providerFilter === AIProvider.Claude) {
			const claudeGroup = select.createEl("optgroup", { attr: { label: Copy.ProviderClaude } });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeSonnet_4_6, text: Copy.ClaudeSonnet_4_6 });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeOpus_4_8, text: Copy.ClaudeOpus_4_8 });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeHaiku_4_5, text: Copy.ClaudeHaiku_4_5 });
		}

		// OpenAI models
		if (!providerFilter || providerFilter === AIProvider.OpenAI) {
			const openaiGroup = select.createEl("optgroup", { attr: { label: Copy.ProviderOpenAI } });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_5_5, text: Copy.GPT_5_5 });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_5_4_Mini, text: Copy.GPT_5_4_Mini });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_5_4_Nano, text: Copy.GPT_5_4_Nano });
		}

		// Gemini models
		if (!providerFilter || providerFilter === AIProvider.Gemini) {
			const geminiGroup = select.createEl("optgroup", { attr: { label: Copy.ProviderGemini } });
			geminiGroup.createEl("option", { value: AIProviderModel.GeminiFlash_3_1_Lite, text: Copy.GeminiPro_3_1_Preview });
			geminiGroup.createEl("option", { value: AIProviderModel.GeminiFlash_3_Flash, text: Copy.GeminiPro_3_1_Preview });
			geminiGroup.createEl("option", { value: AIProviderModel.GeminiFlash_3_5_Flash, text: Copy.GeminiPro_3_1_Preview });
			geminiGroup.createEl("option", { value: AIProviderModel.GeminiPro_3_1_Preview, text: Copy.GeminiPro_3_1_Preview });
		}

		// Mistral models
		if (!providerFilter || providerFilter === AIProvider.Mistral) {
			const mistralGroup = select.createEl("optgroup", { attr: { label: Copy.ProviderMistral } });
			mistralGroup.createEl("option", { value: AIProviderModel.MistralMedium, text: Copy.MistralMedium });
			mistralGroup.createEl("option", { value: AIProviderModel.MistralSmall, text: Copy.MistralSmall });
		}
	}

	private async updateModelDropdowns(): Promise<void> {
		await this.settingsService.updateSettings(settings => {
			const currentProvider = fromModel(settings.model);

			if (this.planningModelDropdown) {
				const planningProvider = fromModel(settings.planningModel);
				this.planningModelDropdown.selectEl.empty();
				this.populateModelDropdown(this.planningModelDropdown, currentProvider);
	
				if (planningProvider !== currentProvider) {
					settings.planningModel = settings.model;
				}
	
				this.planningModelDropdown.setValue(settings.planningModel);
			}

			if (this.quickActionModelDropdown) {
				const quickActionProvider = fromModel(settings.quickActionModel);
				this.quickActionModelDropdown.selectEl.empty();
				this.populateModelDropdown(this.quickActionModelDropdown);
	
				if (quickActionProvider !== currentProvider) {
					settings.quickActionModel = settings.model;
				}
	
				this.quickActionModelDropdown.setValue(settings.quickActionModel);
			}
		});
	}

	private highlightApiKey() {
		if (this.apiKeySetting) {
			const currentApiKey = this.settingsService.getApiKeyForCurrentModel();
			if (currentApiKey.trim() === "") {
				this.apiKeySetting.settingEl.removeClass(Selector.ApiKeySettingOk);
				this.apiKeySetting.settingEl.addClass(Selector.ApiKeySettingError);
			} else {
				this.apiKeySetting.settingEl.removeClass(Selector.ApiKeySettingError);
				this.apiKeySetting.settingEl.addClass(Selector.ApiKeySettingOk);
			}
		}
	}

	private updateAllowUpdatingMemoriesSetting() {
		if (this.allowUpdatingMemoriesToggleComponent && this.allowUpdatingMemoriesSetting) {
			const enabled = this.settingsService.settings.enableMemories;
			const updateEnabled = this.settingsService.settings.allowUpdatingMemories;
			this.allowUpdatingMemoriesToggleComponent.disabled = !enabled;
			this.allowUpdatingMemoriesSetting.settingEl.toggleClass("setting-item-memories-disabled-accent", !enabled && updateEnabled);
			this.allowUpdatingMemoriesSetting.settingEl.toggleClass("setting-item-memories-disabled", !enabled && !updateEnabled);
		}
	}

	private updateFileDisclaimer() {
		if (this.fileDisclaimerSetting) {
			const provider = fromModel(this.settingsService.settings.model);
			let disclaimerText;

			switch(provider) {
				case AIProvider.Gemini:
					disclaimerText = Copy.SettingFileMonitoringGemini;
					break;
				case AIProvider.Claude:
					disclaimerText = Copy.SettingFileMonitoringClaude;
					break;
				case AIProvider.OpenAI:
					disclaimerText = Copy.SettingFileMonitoringOpenAI;
					break;
				case AIProvider.Mistral:
					disclaimerText = Copy.SettingFileMonitoringMistral;
					break;
			}

			this.fileDisclaimerSetting.setDesc(disclaimerText);
		}
	}
}
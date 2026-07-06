import { AIProvider, AIProviderModel, DEFAULT_PLANNING_MODEL_BY_PROVIDER, DEFAULT_QUICK_MODEL_BY_PROVIDER, fromModel, isvalidProvider, isValidProviderModel } from "Enums/ApiProvider";
import { Copy } from "Enums/Copy";
import { Selector } from "Enums/Selector";
import type VaultkeeperAIPlugin from "main";
import { HelpModal } from "Modals/HelpModal";
import { DropdownComponent, PluginSettingTab, Setting, ToggleComponent, setIcon, setTooltip } from "obsidian";
import { Resolve } from "Services/DependencyService";
import type { SettingsService } from "Services/SettingsService";
import { Services } from "Services/Services";
import { closePluginSettings } from "Helpers/Helpers";
import type { MemoriesService } from "Services/MemoriesService";
import { RegisterAiProvider } from "Services/ServiceRegistration";

export class VaultkeeperAISettingTab extends PluginSettingTab {
	private readonly plugin: VaultkeeperAIPlugin;
	private readonly settingsService: SettingsService;
	private readonly memoriesService: MemoriesService;

	private apiKeySetting: Setting | null = null;
	private apiKeyInputEl: HTMLInputElement | null = null;
	private localApiKeyInputEl: HTMLInputElement | null = null;
	private fileDisclaimerSetting: Setting | null = null;
	private providerSectionEl: HTMLElement | null = null;
	private modelDropdown: DropdownComponent | null = null;
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
	}

	public display() {
		const { containerEl } = this;

		containerEl.empty();

		/* Provider Selection Setting */
		new Setting(containerEl)
			.setName(Copy.SettingProvider)
			.setDesc(Copy.SettingProviderDesc)
			.addDropdown((dropdown) => {
				this.populateProviderDropdown(dropdown);
				dropdown.setValue(this.settingsService.settings.provider);
				dropdown.onChange(async value => {
					if (!isvalidProvider(value)) {
						return;
					}
					await this.settingsService.updateSettings(settings => {
						settings.provider = value;
						const cached = settings.cachedModelSettings[settings.provider];
						if (cached.model) {
							settings.model = cached.model;
						}
						if (cached.planningModel) {
							settings.planningModel = cached.planningModel;
						}
						if (cached.quickActionModel) {
							settings.quickActionModel = cached.quickActionModel;
						}
					});
					await this.settingsService.ensureValidModels();
					if (value !== AIProvider.Local) {
						await this.updateModelDropdowns();
						this.updateFileDisclaimer();
					}
					RegisterAiProvider();
					this.renderProviderSection();
				});
			});

		this.providerSectionEl = containerEl.createDiv();
		this.renderProviderSection();

		/* Exclusions Header */
		new Setting(containerEl)
			.setHeading()
			.setName(Copy.SettingExclusionsHeading);

		/* Exclusions Setting */
		new Setting(containerEl)
			.setName(Copy.SettingFileExclusions)
			.setDesc(Copy.SettingFileExclusionsDesc)
			.addTextArea(text => {
				text.setPlaceholder(Copy.PlaceholderFileExclusions)
					.setValue(this.settingsService.settings.exclusions.join("\n"))
					.onChange(async value => {
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
					.onChange(async value => {
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
					.onChange(async value => {
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
					.onChange(async value => {
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
					.onChange(async value => {
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
					.onChange(async value => {
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
					.onChange(async value => {
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
					.onChange(async value => {
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
					.onChange(async value => {
						await this.settingsService.updateSettings(settings => {
							settings.hideDrawerElements = value;
						});
					});
			});
	}

	private renderProviderSection(): void {
		if (!this.providerSectionEl) {
			return;
		}

		const containerEl = this.providerSectionEl;
		containerEl.empty();

		/* Local Server URL Setting */
		if (this.settingsService.settings.provider === AIProvider.Local) {
			new Setting(containerEl)
				.setName(Copy.SettingLocalUrl)
				.setDesc(Copy.SettingLocalUrlDesc)
				.addText(text => {
					text.setPlaceholder(Copy.PlaceholderLocalUrl)
						.setValue(this.settingsService.settings.localUrl)
						.onChange(async value => {
						await this.settingsService.updateSettings(settings => {
							settings.localUrl = value;
						});
					});
					text.inputEl.classList.add(Selector.LocalUrlInput);
				});

			/* Local API Key Setting */
			new Setting(containerEl)
				.setName(Copy.SettingApiKey)
				.setDesc(Copy.SettingApiKeyLocalDesc)
				.addText(text => {
					text.setPlaceholder(Copy.PlaceholderApiKey)
						.setValue(this.settingsService.settings.apiKeys.local)
						.onChange(async value => {
							await this.settingsService.setApiKeyForProvider(this.settingsService.settings.provider, value);
						});
					text.inputEl.type = "password";
					this.localApiKeyInputEl = text.inputEl;
				})
				.addExtraButton(button => {
					button
						.setTooltip(Copy.TooltipShowApiKey)
						.onClick(() => {
							if (this.localApiKeyInputEl && this.localApiKeyInputEl.type === "password") {
								this.localApiKeyInputEl.type = "text";
								setIcon(button.extraSettingsEl, "eye-off");
								setTooltip(button.extraSettingsEl, Copy.TooltipHideApiKey);
							} else if (this.localApiKeyInputEl) {
								this.localApiKeyInputEl.type = "password";
								setIcon(button.extraSettingsEl, "eye");
								setTooltip(button.extraSettingsEl, Copy.TooltipShowApiKey);
							}
						});
					setIcon(button.extraSettingsEl, "eye");
				});

			/* Local Model Selection Setting */
			new Setting(containerEl)
				.setName(Copy.SettingModel)
				.setDesc(Copy.SettingLocalModelDesc)
				.addText(text => {
					text.setPlaceholder(Copy.PlaceholderModelName)
						.setValue(this.settingsService.settings.localModels.model)
						.onChange(async value => {
							await this.settingsService.updateSettings(settings => {
								settings.localModels.model = value;
							});
						});
				});

			/* Local Planning Model Selection Setting */
			new Setting(containerEl)
				.setName(Copy.SettingPlanningModel)
				.setDesc(Copy.SettingLocalPlanningModelDesc)
				.addText(text => {
					text.setPlaceholder(Copy.PlaceholderModelName)
						.setValue(this.settingsService.settings.localModels.planningModel)
						.onChange(async value => {
							await this.settingsService.updateSettings(settings => {
								settings.localModels.planningModel = value;
							});
						});
				});

			/* Local Quick Action Model Selection Setting */
			new Setting(containerEl)
				.setName(Copy.SettingQuickActionModel)
				.setDesc(Copy.SettingLocalQuickActionModelDesc)
				.addText(text => {
					text.setPlaceholder(Copy.PlaceholderModelName)
						.setValue(this.settingsService.settings.localModels.quickActionModel)
						.onChange(async value => {
							await this.settingsService.updateSettings(settings => {
								settings.localModels.quickActionModel = value;
							});
						});
				});

			const templateWarningDescFragment = createFragment();
			const templateWarningGridEl = templateWarningDescFragment.createDiv({ cls: Selector.SettingDescIconGrid });
			setIcon(templateWarningGridEl.createDiv({ cls: Selector.TemplateWarningIcon }), "circle-alert");
			const templateWarningTextEl = templateWarningGridEl.createDiv();
			templateWarningTextEl.appendText(Copy.SettingLocalModelTemplateWarning);
			templateWarningTextEl.createEl("a", {
				text: Copy.SettingLocalModelTemplateWarningLinkText,
				href: "https://lmstudio.ai/docs/app/advanced/prompt-template",
				cls: Selector.FileDisclaimerLink
			});
			new Setting(containerEl)
				.setDesc(templateWarningDescFragment);

		} else {
			/* API Key Setting */
			this.apiKeySetting = new Setting(containerEl)
				.setName(Copy.SettingApiKey)
				.setDesc(Copy.SettingApiKeyDesc)
				.addText(text => {
					text.setPlaceholder(Copy.PlaceholderEnterApiKey)
						.setValue(this.settingsService.getApiKeyForCurrentProvider())
						.onChange(async value => {
							await this.settingsService.setApiKeyForProvider(this.settingsService.settings.provider, value);
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

			/* Model Selection Setting */
			new Setting(containerEl)
				.setName(Copy.SettingModel)
				.setDesc(Copy.SettingModelDesc)
				.addDropdown((dropdown) => {
					this.modelDropdown = dropdown;
					this.populateModelDropdown(dropdown, this.settingsService.settings.provider);
					dropdown.setValue(this.settingsService.settings.model);
					dropdown.onChange(async value => {
						if (!isValidProviderModel(value)) {
							return;
						}
						await this.settingsService.updateSettings(settings => {
							settings.model = value;
							settings.cachedModelSettings[settings.provider].model = value;
						});
						RegisterAiProvider();
					});
				});

			/* Planning Model Selection Setting */
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
					this.populateModelDropdown(dropdown, this.settingsService.settings.provider);
					dropdown.setValue(this.settingsService.settings.planningModel);
					dropdown.onChange(async value => {
						if (!isValidProviderModel(value)) {
							return;
						}
						await this.settingsService.updateSettings(settings => {
							settings.planningModel = value;
							settings.cachedModelSettings[settings.provider].planningModel = value;
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
					this.populateModelDropdown(dropdown, this.settingsService.settings.provider);
					dropdown.setValue(this.settingsService.settings.quickActionModel);
					dropdown.onChange(async value => {
						if (!isValidProviderModel(value)) {
							return;
						}
						await this.settingsService.updateSettings(settings => {
							settings.quickActionModel = value;
							settings.cachedModelSettings[settings.provider].quickActionModel = value;
						});
						RegisterAiProvider();
					});
				});

			/* Model files API disclaimer */
			this.fileDisclaimerSetting = new Setting(containerEl);
			this.updateFileDisclaimer();
		}
	}

	private populateProviderDropdown(dropdown: DropdownComponent) {
		const select = dropdown.selectEl;

		const localGroup = select.createEl("optgroup", { attr: { label: Copy.LocalProvider } });
		localGroup.createEl("option", { value: AIProvider.Local, text: Copy.ProviderLocal });

		const cloudGroup = select.createEl("optgroup", { attr: { label: Copy.CloudProvider } });
		cloudGroup.createEl("option", { value: AIProvider.Claude, text: Copy.ProviderClaude });
		cloudGroup.createEl("option", { value: AIProvider.OpenAI, text: Copy.ProviderOpenAI });
		cloudGroup.createEl("option", { value: AIProvider.Gemini, text: Copy.ProviderGemini });
		cloudGroup.createEl("option", { value: AIProvider.Mistral, text: Copy.ProviderMistral });
	}

	private populateModelDropdown(dropdown: DropdownComponent, providerFilter: AIProvider): void {
		switch (providerFilter) {
			case AIProvider.Claude:
				dropdown.addOptions({
					[AIProviderModel.ClaudeFable_5]: Copy.ClaudeFable_5,
					[AIProviderModel.ClaudeSonnet_5]: Copy.ClaudeSonnet_5,
					[AIProviderModel.ClaudeOpus_4_8]: Copy.ClaudeOpus_4_8,
					[AIProviderModel.ClaudeHaiku_4_5]: Copy.ClaudeHaiku_4_5
				});
				break;
			case AIProvider.OpenAI:
				dropdown.addOptions({
					[AIProviderModel.GPT_5_5_Pro]: Copy.GPT_5_5_Pro,
					[AIProviderModel.GPT_5_5]: Copy.GPT_5_5,
					[AIProviderModel.GPT_5_4_Mini]: Copy.GPT_5_4_Mini,
					[AIProviderModel.GPT_5_4_Nano]: Copy.GPT_5_4_Nano
				});
				break;
			case AIProvider.Gemini:
				dropdown.addOptions({
					[AIProviderModel.GeminiFlash_3_1_Lite]: Copy.GeminiFlash_3_1_Lite,
					[AIProviderModel.GeminiFlash_3_Flash]: Copy.GeminiFlash_3_Flash,
					[AIProviderModel.GeminiFlash_3_5_Flash]: Copy.GeminiFlash_3_5_Flash,
					[AIProviderModel.GeminiPro_3_1_Preview]: Copy.GeminiPro_3_1_Preview
				});
				break;
			case AIProvider.Mistral:
				dropdown.addOptions({
					[AIProviderModel.MistralMedium]: Copy.MistralMedium,
					[AIProviderModel.MistralSmall]: Copy.MistralSmall
				});
				break;
			case AIProvider.Local:
				// Local models are handled with a free text entry
				break;
		}
	}

	private async updateModelDropdowns(): Promise<void> {
		await this.settingsService.updateSettings(settings => {
			const currentProvider = settings.provider;

			if (this.modelDropdown) {
				const modelProvider = fromModel(settings.model);
				this.modelDropdown.selectEl.empty();
				this.populateModelDropdown(this.modelDropdown, currentProvider);
	
				if (modelProvider !== currentProvider) {
					settings.model = settings.cachedModelSettings[currentProvider].model ?? DEFAULT_PLANNING_MODEL_BY_PROVIDER[currentProvider];
				}
	
				this.modelDropdown.setValue(settings.model);
			}

			if (this.planningModelDropdown) {
				const planningProvider = fromModel(settings.planningModel);
				this.planningModelDropdown.selectEl.empty();
				this.populateModelDropdown(this.planningModelDropdown, currentProvider);
	
				if (planningProvider !== currentProvider) {
					settings.planningModel = settings.cachedModelSettings[currentProvider].planningModel ?? DEFAULT_PLANNING_MODEL_BY_PROVIDER[currentProvider];
				}
	
				this.planningModelDropdown.setValue(settings.planningModel);
			}

			if (this.quickActionModelDropdown) {
				const quickActionProvider = fromModel(settings.quickActionModel);
				this.quickActionModelDropdown.selectEl.empty();
				this.populateModelDropdown(this.quickActionModelDropdown, currentProvider);
	
				if (quickActionProvider !== currentProvider) {
					settings.quickActionModel = settings.cachedModelSettings[currentProvider].quickActionModel ?? DEFAULT_QUICK_MODEL_BY_PROVIDER[currentProvider];
				}
	
				this.quickActionModelDropdown.setValue(settings.quickActionModel);
			}
		});
	}

	private highlightApiKey() {
		if (this.apiKeySetting) {
			const currentApiKey = this.settingsService.getApiKeyForCurrentProvider();
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
			const provider = this.settingsService.settings.provider;
			let disclaimerText: string | null;

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
				case AIProvider.Local:
					disclaimerText = null; // Not shown when a local model is being used
			}

			if (disclaimerText === null) {
				this.fileDisclaimerSetting.setDesc("");
				return;
			}

			const disclaimerFragment = createFragment();
			const disclaimerGridEl = disclaimerFragment.createDiv({ cls: Selector.SettingDescIconGrid });
			setIcon(disclaimerGridEl.createDiv({ cls: Selector.FileDisclaimerIcon }), "help-circle");
			const disclaimerTextEl = disclaimerGridEl.createDiv();
			disclaimerTextEl.appendText(disclaimerText);
			disclaimerTextEl.createEl("a", {
				text: Copy.SettingFileMonitoringLinkText,
				cls: Selector.FileDisclaimerLink
			}).addEventListener("click", () => {
				const modal = Resolve<HelpModal>(Services.HelpModal);
				modal.open(7); // Opens HelpModal to "Uploaded Files" (topic 7)
			});

			this.fileDisclaimerSetting.setDesc(disclaimerFragment);
		}
	}
}
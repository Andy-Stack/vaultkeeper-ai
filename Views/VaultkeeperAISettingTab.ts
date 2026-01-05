import { AIProvider, AIProviderModel, fromModel } from "Enums/ApiProvider";
import { Copy } from "Enums/Copy";
import { Selector } from "Enums/Selector";
import type VaultkeeperAIPlugin from "main";
import { HelpModal } from "Modals/HelpModal";
import { DropdownComponent, PluginSettingTab, Setting, setIcon, setTooltip } from "obsidian";
import { Resolve } from "Services/DependencyService";
import type { SettingsService } from "Services/SettingsService";
import { Services } from "Services/Services";
import { RegisterAiProvider } from "Services/ServiceRegistration";

export class VaultkeeperAISettingTab extends PluginSettingTab {
	private readonly settingsService: SettingsService;

	private apiKeySetting: Setting | null = null;
	private apiKeyInputEl: HTMLInputElement | null = null;
	private fileDisclaimerSetting: Setting | null = null;
	private planningModelDropdown: DropdownComponent | null = null;

	constructor() {
		const plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
		super(plugin.app, plugin);
		this.settingsService = Resolve<SettingsService>(Services.SettingsService);
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
					this.settingsService.settings.model = value;
					await this.settingsService.saveSettings(() => RegisterAiProvider());
					if (this.apiKeyInputEl) {
						this.apiKeyInputEl.value = this.settingsService.getApiKeyForCurrentModel();
						this.highlightApiKey();
					}
					this.updateFileDisclaimer();
					await this.updatePlanningModelDropdown();
				});
			});

		/* Planning Model Selection Setting */
		const currentProvider = fromModel(this.settingsService.settings.model);
		const planningModelDescFragment = document.createDocumentFragment();
		planningModelDescFragment.appendText(Copy.SettingPlanningModelDesc);
		planningModelDescFragment.createEl("br");
		planningModelDescFragment.createEl("br");
		planningModelDescFragment.createEl("span", { text: Copy.SettingPlanningModelTip, cls: "planning-model-description-tip" });
		new Setting(containerEl)
			.setName(Copy.SettingPlanningModel)
			.setDesc(planningModelDescFragment)
			.addDropdown((dropdown) => {
				this.planningModelDropdown = dropdown;
				this.populateModelDropdown(dropdown, currentProvider);
				dropdown.setValue(this.settingsService.settings.planningModel);
				dropdown.onChange(async (value) => {
					this.settingsService.settings.planningModel = value;
					await this.settingsService.saveSettings();
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
						const provider = fromModel(this.settingsService.settings.model);
						this.settingsService.setApiKeyForProvider(provider, value);
						await this.settingsService.saveSettings(() => RegisterAiProvider());
						this.highlightApiKey();
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

		/* Exclusions Setting */
		new Setting(containerEl)
			.setName(Copy.SettingFileExclusions)
			.setDesc(Copy.SettingFileExclusionsDesc)
			.addTextArea(text => {
				text.setPlaceholder(Copy.PlaceholderFileExclusions)
					.setValue(this.settingsService.settings.exclusions.join("\n"))
					.onChange(async (value) => {
						this.settingsService.settings.exclusions = value.split("\n").map(line => line.trim()).filter(line => line.length > 0);
						await this.settingsService.saveSettings();
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
						this.settingsService.settings.searchResultsLimit = value;
						await this.settingsService.saveSettings();
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
						this.settingsService.settings.snippetSizeLimit = value;
						await this.settingsService.saveSettings();
					});
			});

		/* File Monitoring Guidelines */
		new Setting(containerEl)
			.setHeading()
			.setName(Copy.SettingFileMonitoringHeading);

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
	}

	private populateModelDropdown(dropdown: DropdownComponent, providerFilter?: AIProvider): void {
		const select = dropdown.selectEl;

		// Claude models
		if (!providerFilter || providerFilter === AIProvider.Claude) {
			const claudeGroup = select.createEl("optgroup", { attr: { label: Copy.ProviderClaude } });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeSonnet_4_5, text: Copy.ClaudeSonnet_4_5 });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeSonnet_4, text: Copy.ClaudeSonnet_4 });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeSonnet_3_7, text: Copy.ClaudeSonnet_3_7 });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeOpus_4_5, text: Copy.ClaudeOpus_4_5 });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeOpus_4_1, text: Copy.ClaudeOpus_4_1 });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeOpus_4, text: Copy.ClaudeOpus_4 });
			claudeGroup.createEl("option", { value: AIProviderModel.ClaudeHaiku_4_5, text: Copy.ClaudeHaiku_4_5 });
		}

		// OpenAI models
		if (!providerFilter || providerFilter === AIProvider.OpenAI) {
			const openaiGroup = select.createEl("optgroup", { attr: { label: Copy.ProviderOpenAI } });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_5_1, text: Copy.GPT_5_1 });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_5, text: Copy.GPT_5 });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_5_Mini, text: Copy.GPT_5_Mini });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_5_Nano, text: Copy.GPT_5_Nano });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_5_Pro, text: Copy.GPT_5_Pro });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_4o, text: Copy.GPT_4o });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_4o_Mini, text: Copy.GPT_4o_Mini });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_4_1, text: Copy.GPT_4_1 });
			openaiGroup.createEl("option", { value: AIProviderModel.GPT_4_1_Mini, text: Copy.GPT_4_1_Mini });
		}

		// Gemini models
		if (!providerFilter || providerFilter === AIProvider.Gemini) {
			const geminiGroup = select.createEl("optgroup", { attr: { label: Copy.ProviderGemini } });
			geminiGroup.createEl("option", { value: AIProviderModel.GeminiFlash_2_5_Lite, text: Copy.GeminiFlash_2_5_Lite });
			geminiGroup.createEl("option", { value: AIProviderModel.GeminiFlash_2_5, text: Copy.GeminiFlash_2_5 });
			geminiGroup.createEl("option", { value: AIProviderModel.GeminiPro_2_5, text: Copy.GeminiPro_2_5 });
			geminiGroup.createEl("option", { value: AIProviderModel.GeminiPro_3_Preview, text: Copy.GeminiPro_3_Preview });
		}
	}

	private async updatePlanningModelDropdown(): Promise<void> {
		if (!this.planningModelDropdown) return;

		const currentProvider = fromModel(this.settingsService.settings.model);
		const planningProvider = fromModel(this.settingsService.settings.planningModel);

		// Clear existing options
		this.planningModelDropdown.selectEl.empty();
		this.populateModelDropdown(this.planningModelDropdown, currentProvider);

		// If planning model provider doesn't match, reset to main model
		if (planningProvider !== currentProvider) {
			this.settingsService.settings.planningModel = this.settingsService.settings.model;
			await this.settingsService.saveSettings();
		}

		this.planningModelDropdown.setValue(this.settingsService.settings.planningModel);
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
			}

			this.fileDisclaimerSetting.setDesc(disclaimerText);
		}
	}
}
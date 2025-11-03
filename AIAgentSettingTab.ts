import { AIProvider, AIProviderModel } from "Enums/ApiProvider";
import { Copy } from "Enums/Copy";
import { Path } from "Enums/Path";
import { Selector } from "Enums/Selector";
import type AIAgentPlugin from "main";
import { PluginSettingTab, Setting, App, setIcon, setTooltip } from "obsidian";
import { Resolve } from "Services/DependencyService";
import type { SettingsService } from "Services/SettingsService";
import { Services } from "Services/Services";
import { RegisterAiProvider } from "Services/ServiceRegistration";

export class AIAgentSettingTab extends PluginSettingTab {
	private readonly settingsService: SettingsService;

	private apiKeySetting: Setting | null = null;
	private apiKeyInputEl: HTMLInputElement | null = null;

	constructor() {
		const plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
		super(plugin.app, plugin);
		this.settingsService = Resolve<SettingsService>(Services.SettingsService);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		/* Model Selection Setting */
		new Setting(containerEl)
			.setName("Model")
			.setDesc("Select the AI model to use.")
			.addDropdown((dropdown) => {
				const select = dropdown.selectEl;

				// Claude models group
				const claudeGroup = select.createEl("optgroup", { attr: { label: "Claude" } });
				claudeGroup.createEl("option", {
					value: AIProviderModel.ClaudeSonnet_4_5,
					text: Copy.ClaudeSonnet_4_5
				});
				claudeGroup.createEl("option", {
					value: AIProviderModel.ClaudeSonnet_4,
					text: Copy.ClaudeSonnet_4
				});
				claudeGroup.createEl("option", {
					value: AIProviderModel.ClaudeSonnet_3_7,
					text: Copy.ClaudeSonnet_3_7
				});
				claudeGroup.createEl("option", {
					value: AIProviderModel.ClaudeOpus_4_1,
					text: Copy.ClaudeOpus_4_1
				});
				claudeGroup.createEl("option", {
					value: AIProviderModel.ClaudeOpus_4,
					text: Copy.ClaudeOpus_4
				});
				claudeGroup.createEl("option", {
					value: AIProviderModel.ClaudeHaiku_4_5,
					text: Copy.ClaudeHaiku_4_5
				});

				// OpenAI models group
				const openaiGroup = select.createEl("optgroup", { attr: { label: "OpenAI" } });
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_5,
					text: Copy.GPT_5
				});
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_5_Mini,
					text: Copy.GPT_5_Mini
				});
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_5_Nano,
					text: Copy.GPT_5_Nano
				});
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_5_Pro,
					text: Copy.GPT_5_Pro
				});
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_4o,
					text: Copy.GPT_4o
				});
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_4o_Mini,
					text: Copy.GPT_4o_Mini
				});
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_4_1,
					text: Copy.GPT_4_1
				});
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_4_1_Mini,
					text: Copy.GPT_4_1_Mini
				});
				openaiGroup.createEl("option", {
					value: AIProviderModel.GPT_4_1_Nano,
					text: Copy.GPT_4_1_Nano
				});

				// Gemini models group
				const geminiGroup = select.createEl("optgroup", { attr: { label: "Gemini" } });
				geminiGroup.createEl("option", {
					value: AIProviderModel.GeminiFlash_2_5_Lite,
					text: Copy.GeminiFlash_2_5_Lite
				});
				geminiGroup.createEl("option", {
					value: AIProviderModel.GeminiFlash_2_5,
					text: Copy.GeminiFlash_2_5
				});
				geminiGroup.createEl("option", {
					value: AIProviderModel.GeminiPro_2_5,
					text: Copy.GeminiPro_2_5
				});

				dropdown.setValue(this.settingsService.settings.model);
				dropdown.onChange(async (value) => {
					this.settingsService.settings.model = value;
					await this.settingsService.saveSettings(() => RegisterAiProvider());
					if (this.apiKeyInputEl) {
						this.apiKeyInputEl.value = this.settingsService.getApiKeyForCurrentModel();
						this.highlightApiKey();
					}
				});
			});

		/* API Key Setting */
		this.apiKeySetting = new Setting(containerEl)
			.setName("API Key")
			.setDesc("Enter your API key here.")
			.addText(text => {
				text.setPlaceholder("Enter your API key")
					.setValue(this.settingsService.getApiKeyForCurrentModel())
					.onChange(async (value) => {
						const provider = AIProvider.fromModel(this.settingsService.settings.model);
						this.settingsService.setApiKeyForProvider(provider, value);
						await this.settingsService.saveSettings();
						this.highlightApiKey();
					});
				text.inputEl.type = "password";
				this.apiKeyInputEl = text.inputEl;
			})
			.addExtraButton(button => {
				button
					.setTooltip("Show API Key")
					.onClick(() => {
						if (this.apiKeyInputEl && this.apiKeyInputEl.type === "password") {
							this.apiKeyInputEl.type = "text";
							setIcon(button.extraSettingsEl, "eye-off");
							setTooltip(button.extraSettingsEl, "Hide API Key");
						} else if (this.apiKeyInputEl) {
							this.apiKeyInputEl.type = "password";
							setIcon(button.extraSettingsEl, "eye");
							setTooltip(button.extraSettingsEl, "Show API Key");
						}
					});
				setIcon(button.extraSettingsEl, "eye");
			});
		this.highlightApiKey();

		/* Exclusions Setting */
		new Setting(containerEl)
			.setName("AI File Exclusions")
			.setDesc("Set which directories and files the AI should ignore. Enter one path per line - supports glob patterns like folder/**, *.md")
			.addTextArea(text => {
				text.setPlaceholder(`Examples:\n\n${Path.Conversations}/*.json\nPrivateNotes/**`)
					.setValue(this.settingsService.settings.exclusions.join("\n"))
					.onChange(async (value) => {
						this.settingsService.settings.exclusions = value.split("\n").map(line => line.trim()).filter(line => line.length > 0);
						await this.settingsService.saveSettings();
					});
				text.inputEl.classList.add(Selector.AIExclusionsInput);
			});
	}

	private highlightApiKey(): void {
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
}
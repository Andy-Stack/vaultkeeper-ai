import { AIProvider } from "Enums/ApiProvider";
import type AIAgentPlugin from "main";
import { PluginSettingTab, Setting, App, setIcon, setTooltip } from "obsidian";

export class AIAgentSettingTab extends PluginSettingTab {
	plugin: AIAgentPlugin;
	apiKeySetting: Setting | null = null;

	constructor(app: App, plugin: AIAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("API Provider")
			.setDesc("Select the API provider to use.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption(AIProvider.Gemini, AIProvider.Gemini)
					.addOption(AIProvider.OpenAI, AIProvider.OpenAI)
					.setValue(this.plugin.settings.apiProvider)
					.onChange(async (value) => {
						this.plugin.settings.apiProvider = value;
						await this.plugin.saveSettings();
					})
			);

		let inputEl: HTMLInputElement;
		this.apiKeySetting = new Setting(containerEl)
			.setName("API Key")
			.setDesc("Enter your API key here.")
			.addText(text => {
				text.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
						this.highlightApiKey();
					});
				text.inputEl.type = "password";
				inputEl = text.inputEl;
			})
			.addExtraButton(button => {
				button
					.setTooltip("Show API Key")
					.onClick(() => {
						if (inputEl.type === "password") {
							inputEl.type = "text";
							setIcon(button.extraSettingsEl, "eye-off");
                            setTooltip(button.extraSettingsEl, "Hide API Key");
						} else {
							inputEl.type = "password";
							setIcon(button.extraSettingsEl, "eye");
                            setTooltip(button.extraSettingsEl, "Show API Key");
						}
					});
				setIcon(button.extraSettingsEl, "eye");
			});

		this.highlightApiKey();
	}

	highlightApiKey(): void {
		if (this.apiKeySetting) {
            if (this.plugin.settings.apiKey.trim() === "") {
                this.apiKeySetting.settingEl.removeClass("api-key-setting-ok");
                this.apiKeySetting.settingEl.addClass("api-key-setting-error");
            } else {
                this.apiKeySetting.settingEl.removeClass("api-key-setting-error");
                this.apiKeySetting.settingEl.addClass("api-key-setting-ok");
            }
		}
	}
}
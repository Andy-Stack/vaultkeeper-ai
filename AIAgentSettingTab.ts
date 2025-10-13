import { AIProvider } from "Enums/ApiProvider";
import { Path } from "Enums/Path";
import { Selector } from "Enums/Selector";
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

		/* API Provider Setting */
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

		/* API Key Setting */
		let apiKeyInputEl: HTMLInputElement;
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
				apiKeyInputEl = text.inputEl;
			})
			.addExtraButton(button => {
				button
					.setTooltip("Show API Key")
					.onClick(() => {
						if (apiKeyInputEl.type === "password") {
							apiKeyInputEl.type = "text";
							setIcon(button.extraSettingsEl, "eye-off");
                            setTooltip(button.extraSettingsEl, "Hide API Key");
						} else {
							apiKeyInputEl.type = "password";
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
				text.setPlaceholder(`Examples:\n\n${Path.UserInstruction}\n${Path.Conversations}/*.json\nPrivateNotes/**`)
					.setValue(this.plugin.settings.exclusions.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.exclusions = value.split("\n").map(line => line.trim()).filter(line => line.length > 0);
						await this.plugin.saveSettings();
					});
				text.inputEl.classList.add(Selector.AIExclusionsInput);
			});
	}

	private highlightApiKey(): void {
		if (this.apiKeySetting) {
            if (this.plugin.settings.apiKey.trim() === "") {
                this.apiKeySetting.settingEl.removeClass(Selector.ApiKeySettingOk);
                this.apiKeySetting.settingEl.addClass(Selector.ApiKeySettingError);
            } else {
                this.apiKeySetting.settingEl.removeClass(Selector.ApiKeySettingError);
                this.apiKeySetting.settingEl.addClass(Selector.ApiKeySettingOk);
            }
		}
	}
}
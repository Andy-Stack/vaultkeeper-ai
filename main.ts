import { App, Editor, MarkdownView, WorkspaceLeaf, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Resolve } from './Services/DependencyService';
import { AIProvider } from './Enums/ApiProvider';

import { MainView, VIEW_TYPE_MAIN } from 'Views/MainView';
import { Services } from 'Services/Services';
import { OdbCache } from 'ODB/Core/OdbCache';
import { FileAction } from 'Enums/FileAction';
import { Path } from 'Enums/Path';
import { RegisterAiProvider, RegisterDependencies } from 'Services/ServiceRegistration';

interface AIAgentSettings {
	apiProvider: string;
	apiKey: string;
}

const DEFAULT_SETTINGS: AIAgentSettings = {
	apiProvider: AIProvider.Gemini,
	apiKey: ""
}

export default class AIAgentPlugin extends Plugin {
	settings: AIAgentSettings;

	async onload() {
		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js';
		script.async = true;
		document.head.appendChild(script);

		await this.loadSettings();

		RegisterDependencies(this);

		CreateDirectories(this);

		this.registerView(
			VIEW_TYPE_MAIN,
			(leaf) => new MainView(leaf)
		);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
			this.activateView();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIAgentSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		let odbCache: OdbCache = Resolve<OdbCache>(Services.OdbCache)

		await odbCache.buildCache();

		this.registerEvent(
			this.app.vault.on(FileAction.Create, (file) => odbCache.onFileChanged(file, FileAction.Create))
		);
		this.registerEvent(
			this.app.vault.on(FileAction.Modify, (file) => odbCache.onFileChanged(file, FileAction.Modify))
		);
		this.registerEvent(
			this.app.vault.on(FileAction.Delete, (file) => odbCache.onFileChanged(file, FileAction.Delete))
		);
		this.registerEvent(
			this.app.vault.on(FileAction.Rename, (file) => odbCache.onFileChanged(file, FileAction.Rename))
		);
	}

	async onunload() {
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_MAIN);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_MAIN, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf != null) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		RegisterAiProvider(this);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class AIAgentSettingTab extends PluginSettingTab {
	plugin: AIAgentPlugin;

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
					.addOption("1", AIProvider.Gemini)
					.addOption("2", AIProvider.OpenAI)
					.setValue(this.plugin.settings.apiProvider)
					.onChange(async (value) => {
						this.plugin.settings.apiProvider = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Enter your API key here.")
			.addText(text => text
				.setPlaceholder("Enter your API key")
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}

function CreateDirectories(plugin: AIAgentPlugin) {
	this.app.workspace.onLayoutReady(async () => {
		const vault = plugin.app.vault;
		if (vault.getAbstractFileByPath(Path.Root) == null) {
			vault.createFolder(Path.Root);
		}
		if (vault.getAbstractFileByPath(Path.Schemas) == null) {
			vault.createFolder(Path.Schemas);
		}
		if (vault.getAbstractFileByPath(Path.Records) == null) {
			vault.createFolder(Path.Records);
		}
	});
}


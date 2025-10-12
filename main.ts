import { WorkspaceLeaf, Plugin } from 'obsidian';
import { AIProvider } from './Enums/ApiProvider';

import { MainView, VIEW_TYPE_MAIN } from 'Views/MainView';
import { RegisterAiProvider, RegisterDependencies } from 'Services/ServiceRegistration';
import { AIAgentSettingTab } from 'AIAgentSettingTab';

interface AIAgentSettings {
	apiProvider: string;
	apiKey: string;
	exclusions: string[];
}

const DEFAULT_SETTINGS: AIAgentSettings = {
	apiProvider: AIProvider.Gemini,
	apiKey: "",
	exclusions: []
}

export default class AIAgentPlugin extends Plugin {
	settings: AIAgentSettings;

	async onload() {
		// KaTeX CSS is bundled with the plugin to comply with CSP
		require('katex/dist/katex.min.css');

		await this.loadSettings();

		RegisterDependencies(this);

		this.registerView(
			VIEW_TYPE_MAIN,
			(leaf) => new MainView(leaf)
		);

		this.addCommand({
			id: 'ai-agent',
			name: 'AI Agent',
			callback: () => {
				this.activateView();
			}
		});

		this.addRibbonIcon('sparkles', 'AI Agent', (evt: MouseEvent) => {
			this.activateView();
		});

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addSettingTab(new AIAgentSettingTab(this.app, this));
	}

	async onunload() {
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_MAIN);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_MAIN, active: true });
		}

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
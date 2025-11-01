import { WorkspaceLeaf, Plugin } from 'obsidian';
import { AIProviderModel } from './Enums/ApiProvider';
import { MainView, VIEW_TYPE_MAIN } from 'Views/MainView';
import { RegisterAiProvider, RegisterDependencies } from 'Services/ServiceRegistration';
import { AIAgentSettingTab } from 'AIAgentSettingTab';
import { Services } from 'Services/Services';
import type { StatusBarService } from 'Services/StatusBarService';
import { DeregisterAllServices, Resolve } from 'Services/DependencyService';

interface IAIAgentSettings {
	model: string;
	apiKey: string;
	exclusions: string[];
}

const DEFAULT_SETTINGS: IAIAgentSettings = {
	model: AIProviderModel.ClaudeSonnet_4_5,
	apiKey: "",
	exclusions: []
}

export default class AIAgentPlugin extends Plugin {
	public settings: IAIAgentSettings;
	
	public async onload() {
		// KaTeX CSS is bundled with the plugin to comply with CSP
		require('katex/dist/katex.min.css');
		// Plugin styles
		require('./styles.css');

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

		this.addRibbonIcon('sparkles', 'AI Agent', (_: MouseEvent) => {
			this.activateView();
		});

		this.addSettingTab(new AIAgentSettingTab(this.app, this));
	}

	public async onunload() {
		Resolve<StatusBarService>(Services.StatusBarService).removeStatusBarMessage();
		DeregisterAllServices();
	}

	public async activateView() {
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

	public async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		RegisterAiProvider(this);
	}
}
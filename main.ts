import { WorkspaceLeaf, Plugin } from 'obsidian';
import { AIProvider, AIProviderModel } from './Enums/ApiProvider';
import { MainView, VIEW_TYPE_MAIN } from 'Views/MainView';
import { RegisterAiProvider, RegisterDependencies, RegisterPlugin } from 'Services/ServiceRegistration';
import { AIAgentSettingTab } from 'AIAgentSettingTab';
import { Services } from 'Services/Services';
import type { StatusBarService } from 'Services/StatusBarService';
import { DeregisterAllServices, Resolve } from 'Services/DependencyService';
import type { VaultService } from 'Services/VaultService';
import { Path } from 'Enums/Path';
import { Copy } from 'Enums/Copy';
import type { SettingsService } from 'Services/SettingsService';

export default class AIAgentPlugin extends Plugin {
	
	public async onload() {
		// KaTeX CSS is bundled with the plugin to comply with CSP
		require('katex/dist/katex.min.css');
		// Plugin styles
		require('./styles.css');

		await RegisterPlugin(this);
		RegisterDependencies();

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

		this.addSettingTab(new AIAgentSettingTab());

		this.app.workspace.onLayoutReady(async () => {
			await this.setup(this);
		});
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

	// create example user instruction (on first launch only)
	private async setup(plugin: AIAgentPlugin) {
		const settingsService = Resolve<SettingsService>(Services.SettingsService);
		if (!settingsService.settings.firstTimeStart) {
			return;
		}
		settingsService.settings.firstTimeStart = false;
		await settingsService.saveSettings();

		const vaultService: VaultService = Resolve<VaultService>(Services.VaultService);

		await vaultService.create(Path.ExampleUserInstructions, Copy.EXAMPLE_USER_INSTRUCTION, true);
	}
}
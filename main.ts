import { WorkspaceLeaf, Plugin } from "obsidian";
import { MainView, VIEW_TYPE_MAIN } from "Views/MainView";
import { RegisterDependencies, RegisterPlugin } from "Services/ServiceRegistration";
import { VaultkeeperAISettingTab } from "VaultkeeperAISettingTab";
import { Services } from "Services/Services";
import type { StatusBarService } from "Services/StatusBarService";
import { DeregisterAllServices, Resolve } from "Services/DependencyService";
import type { VaultService } from "Services/VaultService";
import { Path } from "Enums/Path";
import { Copy } from "Enums/Copy";
import type { SettingsService } from "Services/SettingsService";

import "katex/dist/katex.min.css";
import "./styles.css";

export default class VaultkeeperAIPlugin extends Plugin {
	
	public async onload() {
		await RegisterPlugin(this);
		RegisterDependencies();

		this.registerView(
			VIEW_TYPE_MAIN,
			(leaf) => new MainView(leaf)
		);

		this.addCommand({
			id: "open",
			name: "Open",
			callback: async () => {
				await this.activateView();
			}
		});

		this.addRibbonIcon("sparkles", "Vaultkeeper AI", async () => {
			await this.activateView();
		});

		this.addSettingTab(new VaultkeeperAISettingTab());

		this.app.workspace.onLayoutReady(async () => {
			await this.setup();
		});
	}

	public onunload() {
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
			await workspace.revealLeaf(leaf);
		}
	}

	// create example user instruction (on first launch only)
	private async setup() {
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
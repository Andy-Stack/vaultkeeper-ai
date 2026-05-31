import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { addIcon } from "obsidian";

export class AssetsService {

    private readonly plugin: VaultkeeperAIPlugin;

    public pluginIcon: string = "";
    public bannerSource: string = "";

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    }

    public async loadAssets(): Promise<void> {
        this.pluginIcon = this.addIcon(
            await this.plugin.app.vault.adapter.read(`${this.plugin.manifest.dir}/Assets/vaultkeeper-mono.svg`),
            "vaultkeeper-ai-icon"
        );

        this.bannerSource = this.plugin.app.vault.adapter.getResourcePath(
            `${this.plugin.manifest.dir}/Assets/vaultkeeper-social-1280x330.png`
        );
    }

    private addIcon(icon: string, name: string): string {
        addIcon(name, icon);
        return name;
    }

}
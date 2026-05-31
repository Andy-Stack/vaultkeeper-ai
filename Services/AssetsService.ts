import { addIcon } from "obsidian";
import iconSvg from "../Assets/vaultkeeper-mono.svg";
import bannerSource from "../Assets/vaultkeeper-social-1280x330.png";

export class AssetsService {

    public pluginIcon: string;
    public bannerSource: string;

    // Assets are bundled into main.js at build time (see esbuild loader config).
    // They must NOT be read from disk at runtime: released/mobile installs ship
    // only main.js, manifest.json and styles.css, so the Assets/ folder is absent.
    public constructor() {
        this.pluginIcon = this.addIcon(iconSvg, "vaultkeeper-ai-icon");
        this.bannerSource = bannerSource;
    }
    
    private addIcon(icon: string, name: string): string {
        addIcon(name, icon);
        return name;
    }

}
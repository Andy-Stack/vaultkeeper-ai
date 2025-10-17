import type AIAgentPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { Selector } from "Enums/Selector";

export class StatusBarService {

    private readonly plugin: AIAgentPlugin;
    private statusBarItem: HTMLElement | null;

    public constructor() {
        this.plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
    }

    public setStatusBarMessage(message: string) {
        if (this.statusBarItem == null) {
            this.createStatusBarMessage();
        }

        this.statusBarItem?.empty();
        this.statusBarItem?.createEl("span", { text: message });
    }

    public removeStatusBarMessage() {
        this.statusBarItem?.remove();
        this.statusBarItem = null;
    }

    private createStatusBarMessage() {
        this.statusBarItem?.remove();
        this.statusBarItem = this.plugin.addStatusBarItem();
        this.statusBarItem.empty();
    }
}
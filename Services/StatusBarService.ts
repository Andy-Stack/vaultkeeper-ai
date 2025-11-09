import type VaultAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { Selector } from "Enums/Selector";

export class StatusBarService {

    private readonly plugin: VaultAIPlugin;
    private statusBarItem: HTMLElement | null;
    private currentInputTokens: number = 0;
    private currentOutputTokens: number = 0;
    private animationFrame: number | null = null;

    public constructor() {
        this.plugin = Resolve<VaultAIPlugin>(Services.VaultAIPlugin);
    }

    public setStatusBarMessage(message: string) {
        if (this.statusBarItem == null) {
            this.createStatusBarMessage();
        }

        this.statusBarItem?.empty();
        this.statusBarItem?.createEl("span", { text: message });
    }

    public animateTokens(targetInputTokens: number, targetOutputTokens: number) {
        // Cancel any ongoing animation
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
        }

        const startInputTokens = this.currentInputTokens;
        const startOutputTokens = this.currentOutputTokens;
        const startTime = performance.now();
        const duration = 1000;

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 3);

            // Calculate current values
            this.currentInputTokens = Math.round(
                startInputTokens + (targetInputTokens - startInputTokens) * eased
            );
            this.currentOutputTokens = Math.round(
                startOutputTokens + (targetOutputTokens - startOutputTokens) * eased
            );

            this.setStatusBarMessage(
                `Input Tokens: ${this.currentInputTokens} / Output Tokens: ${this.currentOutputTokens}`
            );

            // Continue animation if not complete
            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                this.animationFrame = null;
            }
        };

        this.animationFrame = requestAnimationFrame(animate);
    }

    public removeStatusBarMessage() {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.statusBarItem?.remove();
        this.statusBarItem = null;
    }

    private createStatusBarMessage() {
        this.statusBarItem?.remove();
        this.statusBarItem = this.plugin.addStatusBarItem();
        this.statusBarItem.empty();
    }
}
import type VaultAIPlugin from "main";
import { Modal } from "obsidian";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import HelpModalSvelte from './HelpModalSvelte.svelte';
import { mount, unmount } from 'svelte';
import { Selector } from 'Enums/Selector';

export class HelpModal extends Modal {

    private component: Record<string, any> | null = null;

    public constructor() {
        const plugin = Resolve<VaultAIPlugin>(Services.VaultAIPlugin);
        super(plugin.app);
    }

    onOpen() {
        const { contentEl, modalEl, containerEl } = this;

        containerEl.addClass(Selector.HelpModal);
        modalEl.addClass(Selector.HelpModal);

        this.component = mount(HelpModalSvelte, {
            target: contentEl,
            props: {
                onClose: () => this.close(),
                initialTopic: (this as any).initialTopic
            }
        });
    }

    public open(initialTopic?: number): void {
        (this as any).initialTopic = initialTopic;
        super.open();
    }

    onClose() {
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }

        const { contentEl } = this;
        contentEl.empty();
    }
}
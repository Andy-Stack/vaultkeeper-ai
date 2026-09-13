import type VaultkeeperAIPlugin from "main";
import { Modal } from "obsidian";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import AboutModalSvelte from './AboutModalSvelte.svelte';
import { mount, unmount } from 'svelte';
import { Selector } from 'Enums/Selector';
import type { AboutModalTopic } from 'Enums/AboutModalTopic';

export class AboutModal extends Modal {

    private component: ReturnType<typeof mount> | null = null;
    private initialTopic?: AboutModalTopic;

    public constructor() {
        const plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        super(plugin.app);
    }

    onOpen() {
        const { contentEl, modalEl, containerEl } = this;

        containerEl.addClass(Selector.AboutModal);
        modalEl.addClass(Selector.AboutModal);
        modalEl.addClass(Selector.PluginModal);

        this.component = mount(AboutModalSvelte, {
            target: contentEl,
            props: {
                onClose: () => this.close(),
                initialTopic: this.initialTopic
            }
        });
    }

    public open(initialTopic?: AboutModalTopic) {
        this.initialTopic = initialTopic;
        super.open();
    }

    onClose() {
        if (this.component) {
            void unmount(this.component);
            this.component = null;
        }

        const { contentEl } = this;
        contentEl.empty();
    }
}
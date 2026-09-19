import type VaultkeeperAIPlugin from "main";
import { Modal } from "obsidian";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import { mount, unmount } from 'svelte';
import VaultContinuityModalSvelte from "./VaultContinuityModalSvelte.svelte";
import type { IDocumentReport } from "../DocumentValidation/IDocumentReport";

export class VaultContinuityModal extends Modal {

    private component: ReturnType<typeof mount> | null = null;
    private readonly report: IDocumentReport;

    public constructor(report: IDocumentReport) {
        const plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        super(plugin.app);
        this.report = report;
    }

    onOpen() {
        const { contentEl, modalEl, containerEl } = this;

        this.component = mount(VaultContinuityModalSvelte, {
            target: contentEl,
            props: {
                report: this.report,
                onClose: () => this.close()
            }
        });
    }

    public open() {
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
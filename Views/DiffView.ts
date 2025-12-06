import { Diff2HtmlUI, type Diff2HtmlUIConfig } from "diff2html/lib/ui/js/diff2html-ui";
import { Event } from "Enums/Event";
import { ItemView, WorkspaceLeaf, Platform, type ViewStateResult } from "obsidian";
import { Resolve } from "Services/DependencyService";
import type { EventService } from "Services/EventService";
import type { DiffService } from "Services/DiffService";
import { Services } from "Services/Services";
import { VIEW_TYPE_MAIN } from "./MainView";

export const VIEW_TYPE_DIFF = 'vaultkeeper-ai-diff-view';

interface DiffViewState {
    diffString: string;
    config: Diff2HtmlUIConfig;
}

export class DiffView extends ItemView {

    private readonly eventService: EventService;
    private readonly diffService: DiffService;

    private diffString: string = "";
    private config: Diff2HtmlUIConfig = {};

    private diffContainer: HTMLElement | null = null;
    private mobileButtonsContainer: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);

        this.eventService = Resolve<EventService>(Services.EventService);
        this.diffService = Resolve<DiffService>(Services.DiffService);

        this.registerEvent(this.eventService.on(Event.DiffClosed, () => {
            this.leaf.detach();
        }));
    }

    protected override onClose(): Promise<void> {
        // trigger DiffClosed event in case the user closed the tab
        this.eventService.trigger(Event.DiffClosed);
        return Promise.resolve();
    }

    public getViewType(): string {
        return VIEW_TYPE_DIFF;
    }
    
    public getDisplayText(): string {
        return "Vaultkeeper AI diff";
    }

    public async setState(state: DiffViewState, result: ViewStateResult): Promise<void> {
        this.diffString = state.diffString;
        this.config = state.config;

        this.renderDiff();

        return super.setState(state, result);
    }

    public getState(): Record<string, unknown> {
        return {
            diffString: this.diffString,
            config: this.config
        };
    }

    private renderDiff() {
        const container = this.resetContainer();

        if (Platform.isMobile) {
            container.addClass('diff-view-mobile');
        }

        this.diffContainer = container.createDiv({ cls: 'd2h-wrapper' });
        const diff2htmlUi = new Diff2HtmlUI(this.diffContainer, this.diffString, this.config);

        diff2htmlUi.draw();
        diff2htmlUi.highlightCode();

        if (Platform.isMobile) {
            this.mobileButtonsContainer = this.createMobileButtons();
        }

        requestAnimationFrame(() => {
            const firstChange = this.diffContainer?.querySelector('.d2h-change, .d2h-ins, .d2h-del');
            firstChange?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    private resetContainer(): HTMLElement {
        const container = this.contentEl;
        container.empty();

        if (this.diffContainer) {
            this.diffContainer.remove();
            this.diffContainer = null;
        }

        if (this.mobileButtonsContainer) {
            this.mobileButtonsContainer.remove();
            this.mobileButtonsContainer = null;
        }

        return container;
    }

    private createMobileButtons(): HTMLElement {
        const container = this.contentEl.createDiv({ cls: 'diff-mobile-controls' });

        const acceptButton = container.createEl('button', {
            cls: 'diff-mobile-button diff-mobile-accept',
            text: 'Accept'
        });
        acceptButton.setAttribute('aria-label', 'Accept changes');

        const rejectButton = container.createEl('button', {
            cls: 'diff-mobile-button diff-mobile-reject',
            text: 'Reject'
        });
        rejectButton.setAttribute('aria-label', 'Reject changes');

        this.registerDomEvent(acceptButton, 'click', async () => {
            this.diffService.onAccept();
            await this.refocusMainView();
        });

        this.registerDomEvent(rejectButton, 'click', async () => {
            this.diffService.onReject();
            await this.refocusMainView();
        });

        return container;
    }

    private async refocusMainView(): Promise<void> {
        const { workspace } = this.app;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_MAIN);

        if (leaves.length > 0) {
            await workspace.revealLeaf(leaves[0]);
        }
    }

}
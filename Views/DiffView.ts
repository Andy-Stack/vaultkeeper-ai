import { Diff2HtmlUI, type Diff2HtmlUIConfig } from "diff2html/lib/ui/js/diff2html-ui";
import { Event } from "Enums/Event";
import { ItemView, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { Resolve } from "Services/DependencyService";
import type { EventService } from "Services/EventService";
import { Services } from "Services/Services";

export const VIEW_TYPE_DIFF = 'vaultkeeper-ai-diff-view';

interface DiffViewState {
    diffString: string;
    config: Diff2HtmlUIConfig;
}

export class DiffView extends ItemView {

    private readonly eventService: EventService;

    private diffString: string = "";
    private config: Diff2HtmlUIConfig = {};

    private diffContainer: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);

        this.eventService = Resolve<EventService>(Services.EventService);

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

        this.diffContainer = container.createDiv({ cls: 'd2h-wrapper' });
        const diff2htmlUi = new Diff2HtmlUI(this.diffContainer, this.diffString, this.config);

        diff2htmlUi.draw();
    }

    private resetContainer(): HTMLElement {
        const container = this.contentEl;
        container.empty();

        if (this.diffContainer) {
            this.diffContainer.remove();
            this.diffContainer = null
        }
        return container;
    }

}
import type { Diff2HtmlUIConfig } from "diff2html/lib/ui/js/diff2html-ui-base";
import { Event } from "Enums/Event";
import { ItemView, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { mount, unmount } from "svelte";
import { Resolve } from "Services/DependencyService";
import type { EventService } from "Services/EventService";
import { Services } from "Services/Services";
import DiffWindow from "Components/DiffWindow.svelte";

export const VIEW_TYPE_DIFF = 'vaultkeeper-ai-diff-view';

interface DiffViewState {
    config: Diff2HtmlUIConfig;
}

export class DiffView extends ItemView {

    private readonly eventService: EventService;

    private config: Diff2HtmlUIConfig = {};
    private diffWindow: ReturnType<typeof DiffWindow> | undefined;

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
        this.unmountDiffWindow();
        return Promise.resolve();
    }

    public getViewType(): string {
        return VIEW_TYPE_DIFF;
    }

    public getDisplayText(): string {
        return "Vaultkeeper AI diff viewer";
    }

    public async setState(state: DiffViewState, result: ViewStateResult): Promise<void> {
        this.config = state.config;

        this.renderDiff();

        return super.setState(state, result);
    }

    public getState(): Record<string, unknown> {
        return {
            config: this.config
        };
    }

    private renderDiff() {
        this.unmountDiffWindow();

        const container = this.contentEl;
        container.empty();
        container.addClass('diff-view-content');

        this.diffWindow = mount(DiffWindow, {
            target: container,
            props: {
                config: this.config
            }
        });
    }

    private unmountDiffWindow() {
        if (this.diffWindow) {
            void unmount(this.diffWindow);
            this.diffWindow = undefined;
        }
    }

}

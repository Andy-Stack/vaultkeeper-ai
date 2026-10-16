import { Event } from "Enums/Event";
import { ItemView, WorkspaceLeaf, Platform, type ViewStateResult } from "obsidian";
import { mount, unmount } from "svelte";
import { Resolve } from "Services/DependencyService";
import type { EventService } from "Services/EventService";
import { Services } from "Services/Services";
import PlanApprovalWindow from "Components/PlanApprovalWindow.svelte";
import type { ExecutionPlan } from "Types/ExecutionPlan";

export const VIEW_TYPE_PLAN_APPROVAL = 'vaultkeeper-ai-plan-approval-view';

interface PlanApprovalViewState {
    plan: ExecutionPlan;
}

export class PlanApprovalView extends ItemView {

    private readonly eventService: EventService;

    private plan: ExecutionPlan | undefined;

    private planWindow: ReturnType<typeof PlanApprovalWindow> | undefined;
    private planContainer: HTMLElement | null = null;
    private mobileControlsContainer: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);

        this.eventService = Resolve<EventService>(Services.EventService);

        this.registerEvent(this.eventService.on(Event.PlanApprovalClosed, () => {
            this.leaf.detach();
        }));
    }

    protected override onClose(): Promise<void> {
        // trigger PlanApprovalClosed event in case the user closed the tab
        this.eventService.trigger(Event.PlanApprovalClosed);

        if (this.planWindow) {
            void unmount(this.planWindow);
            this.planWindow = undefined;
        }

        return Promise.resolve();
    }

    public getViewType(): string {
        return VIEW_TYPE_PLAN_APPROVAL;
    }

    public getDisplayText(): string {
        return "Vaultkeeper AI plan";
    }

    public async setState(state: PlanApprovalViewState, result: ViewStateResult): Promise<void> {
        this.plan = state.plan;

        this.renderPlan();

        return super.setState(state, result);
    }

    public getState(): Record<string, unknown> {
        return {
            plan: this.plan
        };
    }

    private renderPlan() {
        const container = this.resetContainer();

        if (!this.plan) {
            return;
        }

        if (Platform.isMobile) {
            container.addClass('plan-approval-view-mobile');
        }

        this.planContainer = container.createDiv({ cls: 'plan-approval-wrapper' });

        this.planWindow = mount(PlanApprovalWindow, {
            target: this.planContainer,
            props: {
                plan: this.plan
            }
        });
    }

    private resetContainer(): HTMLElement {
        const container = this.contentEl;
        container.empty();

        if (this.planWindow) {
            void unmount(this.planWindow);
            this.planWindow = undefined;
        }

        if (this.planContainer) {
            this.planContainer.remove();
            this.planContainer = null;
        }

        if (this.mobileControlsContainer) {
            this.mobileControlsContainer.remove();
            this.mobileControlsContainer = null;
        }

        return container;
    }

}

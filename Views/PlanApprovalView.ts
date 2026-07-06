import { Event } from "Enums/Event";
import { Copy } from "Enums/Copy";
import { ItemView, WorkspaceLeaf, Platform, type ViewStateResult } from "obsidian";
import { mount, unmount } from "svelte";
import { Resolve } from "Services/DependencyService";
import type { EventService } from "Services/EventService";
import type { PlanApprovalService } from "Services/PlanApprovalService";
import { Services } from "Services/Services";
import { VIEW_TYPE_MAIN, type MainView } from "./MainView";
import PlanApprovalWindow from "Components/PlanApprovalWindow.svelte";
import type { ExecutionPlan } from "Types/ExecutionPlan";
import { tick } from "svelte";

export const VIEW_TYPE_PLAN_APPROVAL = 'vaultkeeper-ai-plan-approval-view';

interface PlanApprovalViewState {
    plan: ExecutionPlan;
}

export class PlanApprovalView extends ItemView {

    private readonly eventService: EventService;
    private readonly planApprovalService: PlanApprovalService;

    private plan: ExecutionPlan | undefined;

    private planWindow: ReturnType<typeof PlanApprovalWindow> | undefined;
    private planContainer: HTMLElement | null = null;
    private mobileControlsContainer: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);

        this.eventService = Resolve<EventService>(Services.EventService);
        this.planApprovalService = Resolve<PlanApprovalService>(Services.PlanApprovalService);

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
        return Copy.PlanApprovalViewTitle;
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

        if (Platform.isMobile) {
            this.mobileControlsContainer = this.createMobileButtons();
        }
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

    private createMobileButtons(): HTMLElement {
        const container = this.contentEl.createDiv({ cls: 'plan-approval-mobile-controls' });

        const approveButton = container.createEl('button', {
            cls: 'plan-approval-mobile-button plan-approval-mobile-approve',
            text: Copy.ButtonApprove
        });
        approveButton.setAttribute('aria-label', Copy.ButtonApprove);

        const suggestButton = container.createEl('button', {
            cls: 'plan-approval-mobile-button plan-approval-mobile-suggest',
            text: Copy.ButtonSuggest
        });
        suggestButton.setAttribute('aria-label', Copy.ButtonSuggest);

        const rejectButton = container.createEl('button', {
            cls: 'plan-approval-mobile-button plan-approval-mobile-reject',
            text: Copy.ButtonReject
        });
        rejectButton.setAttribute('aria-label', Copy.ButtonReject);

        this.registerDomEvent(approveButton, 'click', async () => {
            this.planApprovalService.onApprove();
            await this.refocusMainView();
        });

        this.registerDomEvent(suggestButton, 'click', async () => {
            await this.refocusMainView(true);
        });

        this.registerDomEvent(rejectButton, 'click', async () => {
            this.planApprovalService.onReject();
            await this.refocusMainView();
        });

        return container;
    }

    private async refocusMainView(focusChatInput: boolean = false): Promise<void> {
        await tick().then(async () => {
            const { workspace } = this.app;
            const leaves = workspace.getLeavesOfType(VIEW_TYPE_MAIN);

            if (leaves.length > 0) {
                await workspace.revealLeaf(leaves[0]);
                workspace.setActiveLeaf(leaves[0], { focus: true });

                if (focusChatInput) {
                    (leaves[0].view as MainView).input?.focusInput(true);
                }
            }
        });
    }

}

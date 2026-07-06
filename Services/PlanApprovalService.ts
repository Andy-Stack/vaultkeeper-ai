import type VaultkeeperAIPlugin from 'main';
import { Resolve } from './DependencyService';
import { Services } from './Services';
import type { EventService } from './EventService';
import { Event } from 'Enums/Event';
import { Component } from 'obsidian';
import { AbortService } from './AbortService';
import type { ExecutionPlan } from 'Types/ExecutionPlan';
import { PlanApprovalResponse } from 'Types/PlanApprovalResponse';

export class PlanApprovalService extends Component {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly eventService: EventService;
    private readonly abortService: AbortService;

    private planResolve?: (response: PlanApprovalResponse) => void;

    private ongoingApproval: boolean = false;

    public constructor() {
        super();
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.eventService = Resolve<EventService>(Services.EventService);
        this.abortService = Resolve<AbortService>(Services.AbortService);

        this.registerEvent(this.eventService.on(Event.PlanApprovalClosed, () => {
            this.cancelPendingApproval();
        }));
    }

    public async requestApproval(plan: ExecutionPlan): Promise<PlanApprovalResponse> {
        this.ongoingApproval = true;

        const signal = this.abortService.signal();
        return new Promise<PlanApprovalResponse>((resolve, reject) => {
            if (signal.aborted) {
                this.finishApproval();
                reject(this.abortService.reason());
                return;
            }

            const abortHandler = () => {
                this.finishApproval();
                reject(this.abortService.reason());
            };
            signal.addEventListener("abort", abortHandler, { once: true });

            this.planResolve = (response: PlanApprovalResponse) => {
                signal.removeEventListener("abort", abortHandler);
                resolve(response);
            };

            void this.plugin.activatePlanApprovalView(plan);
            this.eventService.trigger(Event.PlanApprovalOpened);
        });
    }

    public onApprove() {
        if (this.planResolve) {
            this.planResolve(new PlanApprovalResponse(true));
        }
        this.finishApproval();
    }

    public onReject() {
        if (this.planResolve) {
            this.planResolve(new PlanApprovalResponse(false));
        }
        this.finishApproval();
    }

    public onSuggest(suggestion: string) {
        if (this.planResolve) {
            this.planResolve(new PlanApprovalResponse(false, suggestion));
        }
        this.finishApproval();
    }

    private cancelPendingApproval() {
        if (this.ongoingApproval) {
            if (this.planResolve) {
                this.planResolve(new PlanApprovalResponse(false));
            }
            this.finishApproval();
        }
    }

    private finishApproval() {
        this.ongoingApproval = false;
        this.planResolve = undefined;
        this.eventService.trigger(Event.PlanApprovalClosed);
    }

}

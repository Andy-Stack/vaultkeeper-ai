import type { ExecutionPlan } from 'Types/ExecutionPlan';
import { writable, get } from 'svelte/store';

export interface IExecutionPlanState {
    plan: ExecutionPlan | null
}

export class ExecutionPlanStore {
    public executionPlanState = writable<IExecutionPlanState>({
        plan: null
    });

    public setPlan(plan: ExecutionPlan | null) {
        this.executionPlanState.set({ plan });
    }

    public updatePlan() {
        this.executionPlanState.update(state => ({ ...state }));
    }

    public clearPlan() {
        this.executionPlanState.set({ plan: null });
    }

    public getCurrentPlan(): ExecutionPlan | null {
        return get(this.executionPlanState).plan;
    }
}

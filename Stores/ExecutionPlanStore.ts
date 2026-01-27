import type { ExecutionPlan } from 'Types/ExecutionPlan';
import { writable, get } from 'svelte/store';

export interface IExecutionPlanState {
    plan: ExecutionPlan | null;
    currentStepIndex: number;  // -1 = no active step, 0+ = currently executing step index
}

export class ExecutionPlanStore {
    public executionPlanState = writable<IExecutionPlanState>({
        plan: null,
        currentStepIndex: -1
    });

    public setPlan(plan: ExecutionPlan | null) {
        this.executionPlanState.set({ plan, currentStepIndex: plan ? 0 : -1 });
    }

    public updatePlan() {
        this.executionPlanState.update(state => ({ ...state }));
    }

    public setCurrentStepIndex(index: number) {
        this.executionPlanState.update(state => ({ ...state, currentStepIndex: index }));
    }

    public clearPlan() {
        this.executionPlanState.set({ plan: null, currentStepIndex: -1 });
    }

    public getCurrentPlan(): ExecutionPlan | null {
        return get(this.executionPlanState).plan;
    }

    public getCurrentStepIndex(): number {
        return get(this.executionPlanState).currentStepIndex;
    }
}

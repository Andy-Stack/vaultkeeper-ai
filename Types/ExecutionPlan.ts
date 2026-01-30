import type { ExecutionStep } from "./ExecutionStep";
import type { SubmitPlanArgs } from "AIClasses/Schemas/AIToolSchemas";

export class ExecutionPlan {

    public readonly isReplan: boolean;
    public readonly executionSteps: ExecutionStep[];

    public constructor(plan: SubmitPlanArgs, isReplan: boolean) {
        this.executionSteps = plan.steps;
        this.isReplan = isReplan;
    }

}
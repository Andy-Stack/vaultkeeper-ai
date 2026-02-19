import type { ExecutionStep } from "./ExecutionStep";
import type { SubmitPlanArgs } from "AIClasses/Schemas/AIToolSchemas";

export class ExecutionPlan {

    public readonly executionSteps: ExecutionStep[];

    public constructor(plan: SubmitPlanArgs) {
        this.executionSteps = plan.steps;
    }

}
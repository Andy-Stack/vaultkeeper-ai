import type { ExecutionStep } from "./ExecutionStep";

type OrchestrationResultInit = {
    continue?: boolean;
    continueContext?: string;
    abort?: boolean;
    abortContext?: string;
    complete?: boolean;
    skipStep?: boolean;
    skipReason?: string;
    reviseStep?: boolean;
    revisedDescription?: string;
    revisedInstruction?: string;
    revisedContext?: string;
    revisePlan?: boolean;
    revisedSteps?: ExecutionStep[];
};

export class OrchestrationResult {

    public continue: boolean;
    public continueContext: string;
    public abort: boolean;
    public abortContext: string;
    public complete: boolean;
    public skipStep: boolean;
    public skipReason: string;
    public reviseStep: boolean;
    public revisedDescription: string | undefined;
    public revisedInstruction: string | undefined;
    public revisedContext: string | undefined;
    public revisePlan: boolean;
    public revisedSteps: ExecutionStep[];

    constructor(init: OrchestrationResultInit) {
        this.continue = init.continue ?? false;
        this.continueContext = init.continueContext ?? "";
        this.abort = init.abort ?? false;
        this.abortContext = init.abortContext ?? "";
        this.complete = init.complete ?? false;
        this.skipStep = init.skipStep ?? false;
        this.skipReason = init.skipReason ?? "";
        this.reviseStep = init.reviseStep ?? false;
        this.revisedInstruction = init.revisedInstruction;
        this.revisedContext = init.revisedContext;
        this.revisePlan = init.revisePlan ?? false;
        this.revisedSteps = init.revisedSteps ?? [];
    }

}

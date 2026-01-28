type OrchestrationResultInit = {
    continue?: boolean;
    continueContext?: string;
    abort?: boolean;
    abortContext?: string;
    replan?: boolean;
    replanContext?: string;
};

export class OrchestrationResult {

    public continue: boolean;
    public continueContext: string;
    public abort: boolean;
    public abortContext: string;
    public replan: boolean;
    public replanContext: string;

    constructor(init: OrchestrationResultInit) {
        this.continue = init.continue ?? false;
        this.continueContext = init.continueContext ?? "";
        this.abort = init.abort ?? false;
        this.abortContext = init.abortContext ?? "";
        this.replan = init.replan ?? false;
        this.replanContext = init.replanContext ?? "";
    }

}
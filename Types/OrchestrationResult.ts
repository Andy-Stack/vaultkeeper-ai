type OrchestrationResultInit = {
    continue?: boolean;
    abort?: boolean;
    abortContext?: string;
    replan?: boolean;
    replanContext?: string;
};

export class OrchestrationResult {

    public continue: boolean;
    public abort: boolean;
    public abortContext: string;
    public replan: boolean;
    public replanContext: string;

    constructor(init: OrchestrationResultInit) {
        this.continue = init.continue ?? false;
        this.abort = init.abort ?? false;
        this.abortContext = init.abortContext ?? "";
        this.replan = init.replan ?? false;
        this.replanContext = init.replanContext ?? "";
    }

}
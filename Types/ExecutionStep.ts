import { ExecutionStatus } from "Enums/ExecutionStatus";

export class ExecutionStep {

    public step: number;
    public status: ExecutionStatus;
    public description: string;
    public instruction: string;
    public context?: string;

    public constructor(step: number, description: string, instruction: string, context?: string) {
        this.step = step;
        this.description = description;
        this.instruction = instruction;
        this.context = context;
        this.status = ExecutionStatus.Pending;
    }

}
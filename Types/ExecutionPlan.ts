import { ExecutionStatus } from "Enums/ExecutionStatus";
import { ExecutionStep } from "./ExecutionStep";
import type { SubmitPlanArgs } from "AIClasses/Schemas/AIFunctionSchemas";
import { Copy, replaceCopy } from "Enums/Copy";

export class ExecutionPlan {

    private executionSteps: ExecutionStep[] = [];

    public constructor(plan: SubmitPlanArgs) {
        for (const [index, step] of plan.steps.entries()) {
            this.executionSteps.push(new ExecutionStep(
                index,
                step.description,
                step.instruction,
                step.context
            ));
        }
        if (this.executionSteps[0]) { // Mark first step as active
            this.executionSteps[0].status = ExecutionStatus.Active;
        }
    }

    public completed(): boolean {
        return this.executionSteps.every(step => step.status === ExecutionStatus.Completed);
    }

    public getStatusSummary(): { completed: string[], remaining: string[] } {
        const completed: string[] = [];
        const remaining: string[] = [];

        for (const step of this.executionSteps) {
            const stepDescription = `${step.step + 1}. ${step.description}`;
            if (step.status === ExecutionStatus.Completed) {
                completed.push(stepDescription);
            } else {
                remaining.push(stepDescription);
            }
        }

        return { completed, remaining };
    }

    public completeExecutionStep(stepNumber: number): object {
        const stepIndex = stepNumber - 1;

        const currentStep = this.executionSteps[stepIndex];
        if (!currentStep) {
            return {
                error: replaceCopy(Copy.StepDoesNotExistError, [
                    stepNumber.toString(),
                    this.executionSteps.length.toString()
                ])
            };
        }

        for (let i = 0; i < stepIndex; i++) { // Ensure all previous steps are completed
            if (this.executionSteps[i].status !== ExecutionStatus.Completed) {
                return {
                    error: replaceCopy(Copy.StepMustBeCompletedInOrderError, [
                        stepNumber.toString(),
                        `${i + 1}. ${this.executionSteps[i].description}`
                    ])
                };
            }
        }

        currentStep.status = ExecutionStatus.Completed;

        const nextStep = this.executionSteps[stepIndex + 1];
        if (nextStep) {
            nextStep.status = ExecutionStatus.Active;
            return {
                message: replaceCopy(Copy.StepCompletedWithNextStep, [
                    stepNumber.toString(),
                    (stepNumber + 1).toString(),
                    nextStep.description
                ])
            };
        } else {
            return {
                message: replaceCopy(Copy.AllStepsCompleted, [
                    stepNumber.toString()
                ])
            };
        }
    }

    public toFunctionResponse(): object {
        if (this.executionSteps.length === 0) {
            return {
                error: Copy.PlanningFailedError
            };
        }

        const firstStep = this.executionSteps[0];

        return {
            plan: this.executionSteps.map((step, index) => `${index + 1}. ${step.description}`),
            firstStep: {
                step: firstStep.step + 1,
                description: firstStep.description,
                instruction: firstStep.instruction,
                ...(firstStep.context && { context: firstStep.context })
            }
        };
    }

}
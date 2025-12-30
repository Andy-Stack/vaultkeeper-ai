import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const CompleteStep: IAIFunctionDefinition = {
  name: AIFunction.CompleteStep,
  description: `Marks a specific step in the current execution plan as completed.

Use this function to track your progress through a plan created by the planning agent.
This helps maintain accurate state of which steps have been executed and provides
visibility to the user about task progress.

Call this function:
- Immediately after successfully completing a plan step
- Before moving on to the next step in the plan
- When a step's objectives have been fully satisfied

Do NOT use this function:
- For steps that failed
- For partial completion of a step`,
  parameters: {
    type: "object",
    properties: {
      step_number: {
        type: "number",
        description: "The number of the step being marked as completed (1-indexed). This should correspond to the step number in the plan."
      }
    },
    required: ["step_number"]
  }
}

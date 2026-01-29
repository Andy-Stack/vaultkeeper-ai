import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const Replan: IAIFunctionDefinition = {
  name: AIFunction.Replan,
  description: `Signals that the current plan needs to be revised before execution can continue.

Call this function:
- When a planned step fails and you need an alternative approach
- When execution reveals the original plan was based on incorrect assumptions
- When the user provides new information mid-execution that changes the plan
- When you've completed part of the plan but the remaining steps are no longer valid

Do NOT use this function:
- When the failure is unrecoverable or the goal is no longer achievable
- When you can continue with the current plan without changes`,
  parameters: {
    type: "object",
    properties: {
      context: {
        type: "string",
        description: "Explain why replanning is needed. Include what went wrong or changed and be specific about the issue encountered.",
      }
    },
    required: ["context"]
  }
}
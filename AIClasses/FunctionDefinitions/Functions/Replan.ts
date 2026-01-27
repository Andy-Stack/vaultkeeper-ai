import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const Replan: IAIFunctionDefinition = {
  name: AIFunction.Replan,
  description: `Signals that the current plan needs to be revised before execution can continue.

- A planned step fails and you need an alternative approach
- Execution reveals the original plan was based on incorrect assumptions
- The user provides new information mid-execution
- You've completed part of the plan but the remaining steps are no longer valid
- Do NOT use this if the failure is unrecoverable or if the goal is no longer achievable.`,
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
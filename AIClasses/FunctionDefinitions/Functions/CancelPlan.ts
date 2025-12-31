import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const CancelPlan: IAIFunctionDefinition = {
  name: AIFunction.CancelPlan,
  description: `Terminates the current plan execution immediately and returns control to the main conversation loop.

Use this function when plan execution cannot or should not continue. After calling this,
you will receive confirmation that the plan has been cancelled, at which point you should
provide a summary to the user explaining what happened and any partial progress made.

Call this function when:
- The user has explicitly requested to stop, cancel, or terminate the current operation
- An insurmountable condition prevents continuation (e.g., required files don't exist,
  incompatible vault state)
- Persistent errors occur with no viable workaround
- The task has grown beyond the original plan's boundaries (scope creep)

Do NOT use this function:
- For temporary setbacks that can be worked around
- When a replan would be more appropriate
- For single-step failures (attempt recovery or replan first)`,
  parameters: {
    type: "object",
    properties: {
      confirm_cancellation: {
        type: "boolean",
        description: "Safety flag that must be explicitly set to true to confirm the cancellation is intentional. This prevents accidental cancellations.",
        default: false
      }
    },
    required: ["confirm_cancellation"]
  }
}

import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const CancelPlan: IAIToolDefinition = {
  name: AITool.CancelPlan,
  description: `Terminates the current plan execution immediately and returns control to the main conversation loop.

Use this function when plan execution cannot or should not continue.

Call this function when:
- The user has explicitly requested to stop, cancel, or terminate the current operation
- An insurmountable condition prevents continuation (e.g., required files don't exist,
  incompatible vault state)
- Persistent errors occur with no viable workaround
- The task has grown beyond the original plan's boundaries (scope creep)

Do NOT use this function:
- When a replan would be more appropriate`,
  parameters: {
    type: "object",
    properties: {
      context: {
        type: "string",
        description: "Explain why cancellation is being chosen, including what went wrong, what conditions prevented continuation, or why the task cannot proceed as planned.",
      }
    },
    required: ["context"]
  }
}
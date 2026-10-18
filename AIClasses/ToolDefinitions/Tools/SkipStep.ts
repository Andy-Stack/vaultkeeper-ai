import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const SkipStep: IAIToolDefinition = {
  name: AITool.SkipStep,
  description: `Skips the current step and advances to the next one without retrying.

Use this when the step is no longer necessary or when its failure is acceptable and execution should continue.

Call this when:
- The user has explicitly asked to not perform the step
- The step is no longer relevant given what previous steps revealed
- The failure is non-critical and the remaining plan can succeed without this step

Do NOT call this when:
- The step's objective is already satisfied (complete the step instead)
- The step failed and you think a revised instruction would fix it (revise the step instead)
- The failure means the goal cannot be achieved (cancel the plan instead)`,
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "Why the step is being skipped. This is recorded in the plan history so later orchestration decisions can account for it."
      }
    },
    required: ["reason"]
  }
};
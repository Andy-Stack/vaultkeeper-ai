import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const CompletePlan: IAIToolDefinition = {
  name: AITool.CompletePlan,
  description: `Marks the current execution plan as fully completed.

Use this function when all steps in the plan have been successfully executed and
the original goal has been achieved.

Call this function:
- After the final step in the plan has been completed successfully
- When all plan objectives have been fully satisfied
- Before providing the user with a completion summary

Do NOT use this function:
- While there are still pending steps to execute
- If any critical steps failed or were skipped
- If the plan was modified and needs replanning`,
  parameters: {
    type: "object",
    properties: {
      confirm_completion: {
        type: "boolean",
        description: "Safety flag that must be explicitly set to true to confirm the completion is intentional. This prevents accidental plan completions.",
        default: false
      }
    },
    required: ["confirm_completion"]
  }
}
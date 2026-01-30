import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const ContinuePlanExecution: IAIToolDefinition = {
    name: AITool.ContinuePlanExecution,
    description: `Signals that you need to perform additional actions to complete the current step.

Call this function:
- When the current step requires multiple function calls to complete
- When you need to perform more work before the step can be marked as complete

Do NOT use this function:
- When you have finished all work for the current step - mark the step as complete instead`,
    parameters: {
        type: "object",
        properties: {
            confirm_continuation: {
                type: "boolean",
                description: "Safety flag that must be explicitly set to true to confirm the continuation is intentional."
            }
        },
        required: ["confirm_continuation"]
    }
}
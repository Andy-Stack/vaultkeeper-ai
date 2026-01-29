import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const CompleteStep: IAIFunctionDefinition = {
  name: AIFunction.CompleteStep,
  description: `Signals that plan execution should proceed to the next step without modification.

Call this function:
- When the most recent step completed successfully and its results align with the plan's expectations
- When everything is working as intended and no course correction is needed

Do NOT use this function:
- When there were any failures or unexpected results
- When the plan needs adjustment based on new information
- When you need to perform more work on the current step`,
  parameters: {
    type: "object",
    properties: {
      context_for_next_step: {
        type: "string",
        description: "Optional contextual information needed for the next step's execution, derived from any relevant parts of the execution history so far. Analyze what the next step requires and provide only the pertinent information from previous steps (not just the most recent one). Examples: 'Files created: /notes/summary.md, /notes/details.md', 'Search found 5 entries in tags: work, personal', 'Current state: theme=dark, sidebar=collapsed'. Omit if the next step can execute independently without prior results."
      },
      confirm_completion: {
        type: "boolean",
        description: "Safety flag that must be explicitly set to true to confirm the step completion is intentional. This prevents accidental completions.",
        default: false
      }
    },
    required: ["confirm_completion"]
  }
}
import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const SubmitPlan: IAIToolDefinition = {
    name: AITool.SubmitPlan,
    description: `Submits an execution plan with ordered, actionable steps.

Call this function:
- After analyzing the goal and vault context to provide a structured plan
- When you have a clear sequence of steps that will achieve the goal
- When each step is clear, actionable, and executable

Do NOT use this function:
- Before exploring the vault context and understanding the current state
- When you still need more information from the user
- When the plan is incomplete or steps are unclear`,

    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          description: "Ordered array of execution steps. Each step represents an actionable task that moves toward the goal.",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Brief summary of what this step accomplishes (e.g., 'Search for ML notes', 'Create index file'). This is user-facing and should be very concise."
              },
              instruction: {
                type: "string",
                description: "Detailed instructions for executing this step. Should be specific enough to guide the execution without ambiguity. Examples: 'Search vault for all notes with tag #machine-learning using search_vault_files', 'Create new file ML-Index.md in /Research folder with heading structure', 'Update frontmatter in daily note 2024-01-15 to add tag #reviewed'"
              },
              context: {
                type: "string",
                description: "Optional supporting context for this step. May include extracts from vault notes, relevant information gathered during planning, or other contextual details that will help execute this step effectively."
              }
            },
            required: ["description", "instruction"]
          }
        }
      },
      required: ["steps"]
    }
  };
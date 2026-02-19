import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const RevisePlan: IAIToolDefinition = {
  name: AITool.RevisePlan,
  description: `Replaces the current step and all remaining steps with a new set of steps. Previously completed steps are unaffected.

Use this when the plan needs to change from the current position onward — whether the amount of steps needs updating, remaining steps need restructuring, or both.

The steps you provide replace everything from the current step forward:
- If the current step failed or was rejected and needs to be redone differently, include a revised version as the first new step.
- If the current step completed successfully and only the remaining steps need changing, provide only the new remaining steps (do not re-include the current step).

Call this when:
- The current step was rejected or its goal changed, and the subsequent steps need adjusting too
- Execution revealed more (or less) work than the remaining steps account for
- The remaining steps are based on assumptions that no longer hold
- Steps need to be inserted, removed, or reordered

Do NOT call this when:
- Only the current step's instruction or context needs a minor fix and remaining steps are unaffected (revise the current step instead)
- The current step doesn't need to be completed to continue the plan (skip the step instead)
- The remaining plan is still valid and nothing needs to change (complete the step instead)
- The goal cannot be achieved at all (cancel the plan instead)

Write every step that still needs to happen, in order. Include complete context in each step so the execution agent has what it needs without searching.`,
  parameters: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        description: "All steps that still need to execute, starting from the current position. Include a revised version of the current step as the first entry if it needs to be redone; omit it if it completed successfully.",
        items: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description: "Brief summary of what this step accomplishes (e.g., 'Search for ML notes', 'Create index file'). This is user-facing and should be concise."
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
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining why the plan is being revised. Example: 'Revising plan to include updating newly found notes in 'Recipes' folder'"
      }
    },
    required: ["steps", "user_message"]
  }
};

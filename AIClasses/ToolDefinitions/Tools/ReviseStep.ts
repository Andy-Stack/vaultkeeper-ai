import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const ReviseStep: IAIToolDefinition = {
  name: AITool.ReviseStep,
  description: `Revises the current step's instruction and/or context and retries it. Nothing else in the plan changes.

Use this when the step failed but you can fix it by providing better instructions or missing context. You do not need to change both — updating just the context is enough if the instruction itself was correct.

Call this when:
- The execution agent lacked information it needed (e.g. missing file path, missing list of items from a previous step)
- The instruction was ambiguous or incorrect in a way you can now correct
- You have searched the vault and found information that resolves the failure

Do NOT call this when:
- The step outcome requires additional new steps to be inserted (revise the remaining plan instead)
- The step is no longer necessary (skip the step instead)`,
  parameters: {
    type: "object",
    properties: {
      revised_description: {
        type: "string",
        description: `Replacement instruction for the step.
Brief summary of what this step accomplishes (e.g., 'Search for ML notes', 'Create index file'). This is user-facing and should be concise.`
      },
      revised_instruction: {
        type: "string",
        description: `Replacement instruction for the step.
Detailed instructions for executing this step. Should be specific enough to guide the execution without ambiguity. Examples: 'Search vault for all notes with tag #machine-learning using search_vault_files', 'Create new file ML-Index.md in /Research folder with heading structure', 'Update frontmatter in daily note 2024-01-15 to add tag #reviewed'`
      },
      revised_context: {
        type: "string",
        description: `Replacement context for the step. Include any information the execution agent was missing, such as file paths, content from prior steps, or findings from your own searches.
Optional supporting context for this step. May include extracts from vault notes, relevant information gathered during planning, or other contextual details that will help execute this step effectively.`
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining the update/revision. Example: 'Revising plan step to include requested updates' or 'Updating plan step to include extra notes'"
      }
    },
    required: ["revised_description", "revised_instruction", "user_message"]
  }
};

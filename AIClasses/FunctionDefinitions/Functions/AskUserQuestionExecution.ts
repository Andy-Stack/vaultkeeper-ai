import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const AskUserQuestionExecution: IAIToolDefinition = {
  name: AITool.AskUserQuestionExecution,
  description: `Asks the user a question during plan execution and waits for their response.
Use this function to resolve ambiguity at the point of discovery rather than reporting uncertain outcomes.

Call this function when you discover:
- Unexpected file states (file missing when expected to exist, or exists when expected to be absent)
- Content that doesn't match what the plan assumed (different format, structure, or data)
- Multiple valid interpretations of how to proceed
- Conflicts or duplicates requiring a decision
- Situations where proceeding could cause unintended consequences

Do not call this function:
- For routine confirmations when the path forward is clear
- When the outcome is unambiguous (e.g., "file didn't exist" for a deletion is a clear success)
- To ask about future steps or broader plan direction (that's the orchestrator's domain)

Prefer asking over reporting ambiguity: If you would otherwise report an outcome that leaves the orchestrator uncertain about whether to continue or replan, ask the user instead.`,
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user. Structure your question with: (1) What you discovered, (2) Why it matters, (3) Clear options if applicable. Use markdown formatting for readability e.g. emphasis, lists, code snippets, or file paths to make the question easier to read. Example: 'I was instructed to update `projects/active.md`, but the file doesn't exist.\n\n**Options:**\n1. Create the file with the intended content\n2. Skip this step (the file may have been moved or renamed)\n3. Search for a similar file that might be the intended target\n\nHow should I proceed?'"
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining what action you are taking. Examples: 'Requesting guidance on conflict resolution', 'Confirming before deleting duplicate notes', 'Asking about unexpected file format'"
      }
    },
    required: ["question", "user_message"]
  }
};
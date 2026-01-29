import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const AskUserQuestionExecution: IAIFunctionDefinition = {
  name: AIFunction.AskUserQuestionExecution,
  description: `Asks the user a question during plan execution and waits for their response.
This allows interactive execution where unexpected circumstances or ambiguous situations can be resolved with user feedback.

Call this function:
- When you encounter situations during plan execution that require user input or decisions
- When encountering unexpected file states or content that wasn't anticipated in the plan
- When discovering conflicts or duplicates that require user decision
- When handling errors or edge cases where multiple recovery strategies exist
- When confirming destructive or irreversible operations before proceeding
- When requesting missing information that only becomes apparent during execution
- When choosing between alternatives discovered while processing`,
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user. Should be clear, specific, and provide enough context for the user to give a meaningful answer. Include relevant details about the current execution state or what was discovered. Use markdown formatting for emphasis, lists, code snippets, or file paths to make the question easier to read. Example: 'While updating `src/utils/parser.ts`, I found an **existing function** `parseMarkdown()` that conflicts with the one I was about to create.\n\nOptions:\n1. Rename the new function to `parseMarkdownExtended()`\n2. Replace the existing function entirely\n3. Merge the functionality into the existing function\n\nWhich approach would you prefer?'"
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining what action you are taking. Examples: 'Requesting guidance on conflict resolution', 'Confirming before deleting duplicate notes', 'Asking about unexpected file format'"
      }
    },
    required: ["question", "user_message"]
  }
};
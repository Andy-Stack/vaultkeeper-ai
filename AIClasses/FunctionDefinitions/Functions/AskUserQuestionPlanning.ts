import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const AskUserQuestionPlanning: IAIFunctionDefinition = {
  name: AIFunction.AskUserQuestionPlanning,
  description: `Asks the user a question during the planning phase and waits for their response.
This allows interactive planning where user feedback shapes the plan before it's submitted.

Call this function:
- When you need clarification or user input while creating the plan
- When ambiguous requirements need to be clarified before creating the plan
- When getting user preferences because multiple valid approaches exist for the plan
- When asking which files or folders the user wants to target
- When confirming assumptions about the user's intent before planning`,

  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user. Should be clear, specific, and provide enough context for the user to give a meaningful answer. Use markdown formatting for emphasis, lists, code snippets, or file paths to make the question easier to read. Example: 'I found **3 files** matching your criteria:\n\n- `src/components/Header.tsx`\n- `src/components/Footer.tsx`\n- `src/components/Sidebar.tsx`\n\nShould I update all of them or would you like to review them first?'"
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining what action you are taking. Examples: 'Asking the users preference for note naming', 'Querying the user about desired vault structure'"
      }
    },
    required: ["question", "user_message"]
  }
};

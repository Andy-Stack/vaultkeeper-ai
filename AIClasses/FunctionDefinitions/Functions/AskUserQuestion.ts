import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const AskUserQuestion: IAIFunctionDefinition = {
  name: AIFunction.AskUserQuestion,
  description: `Asks the user a question during the planning phase and waits for their response.
Use this function when you need clarification, user input, or decisions while creating the plan.
This allows interactive planning where user feedback shapes the plan before it's submitted.

Common use cases:
- Clarifying ambiguous requirements before creating the plan
- Getting user preferences when multiple valid approaches exist for the plan
- Asking which files or folders the user wants to target
- Confirming assumptions about the user's intent before planning`,

  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user. Should be clear, specific, and provide enough context for the user to give a meaningful answer. Example: 'I found 3 files matching your criteria. Should I update all of them or would you like to review them first?'"
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining what action you are taking. Examples: 'Asking the users preference for note naming', 'Querying the user about desired vault structure'"
      }
    },
    required: ["question", "user_message"]
  }
};

import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const CompleteStep: IAIFunctionDefinition = {
  name: AIFunction.CompleteStep,
  description: `Signals that plan execution should proceed to the next step without modification. 
   
- Use this tool when the most recent step completed successfully and its results align with the plan's expectations.
- This is the appropriate choice when everything is working as intended and no course correction is needed.
- Do NOT use this if there were any failures, unexpected results, or if the plan needs adjustment based on new information.`,
  parameters: {
    type: "object",
    properties: {
      confirm_completion: {
          type: "boolean",
          description: "Safety flag that must be explicitly set to true to confirm the step completion is intentional. This prevents accidental completions.",
          default: false
      }
    },
    required: ["confirm_completion"]
  }
}
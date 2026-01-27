import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const CompleteTask: IAIFunctionDefinition = {
    name: AIFunction.CompleteTask,
    description: `Signals that you have finished executing all of your assigned instructions. This function MUST be called exactly once, only after you have fully completed or can no longer make progress on everything you were asked to do.
  
  Do NOT call this function:
  - After completing individual actions or sub-tasks
  - While you still have remaining work from your instructions
  
  Call this function only when:
  - You have completed everything you were instructed to do (success: true)
  - You have encountered a blocker that prevents further progress on your instructions (success: false)`,
    parameters: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          description: "Whether you successfully completed all of your assigned instructions. Set to true only if everything was accomplished, false if anything remains incomplete or failed."
        },
        description: {
          type: "string",
          description: "A summary of what was accomplished, any outputs produced, or what prevented completion."
        }
      },
      required: ["success", "description"]
    }
  };
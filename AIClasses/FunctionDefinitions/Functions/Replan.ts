import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const Replan: IAIFunctionDefinition = {
  name: AIFunction.Replan,
  description: `Requests the planning agent to revise or extend the current plan based on new information,
obstacles encountered, or changing requirements during execution.

Use this function when the original plan needs adjustment due to:
- Unexpected results from a step that require a different approach
- Missing prerequisites discovered during execution
- User feedback or clarifications that change requirements
- Partial success that requires replanning remaining steps
- New context or information that makes the current plan suboptimal

The planning agent will:
- Review the original goal and current progress
- Analyze what has been completed and what failed or changed
- Create an updated plan that addresses the new situation
- Preserve successful work while adapting remaining steps

Call this when:
- A planned step fails and you need an alternative approach
- Execution reveals the original plan was based on incorrect assumptions
- The user provides new information mid-execution
- You've completed part of the plan but the remaining steps are no longer valid

Do NOT use for:
- Minor adjustments you can handle without planning assistance
- Completely new tasks unrelated to the current plan (use CreatePlan instead)
- Simple retries of failed operations`,
  parameters: {
    type: "object",
    properties: {
      original_goal: {
        type: "string",
        description: "The original high-level goal from the initial plan. This provides continuity and helps the planning agent understand what we're ultimately trying to achieve."
      },
      completed_steps: {
        type: "string",
        description: "A summary of what has been successfully completed so far. Include any relevant outputs, created files, or state changes. Examples: 'Successfully read 5 notes from the Projects folder', 'Created summary.md with initial content'"
      },
      issue_encountered: {
        type: "string",
        description: "Description of what went wrong or what changed that necessitates replanning. Be specific about the problem. Examples: 'The notes folder structure is different than expected - notes are nested in subfolders by year', 'User clarified they only want notes from 2024', 'Write operation failed because file already exists'"
      },
      context: {
        type: "string",
        description: "Additional context including new information discovered, user preferences, constraints, or any other details that should inform the revised plan."
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining why you're requesting a replan. Examples: 'Adjusting the plan based on the vault structure I found', 'Revising approach after encountering a conflict'"
      }
    },
    required: ["original_goal", "completed_steps", "issue_encountered", "context", "user_message"]
  }
}

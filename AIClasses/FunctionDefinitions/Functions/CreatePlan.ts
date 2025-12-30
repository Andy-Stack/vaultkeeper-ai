import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const CreatePlan: IAIFunctionDefinition = {
  name: AIFunction.CreatePlan,
  description: `Requests the planning agent to create a detailed, actionable plan for a high-level goal or task.

Use this function when you need strategic guidance on how to approach a complex
or multi-step request. The planning agent will explore the vault context, analyze
the requirements, and return a structured plan with specific steps for you to execute.

The planning agent specializes in:
- Breaking down complex tasks into atomic, ordered steps
- Conducting exploratory vault searches to inform the plan
- Identifying dependencies and potential failure modes
- Selecting appropriate tools and operations for each step
- Adapting plan complexity to match the task requirements

Call this proactively when:
- The user's request involves multiple operations or phases
- You need to understand vault structure before acting
- The optimal approach is unclear and requires analysis
- The task requires coordination across multiple vault areas

Do NOT use for simple, single-step operations that don't require planning.`,
  parameters: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description: "The high-level goal or task to plan for. Should clearly describe what needs to be accomplished. Examples: 'Create a comprehensive summary of all machine learning notes', 'Reorganize project notes by topic', 'Research and compile information about quantum computing from the vault'"
      },
      context: {
        type: "string",
        description: "Optional additional context that may help inform the planning process. This can include: specific requirements, constraints, user preferences, relevant file paths already identified, or any other information that would help create a better plan. Examples: 'User prefers daily notes in YYYY-MM-DD format', 'Focus on notes created in the last month', 'Should preserve existing wiki-link structure'"
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining why you're requesting a plan. Examples: 'Creating a plan to organize your project notes', 'Developing a strategy to compile your research on AI topics'"
      }
    },
    required: ["goal", "user_message"]
  }
}
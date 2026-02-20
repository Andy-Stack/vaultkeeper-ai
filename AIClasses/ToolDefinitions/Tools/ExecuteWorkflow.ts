import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const ExecuteWorkflow: IAIToolDefinition = {
  name: AITool.ExecuteWorkflow,
  description: `Delegates a complex goal to a specialized workflow system that will autonomously plan, execute, and return the completed result.

When called, this tool hands off the goal to a planning and execution engine that operates independently. The system will analyze the goal, create a detailed plan, execute each step programmatically, handle any necessary replanning if steps fail, and return the final outcome. You do not need to manage or monitor the execution — the result will be returned to you once the workflow completes or if it fails irrecoverably.

The workflow system specializes in breaking down complex tasks, conducting exploratory searches, managing dependencies, recovering from failures through replanning, and coordinating multi-step operations to completion.

**Critical: Convey the user's intent faithfully.** Do NOT soften, hedge, or add restrictions that the user did not request. The goal must reflect what the user actually asked for — not a cautious reinterpretation.

- If the user says "ensure details are correct" → the goal is to **update notes to fix incorrect details**, not to "report findings"
- If the user says "organize my notes" → the goal is to **move and restructure files**, not to "suggest an organization"
- If the user says "clean up duplicates" → the goal is to **remove or merge duplicates**, not to "identify duplicates for review"

Call this function:
- When the user's request involves multiple coordinated operations or phases
- When the task requires vault exploration, analysis, or search before acting
- When the optimal approach is unclear and benefits from systematic planning
- When work spans multiple vault areas or requires sequential dependencies
- When the task is substantial enough that delegating execution is more efficient than step-by-step guidance

Do NOT use this function:
- For simple, single-step operations you can perform directly (e.g., reading one file)`,
  parameters: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description: "The high-level goal to be planned and executed. Should clearly describe the desired end state or outcome. The workflow system will determine the specific steps needed to achieve this. Examples: 'Create a comprehensive summary of all machine learning notes', 'Reorganize project notes by topic and update all internal links', 'Research and compile information about quantum computing from the vault into a new reference document'"
      },
      context: {
        type: "string",
        description: "Optional additional context to inform planning and execution. Include any constraints, preferences, relevant file paths, or domain knowledge that would help produce a better result. Examples: 'User prefers daily notes in YYYY-MM-DD format', 'Focus only on notes created in the last month', 'Preserve existing wiki-link structure and tag conventions'"
      },
      user_message: {
        type: "string",
        description: "A brief message displayed to the user indicating that a workflow is being executed on their behalf. Keep this concise and informative. Examples: 'Organizing your project notes by topic', 'Compiling your AI research into a summary document', 'Restructuring your vault's folder hierarchy'"
      }
    },
    required: ["goal", "user_message"]
  }
}
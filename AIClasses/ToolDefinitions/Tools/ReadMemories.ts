import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const ReadMemories: IAIToolDefinition = {
    name: AITool.ReadMemories,
    description: `Reads the persistent memory file that is injected at the start of every session.
  Memory persists across all conversations and gives you continuity across sessions — use it to recall preferences, conventions, and context about how the user works with their vault.

  Call this function:
  - When the user asks what you remember or what is stored in memory
  - When a task would benefit from checking previously stored preferences or conventions before proceeding
  - When you are unsure whether a relevant preference or convention has already been established
  - When the user refers to a past decision or setup that may have been recorded
  - Before attempting to update existing memories with additions, deletions or edits

  Do NOT call this function:
  - If memory was already loaded at the start of the session and nothing has changed — use what was injected
  - For information that is self-evident from browsing the vault structure
  - Repeatedly within the same session unless memory may have been updated mid-session`,
    parameters: {
        type: "object",
        properties: {
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining that you are accessing memories. Example: 'Checking memories...' or 'Remembering user preference...'"
            }
        },
        required: ["user_message"]
    }
}
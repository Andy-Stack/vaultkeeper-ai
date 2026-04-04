import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const UpdateMemories: IAIToolDefinition = {
    name: AITool.UpdateMemories,
    description: `Adds or removes entries in the persistent memory file that is injected at the start of every session.
  Memory persists across all conversations and gives you continuity across sessions — use it to retain anything that would change how you organise, write, or manage the vault in the future.
  
  Call this function:
  - When the user confirms a vault organisation preference (e.g. folder structure, naming conventions, where certain note types live)
  - When the user establishes a note-taking or writing style preference (e.g. heading structure, tag taxonomy, frontmatter fields they always use)
  - When a template, base, or recurring workflow is set up that you should be aware of in future sessions
  - When the user explicitly asks you to remember or forget something about how they work
  - When a plugin-specific convention is established (e.g. Dataview field names, Templater template paths, Canvas layout preferences)
  - When removing an entry that has become outdated — e.g. a folder was restructured, a convention was changed, or a template was replaced
  
  Do NOT call this function:
  - For the content of a specific note or file — that lives in the vault, not in memory
  - For transient task details only relevant to the current session (e.g. "currently editing ProjectX.md")
  - For information already self-evident from browsing the vault structure
  - When the user is exploring or thinking aloud — wait until a preference or decision is confirmed
  - Multiple times for the same logical update — batch related facts into a single call`,
    parameters: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description: `The complete content to write to the file. This will replace any existing content.
Write as a clear, factual statement that will make sense in isolation, without any reference to the current conversation.
Use absolute dates instead of relative ones (e.g. "2026-03-15" not "recently"). Keep entries concise — one fact per entry, two sentences maximum.
Examples:
- "Daily notes live in /Journal/Daily/ and follow the filename format YYYY-MM-DD.md."
- "Project notes always include a 'status' frontmatter property with values: active | paused | complete."
- "The #area tag is used for ongoing responsibilities; #project is for time-bounded work."
- "2026-03-15: Replaced the weekly review template with one at /Templates/Weekly-Review-v2.md."`,
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining that persistent memory is being updated. Example: 'Updating memories...' or 'Committing user preference...'"
            }
        },
        required: ["content", "user_message"]
    }
}
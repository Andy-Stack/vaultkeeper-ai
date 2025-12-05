import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const PatchVaultFile: IAIFunctionDefinition = {
    name: AIFunction.PatchVaultFile,
    description: `Apply targeted changes to an existing file in the vault using a unified diff patch format.

                  This tool efficiently modifies specific sections of a file without requiring the entire file content to be sent. The patch follows standard unified diff format (similar to git diff output).

                  **When to use this tool:**
                  - Making small, targeted edits to large files (a few lines changed)
                  - Edits in the middle of a file where you have clear surrounding context
                  - Simple line additions, deletions, or replacements with minimal changes

                  **CRITICAL:** The patch must match the existing file content EXACTLY - blank lines, spaces and exact line contents should all correspond to the current state of the file.`,
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The full path to the file within the vault (e.g., 'folder/note.md')"
            },
            patch: {
                type: "string",
                description: `A unified diff format patch string showing the changes to apply.

                              CRITICAL FORMAT REQUIREMENTS:
                              - Must follow standard unified diff format with @@ line markers
                              - Line counts in @@ headers MUST be exact (e.g., @@ -10,5 +10,6 @@ means 5 old lines, 6 new lines)
                              - Include ALL blank/empty lines exactly as they appear in the source file
                              - Context lines (no prefix) must match the file content EXACTLY including whitespace
                              - Use '+' prefix for added lines and '-' prefix for removed lines (no space after prefix)
                              - Context lines should have a single space prefix

                              Example (adding a line after line 10):
                              @@ -10,3 +10,4 @@
                               existing line before
                               existing line where we insert
                              +new content to add
                               existing line after

                              WARNING: The patch will fail if:
                              - Line counts don't match the actual number of lines shown
                              - Blank lines are missing or extra blank lines are included
                              - Context lines don't exactly match the file content`
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what you're writing and why (e.g., 'Updating project plan with new tasks')"
            }
        },
        required: ["file_path", "patch", "user_message"]
    }
}
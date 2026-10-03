import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const PatchVaultFile: IAIToolDefinition = {
    name: AITool.PatchVaultFile,
    description: `Apply targeted changes to an existing file in the vault by finding and replacing specific content.

This tool modifies specific sections of a file by matching exact content and replacing it with new content. It works by performing direct string match and replace operations. Multiple edits can be applied in a single call; they are applied in order and atomically (if any edit fails, no changes are written).

**CRITICAL:** The content to match must be EXACTLY as it appears in the file - including all whitespace, indentation, blank lines, and line breaks.

Call this function:
- When making small, targeted edits to large files (a few lines changed)
- When making edits in the middle of a file where you have clear surrounding context
- When making simple line additions, deletions, or replacements with minimal changes
- When you know the exact content that needs to be changed
- When making multiple independent edits to the same file (use multiple entries in edits)

Do NOT use this function:
- When rewriting most or all of a file's content
- When you haven't read the file first to know the exact content to match
- When the match might be ambiguous (appears multiple times in the file) - unless you intend to replace every occurrence with replace_all`,
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The full path to the file within the vault (e.g., 'folder/note.md')"
            },
            edits: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        old_content: {
                            type: "string",
                            description: `Exact text to find in the file. Must be unique in the file unless replace_all is true.

CRITICAL MATCHING REQUIREMENTS:
- Must match the file content EXACTLY character-for-character
- Include all whitespace, indentation, and line breaks exactly as they appear
- Include enough context to make the match unique within the file
- Typically include 2-3 lines before and after the change for context
- Match complete lines/statements to avoid breaking structure
- Preserve all blank lines that exist in the original`
                        },
                        new_content: {
                            type: "string",
                            description: "Replacement text. Empty string deletes the match. Ensure indentation and formatting match the surrounding content."
                        },
                        replace_all: {
                            type: "boolean",
                            description: "Replace every occurrence instead of requiring a unique match. Default false."
                        }
                    },
                    required: ["old_content", "new_content"]
                },
                description: `The edits to apply. Edits are applied in order; each edit matches against the result of the previous ones. If any edit fails, no changes are written.

WARNING: The patch will fail if:
- Any old_content doesn't exist in the file
- Whitespace/indentation doesn't match exactly
- Any match is ambiguous (appears multiple times) and replace_all is not true
- Line breaks are missing or incorrect`
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what you're writing and why (e.g., 'Updating project plan with new tasks')"
            }
        },
        required: ["file_path", "edits", "user_message"]
    }
}
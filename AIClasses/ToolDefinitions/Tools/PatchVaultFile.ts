import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const PatchVaultFile: IAIToolDefinition = {
    name: AITool.PatchVaultFile,
    description: `Apply targeted changes to an existing file in the vault by finding and replacing specific content.

This tool modifies specific sections of a file by matching exact content and replacing it with new content. It works by performing direct string match and replace operations. Multiple patches can be applied in a single call by providing corresponding arrays of old and new content.

**CRITICAL:** The content to match must be EXACTLY as it appears in the file - including all whitespace, indentation, blank lines, and line breaks.

Call this function:
- When making small, targeted edits to large files (a few lines changed)
- When making edits in the middle of a file where you have clear surrounding context
- When making simple line additions, deletions, or replacements with minimal changes
- When you know the exact content that needs to be changed
- When making multiple independent edits to the same file (use multiple entries in the arrays)

Do NOT use this function:
- When rewriting most or all of a file's content
- When you haven't read the file first to know the exact content to match
- When the match might be ambiguous (appears multiple times in the file)`,
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The full path to the file within the vault (e.g., 'folder/note.md')"
            },
            oldContent: {
                type: "array",
                items: {
                    type: "string"
                },
                description: `An array of exact content strings to find in the file. Each entry corresponds to a matching entry in newContent at the same index.

CRITICAL MATCHING REQUIREMENTS:
- Each entry must match the file content EXACTLY character-for-character
- Include all whitespace, indentation, and line breaks exactly as they appear
- Include enough context to make each match unique within the file
- Typically include 2-3 lines before and after the change for context
- Match complete lines/statements to avoid breaking code structure
- Preserve all blank lines that exist in the original

WARNING: The replacement will fail if:
- Any content entry doesn't exist in the file
- Whitespace/indentation doesn't match exactly
- Any match is ambiguous (appears multiple times in the file)
- Line breaks are missing or incorrect
- The number of oldContent entries doesn't match the number of newContent entries`
            },
            newContent: {
                type: "array",
                items: {
                    type: "string"
                },
                description: `An array of new content strings that will replace the corresponding old content at the same index. Each entry must have a matching entry in oldContent. Ensure proper indentation and formatting matches the surrounding code.`
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what you're writing and why (e.g., 'Updating project plan with new tasks')"
            }
        },
        required: ["file_path", "oldContent", "newContent", "user_message"]
    }
}
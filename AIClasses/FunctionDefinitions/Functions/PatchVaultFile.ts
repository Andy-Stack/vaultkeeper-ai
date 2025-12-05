import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const PatchVaultFile: IAIFunctionDefinition = {
    name: AIFunction.PatchVaultFile,
    description: `Apply targeted changes to an existing file in the vault by finding and replacing specific content.

                  This tool modifies specific sections of a file by matching exact content and replacing it with new content. It works by performing a direct string match and replace operation.

                  **When to use this tool:**
                  - Making small, targeted edits to large files (a few lines changed)
                  - Edits in the middle of a file where you have clear surrounding context
                  - Simple line additions, deletions, or replacements with minimal changes
                  - When you know the exact content that needs to be changed

                  **CRITICAL:** The content to match must be EXACTLY as it appears in the file - including all whitespace, indentation, blank lines, and line breaks.`,
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The full path to the file within the vault (e.g., 'folder/note.md')"
            },
            oldContent: {
                type: "string",
                description: `The exact content to find and replace in the file.

                              CRITICAL MATCHING REQUIREMENTS:
                              - Must match the file content EXACTLY character-for-character
                              - Include all whitespace, indentation, and line breaks exactly as they appear
                              - Include enough context to make the match unique within the file
                              - Typically include 2-3 lines before and after the change for context
                              - Match complete lines/statements to avoid breaking code structure
                              - Preserve all blank lines that exist in the original

                              WARNING: The replacement will fail if:
                              - The content doesn't exist in the file
                              - Whitespace/indentation doesn't match exactly
                              - The match is ambiguous (appears multiple times in the file)
                              - Line breaks are missing or incorrect`
            },
            newContent: {
                type: "string",
                description: `The new content that will replace the old content. Ensure proper indentation and formatting matches the surrounding code.`
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what you're writing and why (e.g., 'Updating project plan with new tasks')"
            }
        },
        required: ["file_path", "oldContent", "newContent", "user_message"]
    }
}
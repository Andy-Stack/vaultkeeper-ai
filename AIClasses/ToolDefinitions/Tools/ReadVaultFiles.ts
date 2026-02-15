import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const ReadVaultFiles: IAIToolDefinition = {
  name: AITool.ReadVaultFiles,
  description: `Reads and returns the complete content of one or more files from the vault.

**IMPORTANT: This function gives you the ability to SEE and ANALYZE images
and PDFs. When users ask about image or PDF files, USE THIS FUNCTION to
read them—do not claim you cannot see images.**

Supports text files (.md, .txt, etc.), images (.png, .jpg, .jpeg, etc), and PDFs (.pdf).

Call this function:
- When you need to access existing file content to answer questions
- When providing summaries or verifying information from specific files
- Before updating files to understand current content and avoid data loss
- When comparing content or gathering related context across multiple files
- When analyzing information across several documents
- When users ask about images or PDFs (this function allows you to see them)

Do NOT use this function:
- When you need to search for files by content - search instead
- When you need to browse directory structure - list directory contents instead`,
  parameters: {
    type: "object",
    properties: {
      file_paths: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Array of full paths to files within the vault. Can contain a single file path ['folder/note.md'] or multiple paths ['folder/note1.md', 'folder/note2.pdf']. Each path must be exact and point to an existing file.",
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining why you're reading these file(s). Examples: 'Reading your daily note to check tasks' (single file) or 'Reading your project notes to compile a summary' (multiple files)"
      }
    },
    required: ["file_paths", "user_message"]
  }
}
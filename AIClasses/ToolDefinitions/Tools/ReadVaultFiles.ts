import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const ReadVaultFiles: IAIToolDefinition = {
  name: AITool.ReadVaultFiles,
  description: `Reads and returns the complete content of one or more files from the vault.

**IMPORTANT: This function gives you the ability to SEE and ANALYZE images
and PDFs. When users ask about image or PDF files, USE THIS FUNCTION to
read them—do not claim you cannot see images.**

Supports text files (.md, .txt, etc.), images (.png, .jpg, .jpeg, etc), PDFs (.pdf), and Office/ODF documents (.docx, .odt, .xlsx, etc).

Binary files are not returned as text in this function's result. The result is a short confirmation, and the file's actual content arrives as an attachment in the message immediately after it, introduced by a text block naming the file. Documents (.docx, .odt, .xlsx, etc.) arrive as plain text; PDFs and images arrive as native attachments. Don't call this function again for the same file to "get the real content"; re-reading returns the same attachment.

Call this function:
- When you need to access existing file content to answer questions
- When providing summaries or verifying information from specific files
- Before updating files to understand current content and avoid data loss
- When comparing content or gathering related context across multiple files
- When analyzing information across several documents
- When users ask about images or PDFs (this function allows you to see them)
- When a search turns up images or PDFs relevant to the request - read them rather than just noting that they exist

Do NOT use this function:
- When you need to search for files by content - search instead
- When you need to browse directory structure - list directory contents instead`,
  parameters: {
    type: "object",
    properties: {
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Search pattern for vault files (searches both names and content). Supports plain text (case-insensitive) or regex literals with /pattern/flags format. Examples: \"meeting notes\", /\\bproject\\b/i, /(k8s|kubernetes)/i. Returns files matching ANY term (OR logic)."
            },
            index: {
              type: "integer",
              description: "..."
            }
          },
          required: ["file_path"] 
        },
        description: "Array of full paths to files within the vault. Can contain a single file path ['folder/note.md'] or multiple paths ['folder/note1.md', 'folder/note2.pdf']. Each path must be exact and point to an existing file.",
      }
    },
    required: ["files"]
  }
}
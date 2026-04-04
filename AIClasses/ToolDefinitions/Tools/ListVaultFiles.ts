import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const ListVaultFiles: IAIToolDefinition = {
    name: AITool.ListVaultFiles,
    description: `Lists files and directories in the vault's directory structure.
Returns a structured view of the vault's organization including file names, paths, and directory hierarchy.

Call this function:
- When you need to list files in a specific directory or the entire vault
- When getting an overview of vault organization and structure
- When browsing available files and folders
- When understanding how notes are organized

Do NOT use this function:
- When you need to search for specific content within files (use SearchVaultFiles instead)
- When you already know the exact file path to read (use ReadVaultFiles instead)`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The directory path to list. Use \"/\" for the vault root. Specify a subdirectory path to list contents of that specific folder (e.g., 'Projects/2024' or 'Daily Notes'). Path should be relative to vault root.",
        },
        recursive: {
          type: "boolean",
          description: "When true, recursively lists all files and subdirectories in a tree structure. When false, only lists immediate children of the specified directory.",
        },
        user_message: {
          type: "string",
          description: "A short message to be displayed to the user explaining what directory is being listed. Example: 'Browsing vault structure' or 'Listing files in Daily Notes folder'"
        }
      },
      required: ["path", "recursive", "user_message"]
    }
  }
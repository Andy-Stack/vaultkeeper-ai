import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const ListVaultFiles: IAIToolDefinition = {
    name: AITool.ListVaultFiles,
    description: `Lists files and directories in the vault's directory structure.
Returns a structured view of the vault's organization including file names, paths, and directory hierarchy.

Results are capped and tracked using a single cursor. If the listing was capped, the response includes a nextIndex - pass it back as "index" on a follow-up call to continue listing from where it left off (the earlier results are not lost, but later entries would be if you don't resume). A missing/undefined nextIndex means the listing reached the end of the directory and there is nothing more to find.

Call this function:
- When you need to list files in a specific directory or the entire vault
- When getting an overview of vault organization and structure
- When browsing available files and folders
- When understanding how notes are organized
- When resuming a prior listing that returned a nextIndex, to continue seeing more entries

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
        index: {
          type: "integer",
          description: "Where to resume this listing. Omit or use 0 to start from the beginning. If the previous call's response included a nextIndex, pass that value back to continue listing from where it left off - otherwise results already seen may be repeated and later entries may be missed. A missing/undefined nextIndex in the response means the listing reached the end and there is nothing more to find."
        },
        user_message: {
          type: "string",
          description: "A short message to be displayed to the user explaining what directory is being listed. Example: 'Browsing vault structure' or 'Listing files in Daily Notes folder'"
        }
      },
      required: ["path", "recursive", "user_message"]
    }
  }
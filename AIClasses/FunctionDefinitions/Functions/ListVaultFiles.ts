import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const ListVaultFiles: IAIFunctionDefinition = {
    name: AIFunction.ListVaultFiles,
    description: `Lists files and directories in the vault's directory structure.
                  Returns a structured view of the vault's organization including file names, paths, and directory hierarchy.
                  Use this function when you need to:
                  - List files in a specific directory or the entire vault
                  - Get an overview of vault organization and structure
                  - Browse available files and folders
                  - Understand how notes are organized`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: `The directory path to list. Use "/" for the vault root. Specify a subdirectory path to list contents of that specific folder (e.g., 'Projects/2024' or 'Daily Notes'). Path should be relative to vault root.`,
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
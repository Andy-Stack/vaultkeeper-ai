import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const MoveVaultFolder: IAIToolDefinition = {
    name: AITool.MoveVaultFolder,
    description: `Moves or renames a folder within the vault to a new location.
This operation moves the folder and all its contents, preserving the internal structure.

Call this function:
- When reorganizing vault structure and moving a folder to a new parent directory
- When renaming a folder for better organization
- When consolidating related folders under a common parent

Do NOT use this function:
- Before reading folder contents to confirm you're moving the correct folder (especially for large operations)
- When moving individual files
- When the destination folder already exists at that path`,
    parameters: {
        type: "object",
        properties: {
            source_path: {
                type: "string",
                description: "The current path of the folder to move. Must be exact and point to an existing folder within the vault. Example: 'projects/old-name'"
            },
            destination_path: {
                type: "string",
                description: "The destination path for the folder (including the folder name). Supports renaming by providing a different folder name. Example: 'projects/new-name' or 'archive/projects/old-name'. Ensure the parent directory exists."
            }
        },
        required: ["source_path", "destination_path"]
    }
}
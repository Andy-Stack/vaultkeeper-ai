import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const DeleteVaultFolder: IAIToolDefinition = {
    name: AITool.DeleteVaultFolder,
    description: `Permanently removes a folder (directory) and all of its contents from the vault.

IMPORTANT: This action is irreversible - deleting a folder will also delete all files and subfolders within it.

Call this function:
- When the user explicitly requests to delete a folder or directory
- When an entire folder structure is no longer needed and should be permanently removed
- When removing an outdated or empty directory that has been confirmed for deletion
- After verifying the folder exists and confirming the user's intent to delete it and its contents

Do NOT use this function:
- When uncertain about whether to delete
- Before confirming the folder's contents and the user's intent to remove them all
- When the user only wants to delete specific files within the folder (delete only those files)
- When the user might want to recover the folder later - archive it instead`,
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "The full path to the folder to delete within the vault. All contents, including subfolders and files, will be permanently removed. Example: 'projects/2024/notes'"
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what folder is being deleted and why. Example: 'Deleting the 2024 projects folder as it is no longer needed'"
            },
            confirm_deletion: {
                type: "boolean",
                description: "Safety flag that must be explicitly set to true to confirm the deletion is intentional. This prevents accidental removal of entire folder structures.",
                default: false
            }
        },
        required: ["path", "user_message", "confirm_deletion"]
    }
}
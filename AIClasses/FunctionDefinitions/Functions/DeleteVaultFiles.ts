import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const DeleteVaultFiles: IAIFunctionDefinition = {
    name: AIFunction.DeleteVaultFiles,
    description: `Permanently removes files and folders from the vault.

IMPORTANT: This action is irreversible - always confirm the exact file path(s) before deletion.

Call this function:
- When the user explicitly requests to delete file(s) or folder(s)
- When a file or folder is no longer needed and should be permanently removed
- When removing outdated content that has been confirmed for deletion
- After verifying the file(s) exist and confirming the user's intent to delete

Do NOT use this function:
- When uncertain about whether to delete
- Before reading the files to confirm their contents
- When the user might want to recover the files later - archive them instead`,
    parameters: {
        type: "object",
        properties: {
            file_paths: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "An array of file paths to be deleted (e.g., ['folder/note.md', 'note2.md', 'folder/subfolder']). Must be an exact match to existing files or folders."
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining why these files are being deleted (e.g., 'Deleting completed task list as requested' or 'Removing duplicate note files')."
            },
            confirm_deletion: {
                type: "boolean",
                description: "Safety flag that must be explicitly set to true to confirm the deletion is intentional. This prevents accidental deletions.",
                default: false
            }
        },
        required: ["file_paths", "user_message", "confirm_deletion"]
    }
}
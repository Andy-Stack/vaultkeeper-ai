import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const DeleteVaultFiles: IAIFunctionDefinition = {
    name: AIFunction.DeleteVaultFiles,
    description: `Permanently removes files from the vault. Use this when the user explicitly 
                  requests to delete file(s), when a file is no longer needed, or when removing outdated 
                  content. IMPORTANT: This action is irreversible - always confirm the exact file path(s) 
                  before deletion. Prefer archiving or moving files to a trash folder over permanent 
                  deletion when uncertain. Only call this after verifying the file(s) exist and confirming 
                  the user's intent to delete.`,
    parameters: {
        type: "object",
        properties: {
            file_paths: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "An array of file paths to be deleted (e.g., ['folder/note.md', 'note2.md']). Must be an exact match to existing files."
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
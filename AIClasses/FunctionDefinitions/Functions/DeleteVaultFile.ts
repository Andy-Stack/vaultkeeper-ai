import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const DeleteVaultFile: IAIFunctionDefinition = {
    name: AIFunction.DeleteVaultFile,
    description: `Permanently removes a file from the vault. Use this when the user explicitly 
                  requests to delete a file, when a file is no longer needed, or when removing outdated 
                  content. IMPORTANT: This action is irreversible - always confirm the exact file path 
                  before deletion. Prefer archiving or moving files to a trash folder over permanent 
                  deletion when uncertain. Only call this after verifying the file exists and confirming 
                  the user's intent to delete.`,
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The full path to the file within the vault to be deleted (e.g., 'folder/note.md'). Must be an exact match to an existing file."
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining why this file is being deleted (e.g., 'Deleting completed task list as requested' or 'Removing duplicate note file')."
            },
            confirm_deletion: {
                type: "boolean",
                description: "Safety flag that must be explicitly set to true to confirm the deletion is intentional. This prevents accidental deletions.",
                default: false
            }
        },
        required: ["file_path", "user_message", "confirm_deletion"]
    }
}
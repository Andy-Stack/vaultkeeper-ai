import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const WriteVaultFile: IAIFunctionDefinition = {
    name: AIFunction.WriteVaultFile,
    description: `Writes content to a file, creating it if it doesn't exist or replacing its contents if it does.
                  Use this for creating new notes or completely updating existing ones when you have the full content ready.
                  IMPORTANT: This replaces the entire file content - always read the file first with ${AIFunction.ReadVaultFiles} if you need to preserve existing content and make partial changes.
                  For simple updates or additions, reading first ensures you don't lose data.`,
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The full path to the file within the vault (e.g., 'folder/note.md')"
            },
            content: {
                type: "string",
                description: "The complete content to write to the file. This will replace any existing content."
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what you're writing and why (e.g., 'Creating your daily note for today' or 'Updating project plan with new tasks')"
            }
        },
        required: ["file_path", "content", "user_message"]
    }
}
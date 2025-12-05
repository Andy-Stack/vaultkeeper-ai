import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const WriteVaultFile: IAIFunctionDefinition = {
    name: AIFunction.WriteVaultFile,
    description: `Writes content to a file, creating it if it doesn't exist or replacing its contents if it does.
                  
                  **When to use this tool:**
                  - Creating new notes, documents, or files from scratch
                  - Completely rewriting a file's contents (when most/all content needs to change)
                  - Generating new files from templates or structured data`,
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
                description: "A short message to be displayed to the user explaining what you're writing and why (e.g., 'Creating your daily note for today')"
            }
        },
        required: ["file_path", "content", "user_message"]
    }
}
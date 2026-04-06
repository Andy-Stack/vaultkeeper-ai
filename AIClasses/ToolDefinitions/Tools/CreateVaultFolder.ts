import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const CreateVaultFolder: IAIToolDefinition = {
    name: AITool.CreateVaultFolder,
    description: `Creates a new folder (directory) in the vault, including any necessary parent folders.

Call this function:
- When setting up a new folder structure or organizational hierarchy
- When a file needs to be written to a folder that does not yet exist
- When the user explicitly asks to create a folder or directory

Do NOT use this function:
- When the target folder already exists
- When writing a file to an existing folder (use WriteVaultFile directly instead)
- When renaming or moving an existing folder`,
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "The full path to the folder to create within the vault. Intermediate parent folders will be created automatically if they do not exist. Example: 'projects/2024/notes'"
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what folder you're creating and why. Example: 'Creating a new Projects folder to organise your notes'"
            }
        },
        required: ["path", "user_message"]
    }
}
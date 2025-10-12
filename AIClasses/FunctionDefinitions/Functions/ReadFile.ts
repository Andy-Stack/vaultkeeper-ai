import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const ReadFile: IAIFunctionDefinition = {
    name: AIFunction.ReadFile,
    description: `Reads and returns the complete content of a specific file from the vault.
                  Call this when you need to access existing note content to answer questions,
                  provide summaries, verify information, or gather context before making updates.
                  Use proactively before updating files to understand current content and avoid
                  data loss. Essential for any operation that references or builds upon existing notes.`,
    parameters: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "The full path to the file within the vault (e.g., 'folder/note.md')"
        },
        user_message: {
          type: "string",
          description: "A short message explaining why you're reading this file (e.g., 'Reading your daily note to check tasks')"
        }
      },
      required: ["file_path", "user_message"]
    }
  }
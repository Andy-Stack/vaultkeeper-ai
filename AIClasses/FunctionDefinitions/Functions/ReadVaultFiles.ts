import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const ReadVaultFiles: IAIFunctionDefinition = {
  name: AIFunction.ReadVaultFiles,
  description: `Reads and returns the complete content of one or more files from the vault.
                Call this when you need to access existing note content to answer questions,
                provide summaries, verify information, or gather context before making updates.
                Use proactively before updating files to understand current content and avoid
                data loss. Essential for any operation that references or builds upon existing notes.

                For multiple files: Use when comparing content, gathering related context, or
                analyzing information across several documents.`,
  parameters: {
    type: "object",
    properties: {
      file_paths: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Array of full paths to files within the vault. Can contain a single file path ['folder/note.md'] or multiple paths ['folder/note1.md', 'folder/note2.md']. Each path must be exact and point to an existing file.",
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining why you're reading these file(s). Examples: 'Reading your daily note to check tasks' (single file) or 'Reading your project notes to compile a summary' (multiple files)"
      }
    },
    required: ["file_paths", "user_message"]
  }
}
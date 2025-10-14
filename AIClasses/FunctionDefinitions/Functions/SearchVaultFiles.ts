import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const SearchVaultFiles: IAIFunctionDefinition = {
  name: AIFunction.SearchVaultFiles,
  description: `Searches through all files in the user's Obsidian vault for the given search term.
                Uses regex pattern matching to search file content.
                Returns matching vault files with metadata (names, paths) and contextual snippets showing matched content with surrounding text to enable relevance assessment.
                Call this whenever you need to know what files exist in the vault to answer questions,
                verify file presence, or to perform further agentic functions.
                Use proactively when vault contents would inform your response.`,
  parameters: {
    type: "object",
    properties: {
      search_term: {
        type: "string",
        description: "The regex pattern to search for in vault files. Supports both simple text (e.g., 'todo') and regex patterns (e.g., '(urgent|important)'). The search is performed on both file names and content."
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user that explains the action being taken"
      }
    },
    required: ["search_term", "user_message"]
  }
}
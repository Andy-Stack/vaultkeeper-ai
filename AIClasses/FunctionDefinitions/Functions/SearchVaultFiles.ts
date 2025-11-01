import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const SearchVaultFiles: IAIFunctionDefinition = {
  name: AIFunction.SearchVaultFiles,
  description: `Searches the content of all vault files using regex pattern matching.
                Returns files containing the search term with contextual snippets showing where matches appear.
                Use this function when you need to:
                - Find specific concepts, keywords, or text within note contents
                - Locate content matching a pattern or phrase
                - Answer questions about what the user has written about a topic
                - Search across both file names and file contents simultaneously`,
  parameters: {
    type: "object",
    properties: {
      search_term: {
        type: "string",
        description: `The regex pattern to search for in vault files. Supports both simple text searches (e.g., 'meeting notes', 'project alpha') and advanced regex patterns (e.g., '(urgent|important)', '\\d{4}-\\d{2}-\\d{2}' for dates). The search is case-insensitive and performed on both file names and content. Use empty string "" to return all vault files.`
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining what is being searched for. Example: 'Searching for notes about project meetings' or 'Finding files containing todo items'"
      }
    },
    required: ["search_term", "user_message"]
  }
}
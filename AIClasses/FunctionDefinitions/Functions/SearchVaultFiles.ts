import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const SearchVaultFiles: IAIFunctionDefinition = {
  name: AIFunction.SearchVaultFiles,
  description: `Searches the content of all vault files using regex pattern matching.
                Returns files containing the search term with contextual snippets showing where matches appear.
                
                **IMPORTANT: When a search returns 0 results, a complete list of all vault files will be automatically returned.**
                This allows you to verify the search scope and attempt alternative search strategies.
                
                Use this function when you need to:
                - Find files based on what's written INSIDE them
                - Search for specific concepts, keywords, or text within notes
                - Locate content that matches a pattern or phrase
                - Answer questions about what the user has written about a topic`,
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
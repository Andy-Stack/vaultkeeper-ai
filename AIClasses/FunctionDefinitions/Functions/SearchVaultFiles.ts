import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const SearchVaultFiles: IAIFunctionDefinition = {
  name: AIFunction.SearchVaultFiles,
  description: `Searches the content of all vault files using regex pattern matching.
Returns files containing any of the search terms with contextual snippets showing where matches appear.
Use this function when you need to:
- Find specific concepts, keywords, or text within note contents
- Locate content matching multiple patterns or phrases
- Answer questions about what the user has written about a topic
- Search across both file names and file contents simultaneously
- Search for multiple related terms or variations in a single query`,
  parameters: {
    type: "object",
    properties: {
      search_terms: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Search patterns for vault files (searches both names and content). Supports plain text (case-insensitive) or regex literals with /pattern/flags format. Examples: \"meeting notes\", /\\bproject\\b/i, /(k8s|kubernetes)/i. Returns files matching ANY term (OR logic).",
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining what is being searched for. Example: 'Searching for notes about project meetings' or 'Finding files containing todo items'"
      }
    },
    required: ["search_terms", "user_message"]
  }
}
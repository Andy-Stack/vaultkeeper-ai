import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const SearchVaultFiles: IAIToolDefinition = {
  name: AITool.SearchVaultFiles,
  description: `Searches the content of all vault files using regex pattern matching.
Returns files containing any of the search terms with contextual snippets showing where matches appear.

Call this function:
- When you need to find specific concepts, keywords, or text within note contents
- When locating content matching multiple patterns or phrases
- When answering questions about what the user has written about a topic
- When searching across both file names and file contents simultaneously
- When searching for multiple related terms or variations in a single query

Do NOT use this function:
- When you need to browse directory structure - list directory contents instead
- When you already know the exact file path to read - read the file directly`,
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
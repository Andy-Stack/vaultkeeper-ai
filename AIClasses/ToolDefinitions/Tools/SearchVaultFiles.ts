import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const SearchVaultFiles: IAIToolDefinition = {
  name: AITool.SearchVaultFiles,
  description: `Searches vault file names and contents using regex pattern matching.
Returns matching file names and files containing matches, with contextual snippets showing where each match appears.

Each search term is scanned independently and results are capped per term, with file name matches and file content matches tracked using separate cursors. If a term's file name or content results were capped, the response includes nextFileNamesIndex and/or nextFileContentsIndex for that term - pass them back as that term's "fileNamesIndex" and "fileContentsIndex" on a follow-up call to continue searching from where each left off (the earlier results are not lost, but later matches would be if you don't resume). A missing/undefined next index means that cursor's search reached the end of the vault and there is nothing more to find for it.

Call this function:
- When you need to find specific concepts, keywords, or text within note contents
- When locating content matching multiple patterns or phrases
- When answering questions about what the user has written about a topic
- When searching across both file names and file contents simultaneously
- When searching for multiple related terms or variations in a single query
- When resuming a prior search that returned a nextIndex, to continue looking for more matches

Do NOT use this function:
- When you need to browse directory structure - list directory contents instead
- When you already know the exact file path to read - read the file directly`,
  parameters: {
    type: "object",
    properties: {
      search_terms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            search_term: { type: "string", description: "Search pattern for vault files (searches both names and content). Supports plain text (case-insensitive) or regex literals with /pattern/flags format. Examples: \"meeting notes\", /\\bproject\\b/i, /(k8s|kubernetes)/i. Returns files matching ANY term (OR logic)." },
            fileNamesIndex: { type: "integer", description: "Where to resume this term's file name search. Omit or use 0 to start a new search from the beginning of the vault. To continue a previous search, pass the nextFileNamesIndex that was returned for this exact search_term - otherwise results already seen may be repeated and later matches may be missed." },
            fileContentsIndex: { type: "integer", description: "Where to resume this term's file content search. Omit or use 0 to start a new search from the beginning of the vault. To continue a previous search, pass the nextFileContentsIndex that was returned for this exact search_term - otherwise results already seen may be repeated and later matches may be missed." }
          },
          required: ["search_term"]
        }
      },
      user_message: {
        type: "string",
        description: "A short message to be displayed to the user explaining what is being searched for. Example: 'Searching for notes about project meetings' or 'Finding files containing todo items'"
      }
    },
    required: ["search_terms", "user_message"]
  }
}
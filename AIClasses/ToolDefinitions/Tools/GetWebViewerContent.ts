import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const GetWebViewerContent: IAIToolDefinition = {
    name: AITool.GetWebViewerContent,
    description: `Retrieves the text content from a currently open Web Viewer tab in Obsidian.

For "text" format, results are capped and tracked using a cursor. If the page content was capped, the response includes a nextIndex - pass it back as "index" on a follow-up call to continue reading from where it left off (the earlier content is not lost, but later content would be if you don't resume). A missing/undefined nextIndex means the page's text was fully returned and there is nothing more to read. The "index" parameter is ignored for "screenshot" format, since a screenshot is always returned in full.

Call this function:
- When the user asks you to read, summarise, or act on the contents of an open web page
- When you need to extract information from a URL that is already open in the Web Viewer
- When the user refers to "this page", "the current tab", or similar
- When resuming a prior "text" read that returned a nextIndex, to continue reading more of the page`,
    parameters: {
        type: "object",
        properties: {
            url_hint: {
                type: "string",
                description: "Optional. A partial URL or domain to identify which Web Viewer tab to read from, if multiple tabs are open. If omitted, the active or most recently opened Web Viewer tab will be used. Example: 'github.com'"
            },
            format: {
                type: "string",
                enum: ["text", "screenshot"],
                description: "The format in which to return the page content. Use 'text' for plain readable content (equivalent to document.body.innerText), or 'screenshot' for an image of the webpage. Prefer 'text' unless you need to inspect the page visually."
            },
            index: {
                type: "integer",
                description: "Only used for \"text\" format. Where to resume reading the page's text. Omit or use 0 to start from the beginning. If the previous call's response included a nextIndex, pass that value back to continue reading from where it left off - otherwise content already seen may be repeated and later content may be missed. Ignored for \"screenshot\" format."
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what you're reading and why. Example: 'Reading the open page to summarise its key points'"
            }
        },
        required: ["format", "user_message"]
    }
}
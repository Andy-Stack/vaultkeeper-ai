import { AITool } from "Enums/AITool";
import type { IAIToolDefinition } from "../IAIToolDefinition";

export const GetWebViewerContent: IAIToolDefinition = {
    name: AITool.GetWebViewerContent,
    description: `Retrieves the text content from a currently open Web Viewer tab in Obsidian.

Call this function:
- When the user asks you to read, summarise, or act on the contents of an open web page
- When you need to extract information from a URL that is already open in the Web Viewer
- When the user refers to "this page", "the current tab", or similar`,
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
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining what you're reading and why. Example: 'Reading the open page to summarise its key points'"
            }
        },
        required: ["format", "user_message"]
    }
}
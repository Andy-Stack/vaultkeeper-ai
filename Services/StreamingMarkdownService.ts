import { unified, type Processor } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkEmoji from "remark-emoji";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import wikiLinkPlugin from "remark-wiki-link";
import type { FileSystemService } from "./FileSystemService";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { Selector } from "Enums/Selector";
import type { HTMLService } from "./HTMLService";

interface IStreamingState {
    element: HTMLElement;
    buffer: string;
    lastProcessedLength: number;
    isComplete: boolean;
}

export class StreamingMarkdownService {
    private readonly htmlService: HTMLService = Resolve<HTMLService>(Services.HTMLService);
    private readonly fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    private readonly processor: Processor<any, any, any, any, any> | null = null;
    private streamingStates: Map<string, IStreamingState> = new Map<string, IStreamingState>();

    private cachedPermaLinks: string[];

    constructor() {
        this.cachedPermaLinks = this.fileSystemService.getVaultFileListForMarkDown();

        this.processor = unified()
        .use(remarkParse)
            .use(remarkGfm)
            .use(remarkEmoji)
            .use(remarkMath)
            .use(remarkRehype, { 
                allowDangerousHtml: false 
            })
            .use(rehypeKatex)
            .use(rehypeHighlight, {
                detect: true,
                plainText: ["txt", "text"],
                aliases: {
                    javascript: ["js", "jsx"],
                    typescript: ["ts", "tsx"],
                    python: ["py"],
                    markdown: ["md", "mdx"],
                    shell: ["bash", "sh", "zsh"]
                }
            })
            .use(rehypeStringify, {
                allowDangerousHtml: false,
                allowDangerousCharacters: false,
                closeSelfClosing: true
            })
            .use(wikiLinkPlugin, {
                permalinks: this.cachedPermaLinks,
                wikiLinkClassName: Selector.MarkDownLink,
                pageResolver: (pageName: string) => [pageName],
                hrefTemplate: (permalink: string) => `#/page/${encodeURIComponent(permalink)}`
            });
    }

    public formatText(text: string): string {
        try {
            const preprocessed = this.preprocessContent(text);
            const result = this.processor!.processSync(preprocessed);
            return String(result);
        } catch (error) {
            console.warn("Markdown processing failed:", error);
            return this.getFallbackHTML(text);
        }
    }

    public initializeStream(messageId: string, container: HTMLElement): void {
        this.htmlService.clearElement(container);

        this.streamingStates.set(messageId, {
            element: container,
            buffer: "",
            lastProcessedLength: 0,
            isComplete: false
        });
    }

    public streamChunk(messageId: string, fullText: string): void {
        // ensure perma links are up to date during each chunk
        this.fileSystemService.getVaultFileListForMarkDown()

        const state = this.streamingStates.get(messageId);
        if (!state || state.isComplete) {
            return;
        }

        state.buffer = fullText;

        // Use debounced rendering for better performance
        this.debouncedRender(messageId);
    }

    private renderTimeouts = new Map<string, NodeJS.Timeout>();
    
    private debouncedRender(messageId: string, immediate: boolean = false): void {
        const existingTimeout = this.renderTimeouts.get(messageId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        const render = () => {
            const state = this.streamingStates.get(messageId);
            if (!state) {
                return;
            }

            try {
                const html = this.formatText(state.buffer);
                this.htmlService.setHTMLContent(state.element, html);
                state.lastProcessedLength = state.buffer.length;
            } catch (error) {
                console.warn("Streaming render failed:", error);
            }

            this.renderTimeouts.delete(messageId);
        };

        if (immediate) {
            render();
        } else {
            const timeout = setTimeout(render, 50); // 50ms debounce
            this.renderTimeouts.set(messageId, timeout);
        }
    }

    public finalizeStream(messageId: string, fullText: string): void {
        const state = this.streamingStates.get(messageId);
        if (!state) {
            return;
        }

        state.isComplete = true;
        state.buffer = fullText;
        
        // Final render without debounce
        this.debouncedRender(messageId, true);
        
        // Cleanup
        this.streamingStates.delete(messageId);
        const timeout = this.renderTimeouts.get(messageId);
        if (timeout) {
            clearTimeout(timeout);
            this.renderTimeouts.delete(messageId);
        }
    }

    private preprocessContent(content: string): string {
        // Simplified and safer preprocessing
        return content
            // Normalize line endings
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            // Convert LaTeX delimiters
            .replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
                // Ensure math blocks are on their own lines
                return "\n$$\n" + math.trim() + "\n$$\n";
            })
            .replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$$")
            // Ensure headers have blank lines before them (but not at start)
            .replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2")
            // Collapse excessive newlines but preserve intentional spacing
            .replace(/\n{4,}/g, "\n\n\n")
            // Clean up list formatting - ensure consistent spacing
            .replace(/^(\s*)([*+-]|\d+\.)\s+/gm, "$1$2 ")
            // Ensure task list checkboxes are properly formatted
            .replace(/^(\s*)([*+-])\s*\[([ x])\]/gm, "$1$2 [$3]");
    }

    private getFallbackHTML(text: string): string {
        // Improved fallback with basic markdown support
        const escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        
        const lines = escaped.split("\n");
        const html: string[] = [];
        let inList = false;
        let inCodeBlock = false;
        
        for (const line of lines) {
            if (line.startsWith("```")) {
                if (inCodeBlock) {
                    html.push("</code></pre>");
                    inCodeBlock = false;
                } else {
                    html.push("<pre><code>");
                    inCodeBlock = true;
                }
                continue;
            }
            
            if (inCodeBlock) {
                html.push(line + "\n");
                continue;
            }
            
            // Basic list support
            if (/^[*+-]\s/.test(line)) {
                if (!inList) {
                    html.push("<ul>");
                    inList = true;
                }
                html.push(`<li>${line.substring(2)}</li>`);
            } else if (inList && line.trim() === "") {
                html.push("</ul>");
                inList = false;
            } else {
                if (inList) {
                    html.push("</ul>");
                    inList = false;
                }
                
                // Basic formatting
                const formatted = line
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\*(.+?)\*/g, "<em>$1</em>")
                    .replace(/`(.+?)`/g, "<code>$1</code>");
                
                if (line.trim()) {
                    html.push(`<p>${formatted}</p>`);
                }
            }
        }
        
        if (inList) html.push("</ul>");
        if (inCodeBlock) html.push("</code></pre>");
        
        return html.join("");
    }
}
import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import remarkEmoji from 'remark-emoji';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import remarkBreaks from 'remark-breaks';

export class StreamingMarkdownService {
    private static processor: Processor<any, any, any, any, any> | null = null;

    constructor() {
        if (!StreamingMarkdownService.processor) {
            StreamingMarkdownService.processor = this.createProcessor();
        }
    }

    private createProcessor() {
        return unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkBreaks) // Note: This makes single newlines into <br> tags.
            .use(remarkToc)
            .use(remarkEmoji)
            .use(remarkMath)
            .use(remarkRehype, { allowDangerousHtml: false }) // Important for security
            .use(rehypeKatex)
            .use(rehypeHighlight)
            .use(rehypeStringify);
    }

    public formatText(text: string) {
        try {
            const preprocessed = this.preprocessContent(text);
            const result = StreamingMarkdownService.processor!.processSync(preprocessed);
            return String(result);
        } catch (error) {
            console.warn('Markdown processing failed, falling back to safe rendering:', error);
            // Fallback to basic HTML escaping if parsing fails
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>');
        }
    }

    private preprocessContent(content: string): string {
        return content
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')

            // Fix LaTeX math delimiters
            .replace(/\\\[([\s\S]*?)\\\]/g, '$$\n$1\n$$') // Block math
            .replace(/\\\(([\s\S]*?)\\\)/g, '$$1$')      // Inline math - CRITICAL FIX HERE

            // Clean up excessive newlines to a standard paragraph break
            .replace(/\n{3,}/g, '\n\n')

            // Fix escaped characters that shouldn't be (use with caution)
            .replace(/\\\*/g, '*')
            .replace(/\\_/g, '_')
            .replace(/\\`/g, '`')

            // Ensure headers have a blank line above them for proper parsing
            .replace(/(?<!\n)\n(#{1,6}\s)/g, '\n\n$1')

            // Clean up extra spaces inside formatting (robust version)
            .replace(/\*\*\s+([^*]+?)\s+\*\*/g, '**$1**')
            .replace(/(?<!\*)\*\s+([^*]+?)\s+\*(?!\*)/g, '*$1*');
    }
}
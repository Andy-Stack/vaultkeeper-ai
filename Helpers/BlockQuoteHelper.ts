import type { IWikilink } from "./WikilinkHelper";

const INLINE_QUOTE = /["“]([^"“”]+)["”]\s*[-–—,:]?\s*$/;
const QUOTE_MARKER = /^\s*(?:>\s?)+/;
const CALLOUT_HEADER = /^\[!\w[\w-]*\][+-]?/;
const SURROUNDING_PUNCTUATION = /^[\s"“”'‘’\-–—,:]+|[\s"“”'‘’\-–—,:]+$/g;
// NFKC turns … into ..., so only the ASCII forms need matching
const ELLIPSIS = /\[\.\.\.\]|\.\.\./;

export function findQuotedText(lines: string[], link: IWikilink): string | undefined {
    const textBeforeLink = lines[link.line]?.slice(0, link.column) ?? "";

    const inlineQuote = INLINE_QUOTE.exec(textBeforeLink);
    if (inlineQuote) {
        return inlineQuote[1].trim();
    }

    const quoteLines = findQuoteBlock(lines, link.line, textBeforeLink);
    if (!quoteLines) {
        return undefined;
    }

    const textLines = quoteLines.map(line => line.replace(QUOTE_MARKER, ""));
    if (CALLOUT_HEADER.test(textLines[0].trim())) {
        textLines.shift();
    }

    const quotedText = textLines.join(" ").replace(link.original, "").replace(SURROUNDING_PUNCTUATION, "");
    return quotedText || undefined;
}

export function normaliseQuoteText(text: string): string {
    return text.normalize("NFKC")
        .replace(/[“”„«»]/g, '"')
        .replace(/[‘’‚]/g, "'")
        .replace(/[–—]/g, "-")
        .replace(/\*\*|==|~~|\*/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// The quote may be any part of the block, with ellipses standing in for omitted text
export function quoteMatchesBlock(quote: string, block: string): boolean {
    const normalisedBlock = normaliseQuoteText(block);
    const fragments = normaliseQuoteText(quote).split(ELLIPSIS).map(fragment => fragment.trim()).filter(Boolean);

    let searchFrom = 0;
    for (const fragment of fragments) {
        const fragmentIndex = normalisedBlock.indexOf(fragment, searchFrom);
        if (fragmentIndex === -1) {
            return false;
        }
        searchFrom = fragmentIndex + fragment.length;
    }
    return true;
}

// The quote either contains the link or ends on the line above a line holding only the link
function findQuoteBlock(lines: string[], lineIndex: number, textBeforeLink: string): string[] | undefined {
    let end: number;
    if (isQuoteLine(lines[lineIndex])) {
        end = lineIndex;
    } else if (textBeforeLink.trim() === "" && isQuoteLine(lines[lineIndex - 1])) {
        end = lineIndex - 1;
    } else {
        return undefined;
    }

    let start = end;
    while (isQuoteLine(lines[start - 1])) {
        start--;
    }
    while (isQuoteLine(lines[end + 1])) {
        end++;
    }

    return lines.slice(start, end + 1);
}

function isQuoteLine(line: string | undefined): boolean {
    return line !== undefined && QUOTE_MARKER.test(line);
}

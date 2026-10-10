const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const INLINE_CODE = /(`+).+?\1/g;
const HEADING = /^#{1,6}\s+(.+?)(?:\s+#+)?\s*$/;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const TASK_MARKER = /^\[[ xX]\]\s+/;
const QUOTE_MARKER = /^\s*(?:>\s?)+/;

export function isNotePath(path: string): boolean {
    return path.toLowerCase().endsWith(".md");
}

export function splitLines(content: string): string[] {
    return content.split(/\r?\n/);
}

// Code is replaced with spaces rather than removed so columns still line up with the original content
export function maskCode(content: string): string[] {
    let openFence: string | undefined;

    return splitLines(content).map(line => {
        const fence = FENCE.exec(line)?.[1];

        if (openFence) {
            if (fence && fence[0] === openFence[0] && fence.length >= openFence.length) {
                openFence = undefined;
            }
            return " ".repeat(line.length);
        }

        if (fence) {
            openFence = fence;
            return " ".repeat(line.length);
        }

        return line.replace(INLINE_CODE, code => " ".repeat(code.length));
    });
}

export function getHeadings(content: string): string[] {
    const lines = maskCode(content);
    const headings: string[] = [];

    for (let lineIndex = frontmatterEnd(lines); lineIndex < lines.length; lineIndex++) {
        const heading = HEADING.exec(lines[lineIndex]);
        if (heading) {
            headings.push(heading[1]);
        }
    }

    return headings;
}

// Obsidian drops characters that can't appear in a link when linking to a heading
export function headingMatches(heading: string, linkedHeading: string): boolean {
    return normaliseHeading(heading) === normaliseHeading(linkedHeading);
}

export function getBlockContent(content: string, blockId: string): string | undefined {
    const rawLines = splitLines(content);
    const lines = maskCode(content);
    const blockIdPattern = new RegExp(`(?:^|\\s)\\^${escapeRegExp(blockId)}\\s*$`, "i");

    const idLineIndex = lines.findIndex((line, lineIndex) => lineIndex >= frontmatterEnd(lines) && blockIdPattern.test(line));
    if (idLineIndex === -1) {
        return undefined;
    }

    let start = idLineIndex;
    let end = idLineIndex;

    if (lines[idLineIndex].trim().startsWith("^")) {
        // An ID on its own line belongs to the block above it, such as a table or quote
        end = idLineIndex - 1;
        while (end >= 0 && lines[end].trim() === "") {
            end--;
        }
        if (end < 0) {
            return undefined;
        }
        start = end;
    } else if (LIST_MARKER.test(lines[idLineIndex])) {
        return cleanBlockLines([rawLines[idLineIndex].replace(blockIdPattern, "")]);
    }

    while (start > 0 && lines[start - 1].trim() !== "") {
        start--;
    }

    const blockLines = rawLines.slice(start, end + 1);
    blockLines[blockLines.length - 1] = blockLines[blockLines.length - 1].replace(blockIdPattern, "");
    return cleanBlockLines(blockLines);
}

function cleanBlockLines(lines: string[]): string {
    return lines
        .map(line => line.replace(QUOTE_MARKER, "").replace(LIST_MARKER, "").replace(TASK_MARKER, "").trim())
        .join("\n")
        .trim();
}

function frontmatterEnd(lines: string[]): number {
    if (lines[0]?.trim() !== "---") {
        return 0;
    }
    const closingIndex = lines.findIndex((line, lineIndex) => lineIndex > 0 && line.trim() === "---");
    return closingIndex === -1 ? 0 : closingIndex + 1;
}

function normaliseHeading(heading: string): string {
    return heading.replace(/[[\]#|^:\\]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

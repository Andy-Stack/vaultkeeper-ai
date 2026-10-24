export type ThinkTagSplit = { content: string; thought: string };

// Separates inline <think>…</think> reasoning from answer text in a stream, where tags can be split across chunks
export class ThinkTagSplitter {
    private static readonly OPEN_TAG = "<think>";
    private static readonly CLOSE_TAG = "</think>";

    private isThinking: boolean = false;
    private pendingText: string = "";

    public split(text: string): ThinkTagSplit {
        const result: ThinkTagSplit = { content: "", thought: "" };
        let remaining = this.pendingText + text;
        this.pendingText = "";

        while (remaining !== "") {
            const tag = this.isThinking ? ThinkTagSplitter.CLOSE_TAG : ThinkTagSplitter.OPEN_TAG;
            const tagIndex = remaining.indexOf(tag);

            if (tagIndex !== -1) {
                this.append(result, remaining.slice(0, tagIndex));
                remaining = remaining.slice(tagIndex + tag.length);
                this.isThinking = !this.isThinking;
                continue;
            }

            // Hold back a trailing partial tag until the next chunk completes or rules it out
            const heldBackLength = this.partialTagLength(remaining, tag);
            this.append(result, remaining.slice(0, remaining.length - heldBackLength));
            this.pendingText = remaining.slice(remaining.length - heldBackLength);
            break;
        }

        return result;
    }

    public flush(): ThinkTagSplit {
        const result: ThinkTagSplit = { content: "", thought: "" };
        this.append(result, this.pendingText);
        this.pendingText = "";
        return result;
    }

    public reset() {
        this.isThinking = false;
        this.pendingText = "";
    }

    private append(result: ThinkTagSplit, text: string) {
        if (this.isThinking) {
            result.thought += text;
        } else {
            result.content += text;
        }
    }

    private partialTagLength(text: string, tag: string): number {
        for (let length = Math.min(tag.length - 1, text.length); length > 0; length--) {
            if (tag.startsWith(text.slice(-length))) {
                return length;
            }
        }
        return 0;
    }
}

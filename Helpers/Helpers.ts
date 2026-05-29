import type VaultkeeperAIPlugin from "main";
import path from "path-browserify";
import { Exception } from "./Exception";

/**
 * Replaces placeholders in Copy strings with provided values.
 * Placeholders are denoted by curly braces: {placeholderName}
 *
 * @param copyString - The Copy enum string containing placeholders
 * @param replacements - Array of replacement values in the order they appear in the string
 * @returns The string with all placeholders replaced
 *
 * @example
 * replaceCopy(Copy.WorkflowFailedAtStep, ["authentication"])
 * // Returns: "The planned workflow failed when executing step 'authentication'. Consult with the user on how to continue."
 */
export function replaceCopy(copyString: string, replacements: string[]): string {
    const placeholderRegex = /\{[^}]+\}/g;
    const placeholders = copyString.match(placeholderRegex);

    if (!placeholders) {
        if (replacements.length > 0) {
            Exception.log(`No placeholders found in copy string, but ${replacements.length} replacement(s) provided.`);
        }
        return copyString;
    }

    if (placeholders.length !== replacements.length) {
        Exception.log(`Placeholder count (${placeholders.length}) does not match replacement count (${replacements.length}). Using best effort.`);
    }

    let result = copyString;
    let replacementIndex = 0;

    result = result.replace(placeholderRegex, () => {
        if (replacementIndex < replacements.length) {
            return replacements[replacementIndex++];
        }
        return placeholders[replacementIndex++]; // Return original placeholder if no replacement available
    });

    return result;
}

export function openPluginSettings(plugin: VaultkeeperAIPlugin) {
    if (!("setting" in plugin.app) || typeof plugin.app.setting !== "object" || plugin.app.setting === null) {
        return;
    }

    if ("open" in plugin.app.setting) {
        // @ts-expect-error - accessing internal API
        plugin.app.setting.open();
    }
    if ("openTabById" in plugin.app.setting) {
        // @ts-expect-error - accessing internal API
        plugin.app.setting.openTabById(plugin.manifest.id);
    }
}

export function closePluginSettings(plugin: VaultkeeperAIPlugin) {
    if (!("setting" in plugin.app) || typeof plugin.app.setting !== "object" || plugin.app.setting === null) {
        return;
    }

    if ("close" in plugin.app.setting) {
        // @ts-expect-error - accessing internal API
        plugin.app.setting.close();
    }
}

export function randomSample<T>(array: T[], n: number): T[] {
    const result: T[] = [];
    const taken = new Set<number>();

    while (result.length < n && result.length < array.length) {
        const index = Math.floor(Math.random() * array.length);
        if (!taken.has(index)) {
            taken.add(index);
            result.push(array[index]);
        }
    }

    return result;
}

export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function pathExtname(filePath: string) {
    return path.extname(filePath).substring(1).toLocaleLowerCase();
}

export async function sleep(ms: number): Promise<void> {
	return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
    const match = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
    if (!match) {
        return { frontmatter: "", body: content };
    }
    return { frontmatter: match[1], body: match[2] };
}

export function mergeTagsIntoFrontmatter(content: string, tagsToAdd: string[]): string {
    const cleaned = Array.from(new Set(
        tagsToAdd
            .map(t => t.trim().replace(/^#/, ""))
            .filter(t => t.length > 0)
    ));
    if (cleaned.length === 0) {
        return content;
    }

    const { frontmatter, body } = splitFrontmatter(content);

    if (frontmatter === "") {
        const block = `---\ntags:\n${cleaned.map(t => `  - ${t}`).join("\n")}\n---\n`;
        return block + content;
    }

    const fmInner = frontmatter.replace(/^---\r?\n/, "").replace(/\r?\n---\r?\n?$/, "");
    const tagsKeyMatch = fmInner.match(/^(tags|tag)[ \t]*:(.*)$/m);

    let newFmInner: string;
    if (!tagsKeyMatch) {
        const block = `tags:\n${cleaned.map(t => `  - ${t}`).join("\n")}`;
        newFmInner = fmInner.length === 0 ? block : `${fmInner}\n${block}`;
    } else {
        const keyStartIdx = tagsKeyMatch.index!;
        const valueOnLine = tagsKeyMatch[2];
        const afterKeyLineIdx = keyStartIdx + tagsKeyMatch[0].length;

        const existing: string[] = [];
        let blockEndIdx = afterKeyLineIdx;

        const inlineMatch = valueOnLine.match(/^\s*\[(.*)\]\s*$/);
        if (inlineMatch) {
            inlineMatch[1].split(",").map(t => t.trim().replace(/^["']|["']$/g, "")).filter(t => t.length > 0).forEach(t => existing.push(t));
        } else if (valueOnLine.trim().length > 0) {
            // A plain (non-list) scalar value. Obsidian 1.9 no longer recognises
            // these, so they are malformed input — most likely AI-generated. A
            // comma-separated string such as `tags: a, b, c` is the exact broken
            // format we normalise into a YAML list, so split on commas. Strip
            // surrounding quotes first so `tags: "a, b"` works too.
            valueOnLine.trim()
                .replace(/^["']|["']$/g, "")
                .split(",")
                .map(t => t.trim().replace(/^#/, "").replace(/^["']|["']$/g, ""))
                .filter(t => t.length > 0)
                .forEach(t => existing.push(t));
        } else {
            const remainder = fmInner.slice(afterKeyLineIdx);
            const lines = remainder.split(/\r?\n/);
            let consumed = 0;
            for (const line of lines) {
                const itemMatch = line.match(/^\s+-\s*(.*?)\s*$/);
                if (itemMatch) {
                    const tag = itemMatch[1].replace(/^["']|["']$/g, "");
                    if (tag.length > 0) {
                        existing.push(tag);
                    }
                    consumed += line.length + 1;
                } else if (line.trim() === "") {
                    consumed += line.length + 1;
                } else {
                    break;
                }
            }
            blockEndIdx = afterKeyLineIdx + Math.min(consumed, remainder.length);
            if (blockEndIdx > afterKeyLineIdx && fmInner[blockEndIdx - 1] === "\n") {
                blockEndIdx -= 1;
            }
        }

        const merged = Array.from(new Set([...existing, ...cleaned]));
        const replacement = `tags:\n${merged.map(t => `  - ${t}`).join("\n")}`;
        newFmInner = fmInner.slice(0, keyStartIdx) + replacement + fmInner.slice(blockEndIdx);
    }

    const trailingNewline = /\r?\n$/.test(frontmatter) ? "\n" : "";
    const newFrontmatter = `---\n${newFmInner}\n---${trailingNewline}`;
    return newFrontmatter + body;
}
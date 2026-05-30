import { parseYaml } from "obsidian";

/**
 * Normalises an arbitrary frontmatter list value into a clean string array.
 *
 * Obsidian 1.9 only recognises tags/aliases/cssclasses as YAML lists, but a value can still
 * arrive malformed — most likely AI-generated — as a scalar string or a comma-separated string
 * (e.g. `meeting, work`). This coerces all of those into an array, splitting comma-separated
 * strings, stripping a leading `#`, trimming, and dropping empties. Already-array values are
 * passed through item-by-item with the same cleaning. Non-string/array/number values are ignored.
 */
export function normaliseFrontmatterList(value: unknown): string[] {
    const items: unknown[] = Array.isArray(value) ? value : [value];

    const cleaned: string[] = [];
    for (const item of items) {
        if (typeof item !== "string" && typeof item !== "number") {
            continue;
        }
        String(item)
            .split(",")
            .map(part => part.trim().replace(/^#/, ""))
            .filter(part => part.length > 0)
            .forEach(part => cleaned.push(part));
    }
    return cleaned;
}

/**
 * Unions `additions` into a list-valued frontmatter field in place, keeping existing entries
 * first and de-duplicating. The existing value is normalised via {@link normaliseFrontmatterList}, so a
 * malformed scalar/comma-separated value is repaired into a proper array. Intended to be called
 * from inside a `processFrontMatter` mutator, which then serialises the array as a block list.
 */
export function mergeListIntoFrontmatter(frontmatter: Record<string, unknown>, key: string, additions: string[]): void {
    const existing = normaliseFrontmatterList(frontmatter[key]);
    const cleanedAdditions = normaliseFrontmatterList(additions);

    const merged = Array.from(new Set([...existing, ...cleanedAdditions]));
    if (merged.length > 0) {
        frontmatter[key] = merged;
    }
}

/**
 * Parses a model's frontmatter suggestion into a plain object, or `null` if it isn't a usable
 * YAML mapping. Defends against the model wrapping its output in `---` fences or a ```yaml code
 * block even though it is asked for a bare YAML block.
 */
export function parseFrontmatterYaml(modelOutput: string): Record<string, unknown> | null {
    const cleaned = modelOutput
        .trim()
        .replace(/^```(?:ya?ml)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .replace(/^---\s*\n/, "")
        .replace(/\n---\s*$/, "")
        .trim();

    if (cleaned === "") {
        return null;
    }

    try {
        const parsed: unknown = parseYaml(cleaned);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return null;
        }
        return parsed as Record<string, unknown>;
    } catch {
        return null; // Malformed YAML from the model — leave the note untouched
    }
}

/**
 * Merges suggested frontmatter fields into `frontmatter` in place. List-valued fields
 * (tags/aliases/cssclasses) are unioned (existing entries kept) and normalised to clean arrays;
 * all other fields are only added when the note doesn't already have a value.
 */
export function mergeFrontmatterFields(frontmatter: Record<string, unknown>, suggested: Record<string, unknown>): void {
    const listKeys = new Set(["tags", "aliases", "cssclasses"]);

    for (const [key, value] of Object.entries(suggested)) {
        if (value === null || value === undefined) {
            continue;
        }

        if (listKeys.has(key)) {
            mergeListIntoFrontmatter(frontmatter, key, normaliseFrontmatterList(value));
            continue;
        }

        if (!(key in frontmatter) || frontmatter[key] === null || frontmatter[key] === undefined || frontmatter[key] === "") {
            frontmatter[key] = value;
        }
    }
}

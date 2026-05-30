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
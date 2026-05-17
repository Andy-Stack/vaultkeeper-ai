import type VaultkeeperAIPlugin from "main";
import path from "path-browserify";

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
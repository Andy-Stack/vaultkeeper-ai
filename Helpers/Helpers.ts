import type VaultAIPlugin from "main";

export function openPluginSettings(plugin: VaultAIPlugin) {
    // @ts-ignore - accessing internal API
    plugin.app.setting.open();
    // @ts-ignore - accessing internal API
    plugin.app.setting.openTabById(plugin.manifest.id);
}

export function isValidJson(str: string): boolean {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export function dateToString(date: Date, includeTime: boolean = true): string {
    if (includeTime) {
        return date.toLocaleString('sv-SE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(/[:\s]/g, '-');
    } else {
        return date.toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/[:\s]/g, '-');
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

export function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
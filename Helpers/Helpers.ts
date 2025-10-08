import type AIAgentPlugin from "main";

export function openPluginSettings(plugin: AIAgentPlugin) {
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
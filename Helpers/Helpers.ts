import { type Vault } from "obsidian";

export function isValidJson(str: string): boolean {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export function loadExternalCSS(href: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = reject;
        document.head.appendChild(link);
    });
}

export function dateToString(date: Date): string {
    return date.toLocaleString('sv-SE', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    }).replace(/[:\s]/g, '-');
}
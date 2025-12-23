import { setIcon } from "obsidian";

export function getOuterHeight(element: HTMLElement): number {
    const marginTop = parseFloat(getComputedStyle(element).marginTop) || 0;
    const marginBottom = parseFloat(getComputedStyle(element).marginBottom) || 0;
    return element.offsetHeight + marginTop + marginBottom;
}

export function setElementIcon(element: HTMLDivElement, iconName: string) {
    if (element) {
        setIcon(element, iconName);
    }
    return {
        update(newIconName: string) {
            if (element) {
                setIcon(element, newIconName);
            }
        }
    };
}
export function getOuterHeight(element: HTMLElement): number {
    const marginTop = parseFloat(getComputedStyle(element).marginTop) || 0;
    const marginBottom = parseFloat(getComputedStyle(element).marginBottom) || 0;
    return element.offsetHeight + marginTop + marginBottom;
}
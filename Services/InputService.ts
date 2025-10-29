export class InputService {

    public getCursorPosition(element: HTMLElement): number {
        const selection = window.getSelection();
    
        if (!selection || selection.rangeCount === 0) {
            return 0;
        }
    
        const range = selection.getRangeAt(0);
    
        if (!element.contains(range.commonAncestorContainer)) {
            return 0;
        }
    
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
    
        return preCaretRange.toString().length;
    }
    
    public setCursorPosition(element: HTMLElement, position: number): void {
        const textContent = element.textContent || "";
        const clampedPosition = Math.max(0, Math.min(position, textContent.length));
    
        const nodeAndOffset = this.getTextNodeAtPosition(element, clampedPosition);
    
        if (nodeAndOffset) {
            const range = document.createRange();
            const selection = window.getSelection();
    
            if (selection) {
                range.setStart(nodeAndOffset.node, nodeAndOffset.offset);
                range.setEnd(nodeAndOffset.node, nodeAndOffset.offset);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }
    
    public getCharacterAtPosition(position: number, element: HTMLElement): string {
        const text = element.textContent || "";
        if (position < 0 || position > text.length) {
            return "";
        }
        return text.charAt(position);
    }
    
    /**
     * Checks if a keyboard key represents a printable character
     * @param key The key from KeyboardEvent.key
     * @param ctrlKey Whether Ctrl/Cmd is pressed
     * @param metaKey Whether Meta/Cmd is pressed
     * @returns true if the key is a printable character
     */
    public isPrintableKey(key: string, ctrlKey: boolean = false, metaKey: boolean = false): boolean {
        // Control or meta keys are not printable
        if (ctrlKey || metaKey) {
            return false;
        }
    
        // Single character keys are printable
        if (key.length === 1) {
            return true;
        }
    
        // Special printable keys
        return key === "Enter" || key === "Tab";
    }
    
    /**
     * Checks if cursor is in a valid search zone (after the trigger position)
     * @param currentPosition Current cursor position
     * @param triggerPosition Position where search trigger was typed
     * @returns true if cursor is in valid search zone
     */
    public isInSearchZone(currentPosition: number, triggerPosition: number): boolean {
        return currentPosition > triggerPosition;
    }
    
    public getPlainTextFromClipboard(clipboardData: DataTransfer | null): string {
        if (!clipboardData) {
            return "";
        }
        return clipboardData.getData('text/plain') || "";
    }
    
    public stripHtml(html: string): string {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || "";
    }
    
    public insertTextAtCursor(text: string): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }
    
        const range = selection.getRangeAt(0);
        range.deleteContents();
    
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
    
        // Move cursor to end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    public getTextNodeAtPosition(node: Node, targetPosition: number): { node: Node; offset: number } | null {
        if (node.nodeType === Node.TEXT_NODE) {
            return { node, offset: targetPosition };
        }
    
        let currentPosition = 0;
    
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
    
            if (child.nodeType === Node.TEXT_NODE) {
                const textLength = child.textContent?.length || 0;
    
                if (currentPosition + textLength >= targetPosition) {
                    return { node: child, offset: targetPosition - currentPosition };
                }
    
                currentPosition += textLength;
            } else {
                const childTextLength = child.textContent?.length || 0;
    
                if (currentPosition + childTextLength >= targetPosition) {
                    return this.getTextNodeAtPosition(child, targetPosition - currentPosition);
                }
    
                currentPosition += childTextLength;
            }
        }
    
        return null;
    }

}
import { SearchTrigger } from "../Enums/SearchTrigger";

export class InputService {

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

    public isInSearchZone(currentPosition: number, triggerPosition: number): boolean {
        return currentPosition > triggerPosition;
    }

    public getNodeAtCursorPosition(): Node | null {
        const selection = window.getSelection() ?? new Selection();
        const node = selection.anchorNode;
        return node ? node.nodeType == 3 ? node.parentNode : node : null;
     }

    public getCursorPosition(element: HTMLElement): number {
        const selection = window.getSelection() || new Selection();
        
        if (selection.rangeCount === 0) {
            return -1;
        }
        
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(element);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        
        return preSelectionRange.toString().length;
    }
    
    public setCursorPosition(element: HTMLElement, position: number, fromEnd: boolean = false) {
        // Ensure element is focusable
        if (!element.isContentEditable) {
            console.warn("Element must be contenteditable");
            return false;
        }
        
        // Get text content for position calculation
        const textContent = element.textContent || element.innerText || "";
        const maxPosition = textContent.length;
        
        // Calculate actual position
        let targetPosition;
        if (fromEnd) {
            targetPosition = Math.max(0, maxPosition - position);
        } else {
            targetPosition = Math.min(position, maxPosition);
        }
        
        try {
            // Create range and selection
            const range = document.createRange();
            const selection = window.getSelection() ?? new Selection();
            
            // Find the text node and position
            const result = this.findTextNodeAndOffset(element, targetPosition);
            
            if (result.node) {
                range.setStart(result.node, result.offset);
                range.setEnd(result.node, result.offset);
                
                // Clear existing selection and apply new range
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Focus the element
                element.focus();
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error("Error setting cursor position:", error);
            return false;
        }
    }
    
    public getCharacterAtPosition(position: number, element: HTMLElement): string {
        const text = element.textContent || "";
        if (position < 0 || position > text.length) {
            return "";
        }
        return text.charAt(position);
    }

    public deleteTextRange(startPos: number, endPos: number, element: HTMLElement): void {
        if (!element.isContentEditable) {
            console.warn("Element must be contenteditable");
            return;
        }

        const selection = window.getSelection();
        if (!selection) {
            return;
        }

        try {
            const range = document.createRange();

            // Find the text nodes and offsets for start and end positions
            const startResult = this.findTextNodeAndOffset(element, startPos);
            const endResult = this.findTextNodeAndOffset(element, endPos);

            if (!startResult.node || !endResult.node) {
                console.warn("Could not find text nodes for range deletion");
                return;
            }

            // Set the range to span from start to end position
            range.setStart(startResult.node, startResult.offset);
            range.setEnd(endResult.node, endResult.offset);

            // Delete the range contents
            range.deleteContents();

            // Set cursor to where deletion occurred
            this.setCursorPosition(element, startPos);
        } catch (error) {
            console.error("Error deleting text range:", error);
        }
    }

    public getPlainTextFromClipboard(clipboardData: DataTransfer | null): string {
        if (!clipboardData) {
            return "";
        }
        return clipboardData.getData("text/plain") || "";
    }
    
    public stripHtml(html: string): string {
        const temp = document.createElement("div");
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || "";
    }
    
    public insertTextAtCursor(text: string, element?: HTMLElement): void {
        if (element && !element.isContentEditable) {
            console.warn("Element must be contenteditable");
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    public insertElementAtCursor(node: Node, element?: HTMLElement): void {
        if (element && !element.isContentEditable) {
            console.warn("Element must be contenteditable");
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();

        // Insert the node
        range.insertNode(node);

        // Move cursor to end of inserted element
        range.setStartAfter(node);
        range.setEndAfter(node);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    public getPreviousNode(): Node | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);

        if (!range.collapsed) {
            return null;
        }

        let nodeBefore: Node | null = null;

        if (range.startContainer.nodeType !== Node.TEXT_NODE) {
            if (range.startOffset > 0) {
                nodeBefore = range.startContainer.childNodes[range.startOffset - 1];
            }
        }

        if (nodeBefore  && SearchTrigger.isSearchTriggerElement(nodeBefore)) {
            return nodeBefore;
        }

        return null;
    }

    private findTextNodeAndOffset(element: HTMLElement, targetPosition: number): { node: Node | null; offset: number } {
        let currentPosition = 0;

        function traverse(node: Node): { node: Node | null; offset: number } {
            // If it"s a text node, check if target position falls within it
            if (node.nodeType === Node.TEXT_NODE) {
                const textLength = node.textContent?.length || 0;

                if (currentPosition + textLength >= targetPosition) {
                    // Found the target text node
                    const offset = targetPosition - currentPosition;
                    return { node: node, offset: offset };
                }

                currentPosition += textLength;
            } else {
                // Recursively check child nodes
                for (let index = 0; index < node.childNodes.length; index++) {
                    const result = traverse(node.childNodes[index]);
                    if (result.node) {
                        return result;
                    }
                }
            }

            return { node: null, offset: 0 };
        }

        return traverse(element);
    }

    public hasUnauthorizedHTML(element: HTMLElement): boolean {
        const checkNode = (node: Node): boolean => {
            if (node.nodeType === Node.TEXT_NODE) {
                return false;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;

                if (SearchTrigger.isSearchTriggerElement(node)) {
                    return false;
                }

                // Allow BR tags (browsers auto-insert these in contentEditable)
                if (el.tagName === "BR") {
                    return false;
                }

                // Allow DIV tags (browsers wrap content in divs) - but check their children recursively
                if (el.tagName === "DIV") {
                    // Recursively check all children of the div
                    return Array.from(el.childNodes).some(checkNode);
                }
            }
            return true;
        };

        return Array.from(element.childNodes).some(checkNode);
    }

    public sanitizeToPlainText(element: HTMLElement): void {
        const plainText = element.textContent || "";
        const cursorPos = this.getCursorPosition(element);

        element.textContent = plainText;

        // Restore cursor position after sanitization
        this.setCursorPosition(element, cursorPos);
    }

}
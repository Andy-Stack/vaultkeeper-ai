import { SearchTrigger } from "../Enums/SearchTrigger";

export class InputService {

    public getPlainTextFromClipboard(clipboardData: DataTransfer | null): string {
        if (!clipboardData) {
            return "";
        }
        return clipboardData.getData("text/plain") || "";
    }

    public sanitizeToPlainText(element: HTMLElement): void {
        const plainText = element.textContent || "";
        const cursorPos = this.getCursorPosition(element);

        element.textContent = plainText;

        // Restore cursor position after sanitization
        this.setCursorPosition(element, cursorPos);
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

    public isInSearchZone(currentPosition: number, triggerPosition: number): boolean {
        return currentPosition > triggerPosition;
    }

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

    public getElementBeforeCursor(element: HTMLElement): HTMLElement | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
            return null; // Selection is not collapsed, not at a single cursor position
        }

        const node = range.startContainer;
        const offset = range.startOffset;

        // If we're in a text node
        if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            const textContent = textNode.textContent || "";

            // Check if we're at the start of a text node (offset === 0)
            if (offset === 0) {
                const previousSibling = node.previousSibling;
                if (previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE) {
                    return previousSibling as HTMLElement;
                }

                // If no previous sibling, the text node might be the first child
                // We need to check if the parent has any element children before this text node
                const parent = node.parentNode;
                if (parent && parent !== element) {
                    const siblings = Array.from(parent.childNodes);
                    const myIndex = siblings.findIndex(n => n === node);

                    // Check if there's an element before us in the parent
                    if (myIndex > 0) {
                        const prevChild = siblings[myIndex - 1];
                        if (prevChild.nodeType === Node.ELEMENT_NODE) {
                            return prevChild as HTMLElement;
                        }
                    }

                    // If still nothing, check parent's previous sibling
                    let currentParent: Node | null = parent;
                    while (currentParent && currentParent !== element) {
                        const prevSibling = currentParent.previousSibling;
                        if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
                            return prevSibling as HTMLElement;
                        }
                        currentParent = currentParent.parentNode;
                    }
                }
                return null;
            }

            // Special case: Browser may insert empty or whitespace-only text nodes around
            // contenteditable="false" elements when navigating with arrow keys.
            // If we're in such a node (very short, mostly whitespace), and the previous
            // sibling is an element, we might be logically positioned right after it.
            if (textContent.trim().length === 0 && textContent.length <= 2) {
                const previousSibling = node.previousSibling;
                if (previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE) {
                    const prevElement = previousSibling as HTMLElement;
                    // Check if it's a non-editable element (like our search triggers)
                    if (prevElement.contentEditable === "false" ||
                        prevElement.getAttribute("contenteditable") === "false") {
                        return prevElement;
                    }
                }
            }

            // If we're in a text node with offset > 0 and not in a special case,
            // we're not next to an element
            return null;
        }

        // If we're in an element node, check the child before the offset
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (offset > 0) {
                // Search backwards from offset to find the nearest non-editable element.
                // This handles the case where arrow key navigation positions the cursor
                // after a contenteditable="false" element with text nodes in between.
                for (let i = offset - 1; i >= 0; i--) {
                    const child = node.childNodes[i];

                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const childElement = child as HTMLElement;

                        // Check if this element is a non-editable search trigger
                        if (childElement.contentEditable === "false" ||
                            childElement.getAttribute("contenteditable") === "false") {
                            return childElement;
                        }

                        // If we found an editable element immediately before the cursor,
                        // return its deepest rightmost child
                        if (i === offset - 1) {
                            return this.getDeepestRightmostElement(childElement);
                        }

                        // Otherwise, stop searching - we found an editable element in between
                        break;
                    }
                }
            }

            // Also check if we're at the start (offset === 0) of an element
            // and there's a previous sibling element
            if (offset === 0) {
                const previousSibling = node.previousSibling;
                if (previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE) {
                    return previousSibling as HTMLElement;
                }
            }
        }

        return null;
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
            
            // Validate and fix cursor position if it ended up in a non-editable element
            this.ensureCursorNotInNonEditableElement(element);
            
        } catch (error) {
            console.error("Error deleting text range:", error);
        }
    }
    
    /**
     * Gets the deepest rightmost element in a tree, which is what the cursor
     * would be "after" when positioned after this element.
     */
    private getDeepestRightmostElement(element: HTMLElement): HTMLElement {
        let current = element;
        while (current.lastChild && current.lastChild.nodeType === Node.ELEMENT_NODE) {
            current = current.lastChild as HTMLElement;
        }
        return current;
    }

    /**
     * Ensures the cursor is not positioned inside a contentEditable="false" element.
     * If it is, repositions the cursor to a valid location.
     */
    private ensureCursorNotInNonEditableElement(element: HTMLElement): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }
        
        const range = selection.getRangeAt(0);
        let node: Node | null = range.startContainer;
        
        // Walk up the tree to check if we're inside a non-editable element
        while (node && node !== element) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const elem = node as HTMLElement;
                if (elem.contentEditable === "false" || elem.getAttribute("contenteditable") === "false") {
                    // Found a non-editable ancestor - reposition cursor after it
                    this.positionCursorAfterElement(elem, element);
                    return;
                }
            }
            node = node.parentNode;
        }
    }
    
    /**
     * Positions the cursor immediately after the given element.
     */
    private positionCursorAfterElement(targetElement: HTMLElement, container: HTMLElement): void {
        const selection = window.getSelection();
        if (!selection) {
            return;
        }
        
        try {
            const range = document.createRange();
            
            // Try to position cursor in the next text node or after the element
            const nextSibling = targetElement.nextSibling;
            if (nextSibling) {
                if (nextSibling.nodeType === Node.TEXT_NODE) {
                    range.setStart(nextSibling, 0);
                    range.setEnd(nextSibling, 0);
                } else {
                    range.setStartBefore(nextSibling);
                    range.setEndBefore(nextSibling);
                }
            } else {
                // No next sibling, position after the element
                range.setStartAfter(targetElement);
                range.setEndAfter(targetElement);
            }
            
            selection.removeAllRanges();
            selection.addRange(range);
            container.focus();
        } catch (error) {
            console.error("Error positioning cursor:", error);
        }
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

}
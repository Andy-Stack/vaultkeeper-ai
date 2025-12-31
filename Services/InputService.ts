import { Exception } from "Helpers/Exception";
import { isSearchTriggerElement } from "../Enums/SearchTrigger";
import { Attachment } from "Conversations/Attachment";
import { arrayBufferToBase64 } from "obsidian";
import { FileTypeToMimeType } from "Enums/FileTypeMimeTypeMapping";
import * as path from "path-browserify";
import { pathExtname } from "Helpers/Helpers";
import { FileType, toFileType } from "Enums/FileType";
import type { FileSystemService } from "./FileSystemService";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";

export class InputService {

    private readonly fileSystemService: FileSystemService;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
    }

    public getTextFromDataTransfer(dataTransfer: DataTransfer | null): string {
        if (!dataTransfer) {
            return "";
        }
        return dataTransfer.getData("text/plain") || "";
    }

    public async getFilesFromDataTransfer(dataTransfer: DataTransfer | null): Promise<Attachment[]> {
        const attachments: Attachment[] = [];

        if (!dataTransfer) {
            return attachments;
        }

        // files from external source (dragged from outside Obsidian)
        const files = dataTransfer.files;
        if (files) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                attachments.push(new Attachment(
                    file.name,
                    FileTypeToMimeType[toFileType(pathExtname(file.name))],
                    arrayBufferToBase64(await file.arrayBuffer())
                ));
            }
        }

        // get text as sometimes uri's come through as plain text
        const textUriList = this.getTextFromDataTransfer(dataTransfer);
        const uriList = dataTransfer.getData("text/uri-list");

        const allUris = `${uriList}\n${textUriList}`.split("\n").map(uri => uri.trim())
            .filter(uri => uri.length > 0 && !uri.startsWith("#"));

        const uris = this.removeDuplicateUris(allUris);

        for (const uri of uris) {
            try {
                const url = new URL(uri);
                const fileParam = url.searchParams.get("file");
                
                if (fileParam) {
                    let filePath = decodeURIComponent(fileParam);

                    let extension = pathExtname(filePath);
                    // Obsidian doesn't include extension for markdown files 
                    if (extension.trim() === "") {
                        extension = FileType.MD;
                        filePath = `${filePath}.${extension}`;
                    }

                    const arrayBuffer = await this.fileSystemService.readBinaryFile(filePath);

                    if (arrayBuffer instanceof ArrayBuffer) {
                        attachments.push(new Attachment(
                            path.basename(filePath),
                            FileTypeToMimeType[toFileType(extension)],
                            arrayBufferToBase64(arrayBuffer)
                        ));
                    }
                }
            } catch (error) {
                Exception.warn(error); // Just a warning as some pasted content seem to give nonsense URIs
            }
        }

        return attachments;
    }

    public sanitizeToPlainText(element: HTMLElement) {
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

                if (isSearchTriggerElement(node)) {
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
            Exception.log(error);
            return false;
        }
    }


    public insertTextAtCursor(text: string, element?: HTMLElement) {
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

    public insertElementAtCursor(node: Node, element?: HTMLElement) {
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
    
    public deleteTextRange(startPos: number, endPos: number, element: HTMLElement) {
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
            Exception.log(error);
        }
    }
    
    /**
     * Ensures the cursor is not positioned inside a contentEditable="false" element.
     * If it is, repositions the cursor to a valid location.
     */
    private ensureCursorNotInNonEditableElement(element: HTMLElement) {
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
    private positionCursorAfterElement(targetElement: HTMLElement, container: HTMLElement) {
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
            Exception.log(error);
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

    private removeDuplicateUris(uris: string[]): string[] {
        const seenFiles = new Set<string>();
        const uniqueUris: string[] = [];

        for (const uri of uris) {
            try {
                const url = new URL(uri);
                const fileParam = url.searchParams.get("file");

                if (fileParam) {
                    // Normalize by decoding the file parameter to handle different URL encodings
                    const normalizedFile = decodeURIComponent(fileParam);

                    if (!seenFiles.has(normalizedFile)) {
                        seenFiles.add(normalizedFile);
                        uniqueUris.push(uri);
                    }
                } else {
                    // If no file parameter, include the URI anyway
                    uniqueUris.push(uri);
                }
            } catch {
                // If URL parsing fails, include the URI anyway
                uniqueUris.push(uri);
            }
        }

        return uniqueUris;
    }

}
import { Exception } from "./Exception";

export abstract class StringTools {

    public static isValidJson(str: string): boolean {
        try {
            JSON.parse(str);
        } catch {
            return false;
        }
        return true;
    }

    public static dateToString(date: Date, includeTime: boolean = true): string {
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

    // Derives a filename from the first non-empty line stripped of punctuation (hyphens kept), truncated at a word boundary.
    public static deriveFileName(text: string, maxLength: number = 40, fallback: string = "Pasted text"): string {
        const firstLine = text.split(/\r?\n/).find(line => line.trim().length > 0) ?? "";

        const sanitized = firstLine
            .trim()
            .replace(/[^\p{L}\p{N}\s-]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (!sanitized) {
            return fallback;
        }

        if (sanitized.length <= maxLength) {
            return sanitized;
        }

        const truncated = sanitized.slice(0, maxLength);
        const lastSpace = truncated.lastIndexOf(" ");

        return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim();
    }

    public static toBase64(text: string): string {
        const bytes = new TextEncoder().encode(text);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    public static toBytes(input: string): Uint8Array {
        return new Uint8Array(this.toBuffer(input));
    }

    public static toBuffer(input: string): ArrayBuffer {
        const binaryString = atob(input);
        const buffer = new ArrayBuffer(binaryString.length);
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return buffer;
    }

    public static async computeSHA256Hash(base64: string): Promise<string> {
        const buffer = this.toBuffer(base64);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    public static async resizeB64Image(base64: string, mimeType: string, maxWidth: number = 1000, maxHeight: number = 1000): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    const aspectRatio = width / height;
                    if (width > height) {
                        width = maxWidth;
                        height = maxWidth / aspectRatio;
                    } else {
                        height = maxHeight;
                        width = maxHeight * aspectRatio;
                    }
                }

                const canvas = createEl("canvas");
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext("2d");

                if (!context) {
                    reject(Exception.new("Failed to get canvas context"));
                    return;
                }

                context.drawImage(img, 0, 0, width, height);

                const dataURL = canvas.toDataURL(mimeType, 0.92);
                const base64Only = dataURL.split(',')[1];
                resolve(base64Only);
            };

            img.onerror = () => reject(Exception.new("Failed to load image"));

            if (!base64.startsWith('data:')) {
                base64 = `data:${mimeType};base64,${base64}`;
            }
            img.src = base64;
        });
    }

} 
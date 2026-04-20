import { Exception } from "./Exception";

export abstract class StringTools {

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment -- regex-parser is a CommonJS module without ESM support
    private static RegexParser: (input: string) => RegExp = require("regex-parser");

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

    public static escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // Builds a regex from a string that matches flexibly on whitespace but strictly on all other characters.
    public static toWhitespaceFlexibleRegex(input: string): RegExp {
        const pattern = this.escapeRegex(input).replace(/(\\\s|\s)+/g, "\\s+");
        return new RegExp(pattern);
    }

    public static asRegex(input: string, requiredFlags: string[]): RegExp | null {
        let regex: RegExp;

        try {
            regex = this.RegexParser(input);
            let flags = regex.flags;

            for (const requiredFlag of requiredFlags) {
                if (!flags.includes(requiredFlag)) {
                    flags = flags + requiredFlag;
                }
            }

            regex = new RegExp(regex.source, flags);
        } catch {
            try { // If parsing fails, escape the input and use required flags
                regex = new RegExp(StringTools.escapeRegex(input), requiredFlags.join(""));
            } catch {
                return null;
            }
        }

        return regex;
    }

    public static toBase64(text: string): string {
        const bytes = new TextEncoder().encode(text);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    public static toBytes(input: string): Uint8Array<ArrayBuffer> {
        const binaryString = atob(input);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    public static async computeSHA256Hash(base64: string): Promise<string> {
        const bytes = this.toBytes(base64);
        const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
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

                const canvas = activeDocument.createElement("canvas");
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
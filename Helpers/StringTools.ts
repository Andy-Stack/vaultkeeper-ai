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

    public static toBytes(input: string): Uint8Array<ArrayBuffer> {
        const binaryString = atob(input);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

} 
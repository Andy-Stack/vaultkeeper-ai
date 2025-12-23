import type { AIProvider } from "Enums/ApiProvider";

export class Attachment {
    
    public fileName: string;
    public mimeType: string;
    public base64: string;
    public fileID: Partial<Record<AIProvider, string>>;

    constructor(
        fileName: string,
        mimeType: string,
        base64: string,
        fileID: Partial<Record<AIProvider, string>> = {}
    ) {
        this.fileName = fileName;
        this.mimeType = mimeType;
        this.base64 = base64;
        this.fileID = fileID;
    }
    
    public getFileID(provider: AIProvider): string | undefined {
        return this.fileID[provider];
    }
    
    public setFileID(provider: AIProvider, id: string): void {
        this.fileID[provider] = id;
    }
    
    public deleteFileID(provider: AIProvider): boolean {
        if (provider in this.fileID) {
            delete this.fileID[provider];
            return true;
        }
        return false;
    }

    public approximateFileSizeMB() {
        // get the approximate MB size of the base64 string rounded to 2 decimal places
        const paddingBytes = this.base64.endsWith("==") ? 2 : this.base64.endsWith("=") ? 1 : 0;
        const byteSize = (this.base64.length * 3 / 4) - paddingBytes;
        const megaByteSize = byteSize / 1000000;
        return Math.round((megaByteSize + Number.EPSILON) * 100) / 100;
    }

    public static isAttachmentData(this: void, data: unknown): data is {
        fileName: string;
        mimeType: string;
        base64: string;
        fileID?: Partial<Record<AIProvider, string>>;
    } {
        return (
            data !== null &&
            typeof data === "object" &&
            "fileName" in data &&
            "mimeType" in data &&
            "base64" in data &&
            typeof data.fileName === "string" &&
            typeof data.mimeType === "string" &&
            typeof data.base64 === "string" &&
            (!("fileID" in data) || typeof data.fileID === "object")
        );
    }
}
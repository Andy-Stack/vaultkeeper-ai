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
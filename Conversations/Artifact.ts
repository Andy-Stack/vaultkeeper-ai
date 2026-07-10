import type { IBinaryFile } from "Conversations/IBinaryFile";

export class Artifact implements IBinaryFile {

    public filePath: string;
    public mimeType: string;
    public originalContent: string;
    public updatedContent: string;
    public base64: string | undefined;
    public artifactPath?: string;

    public constructor(filePath: string, mimeType: string, originalContent: string, updatedContent: string, base64?: string, artifactPath?: string) {
        this.filePath = filePath;
        this.mimeType = mimeType;
        this.originalContent = originalContent;
        this.updatedContent = updatedContent;
        this.base64 = base64;
        this.artifactPath = artifactPath;
    }

    public getStoragePath(): string | undefined {
        return this.artifactPath;
    }

    public setStoragePath(path: string): void {
        this.artifactPath = path;
    }

    public static isArtifactData(this: void, data: unknown): data is {
        filePath: string;
        mimeType: string;
        originalContent: string;
        updatedContent: string;
        base64?: string;
        artifactPath?: string;
    } {
        return (
            data !== null &&
            typeof data === "object" &&
            "filePath" in data &&
            typeof data.filePath === "string" &&
            "mimeType" in data &&
            typeof data.mimeType === "string" &&
            "originalContent" in data &&
            typeof data.originalContent === "string" &&
            "updatedContent" in data &&
            typeof data.updatedContent === "string" &&
            (!("base64" in data) || typeof data.base64 === "string") &&
            (!("artifactPath" in data) || typeof data.artifactPath === "string")
        );
    }

}
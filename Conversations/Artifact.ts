import type { IBinaryFile } from "Conversations/IBinaryFile";
import { ARTIFACT_ACTION_RANK, isArtifactAction, type ArtifactAction } from "Enums/ArtifactAction";
import { isAudioFile, isImageFile, isKnownFileType, isTextFile, isVideoFile } from "Enums/FileType";
import { pathExtname } from "Helpers/Helpers";
import { basename } from "path-browserify";

export class Artifact implements IBinaryFile {

    public filePath: string;
    public mimeType: string;
    public action: ArtifactAction;
    public originalContent: string;
    public updatedContent: string;
    public base64: string | undefined;
    public artifactPath?: string;

    public static sort(artifacts: Artifact[]): Artifact[] {
        artifacts.sort((a, b) =>
            ARTIFACT_ACTION_RANK[a.action] - ARTIFACT_ACTION_RANK[b.action] ||
            basename(a.filePath).localeCompare(basename(b.filePath))
        );
        return artifacts;
    }

    public constructor(filePath: string, mimeType: string, action: ArtifactAction, originalContent: string, updatedContent: string, base64?: string, artifactPath?: string) {
        this.filePath = filePath;
        this.mimeType = mimeType;
        this.action = action;
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

    public getIconName(): string {
        const extension = pathExtname(this.filePath);

        if (isTextFile(extension)) {
            return "file-text";
        }
        if (isImageFile(extension)) {
            return "file-image";
        }
        if (isAudioFile(extension)) {
            return "file-music";
        }
        if (isVideoFile(extension)) {
            return "file-play";
        }
        if (isKnownFileType(extension)) {
            return "file";
        }
        return "file";
    }

    public static isArtifactData(this: void, data: unknown): data is {
        filePath: string;
        mimeType: string;
        action: ArtifactAction;
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
            "action" in data &&
            typeof data.action === "string" &&
            isArtifactAction(data.action) &&
            "originalContent" in data &&
            typeof data.originalContent === "string" &&
            "updatedContent" in data &&
            typeof data.updatedContent === "string" &&
            (!("base64" in data) || typeof data.base64 === "string") &&
            (!("artifactPath" in data) || typeof data.artifactPath === "string")
        );
    }

}
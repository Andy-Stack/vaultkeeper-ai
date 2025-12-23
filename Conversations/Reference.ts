import { isAudioFile, isImageFile, isKnownFileType, isTextFile, isVideoFile } from "Enums/FileType";
import { pathExtname } from "Helpers/Helpers";

export class Reference {

    public fileName: string;
    public size: number;

    public constructor(fileName: string, size: number) {
        this.fileName = fileName;
        this.size = size;
    }

    public getIconName(): string {
        const extension = pathExtname(this.fileName);

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

    public static isReferenceData(this: void, data: unknown): data is {
        fileName: string;
        size: number;
    } {
        return (
            data !== null &&
            typeof data === "object" &&
            "fileName" in data &&
            "size" in data &&
            typeof data.fileName === "string" &&
            typeof data.size === "number"
        );
    }
}
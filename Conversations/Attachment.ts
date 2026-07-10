import type { AIProvider } from "Enums/ApiProvider";
import { isAudioFile, isImageFile, isKnownFileType, isTextFile, isVideoFile } from "Enums/FileType";
import { MimeTypeToFileTypes } from "Enums/FileTypeMimeTypeMapping";
import { isImageMimeType, isTextMimeType, MimeType, toMimeType } from "Enums/MimeType";
import { StringTools } from "Helpers/StringTools";
import type { IBinaryFile } from "Conversations/IBinaryFile";

export class Attachment implements IBinaryFile {

    public fileName: string;
    public mimeType: string;
    public fileID: Partial<Record<AIProvider, string>>;
    public base64: string;
    public filePath?: string;

    constructor(
        fileName: string,
        mimeType: string,
        base64: string,
        fileID: Partial<Record<AIProvider, string>> = {},
        filePath?: string
    ) {
        this.fileName = fileName;
        this.mimeType = mimeType;
        this.fileID = fileID;
        this.base64 = base64;
        this.filePath = filePath;
    }

    public getMimeType(): string {
        const mimeTypeEnum = toMimeType(this.mimeType);
        if (isTextMimeType(mimeTypeEnum)) {
            return MimeType.TEXT_PLAIN;
        }
        return this.mimeType;
    }

    public async getBase64(): Promise<string> {
        if (isImageMimeType(toMimeType(this.mimeType))) {
            return await StringTools.resizeB64Image(this.base64, this.mimeType);
        }
        return this.base64;
    }
    
    public getStoragePath(): string | undefined {
        return this.filePath;
    }

    public setStoragePath(path: string): void {
        this.filePath = path;
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

    public getIconName(): string {
		const fileTypes = MimeTypeToFileTypes[toMimeType(this.mimeType)];

		if (fileTypes.some((fileType) => isTextFile(fileType))) {
			return "file-text";
		}
		if (fileTypes.some((fileType) => isImageFile(fileType))) {
			return "file-image";
		}
		if (fileTypes.some((fileType) => isAudioFile(fileType))) {
			return "file-music";
		}
		if (fileTypes.some((fileType) => isVideoFile(fileType))) {
			return "file-play";
		}
		if (fileTypes.some((fileType) => isKnownFileType(fileType))) {
			return "file";
		}
		return "file";
	}

    public static isAttachmentData(this: void, data: unknown): data is {
        fileName: string;
        mimeType: string;
        filePath: string;
        fileID?: Partial<Record<AIProvider, string>>;
    } {
        return (
            data !== null &&
            typeof data === "object" &&
            "fileName" in data &&
            "mimeType" in data &&
            "filePath" in data &&
            typeof data.fileName === "string" &&
            typeof data.mimeType === "string" &&
            typeof data.filePath === "string" &&
            (!("fileID" in data) || typeof data.fileID === "object")
        );
    }
}
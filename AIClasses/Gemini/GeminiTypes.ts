interface GeminiFile {
    name: string;
    displayName?: string;
    mimeType: string;
    sizeBytes: string;
    createTime: string;
    updateTime: string;
    expirationTime: string;
    sha256Hash: string;
    uri: string;
    state: "STATE_UNSPECIFIED" | "PROCESSING" | "ACTIVE" | "FAILED";
    videoMetadata?: {
        videoDuration: string;
    };
}

interface GeminiListFilesResponse {
    files?: GeminiFile[];
    nextPageToken?: string;
}

interface GeminiUploadResponse {
    file: GeminiFile;
}
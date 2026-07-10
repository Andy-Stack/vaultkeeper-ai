export interface IBinaryFile {
    base64: string | undefined;
    getStoragePath(): string | undefined;
    setStoragePath(path: string): void;
}

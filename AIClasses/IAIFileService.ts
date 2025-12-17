export interface IAIFileService {
    listFiles(): Promise<string[]>;
    uploadFile(data: string, mimeType: string, displayName?: string): Promise<string>;
    deleteFile(id: string): Promise<void>;
}
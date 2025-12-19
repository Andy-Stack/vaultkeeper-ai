import type { Attachment } from "Conversations/Attachment";

export interface IAIFileService {
    refreshCache(): Promise<void>;
    listFiles(): Promise<string[]>;
    uploadFile(attachment: Attachment): Promise<string>;
    deleteFile(attachment: Attachment): Promise<void>;
}
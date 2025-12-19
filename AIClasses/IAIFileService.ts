import type { Attachment } from "Conversations/Attachment";

export interface IAIFileService {
    refreshCache(): Promise<void>;
    listFiles(): string[];
    uploadFile(attachment: Attachment): Promise<void>;
    deleteFile(attachment: Attachment): Promise<void>;
}
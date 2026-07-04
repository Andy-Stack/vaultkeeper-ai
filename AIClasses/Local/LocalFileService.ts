import type { IAIFileService } from "AIClasses/IAIFileService";
import type { Attachment } from "Conversations/Attachment";
import { AIProvider } from "Enums/ApiProvider";

// Local models have no files API: attachments are always inlined as base64 (see Local.ts formatBinaryFiles).
// uploadFile() is a no-op that stamps a dummy fileID so BaseAIClass.processAttachments' upload-verification check passes.
export class LocalFileService implements IAIFileService {

    private static readonly INLINE_FILE_ID = "inline";

    public refreshCache(): Promise<void> {
        return Promise.resolve();
    }

    public listFiles(): string[] {
        return [];
    }

    public uploadFile(attachment: Attachment): Promise<void> {
        attachment.setFileID(AIProvider.Local, LocalFileService.INLINE_FILE_ID);
        return Promise.resolve();
    }

    public deleteFile(_attachment: Attachment): Promise<void> {
        return Promise.resolve();
    }

}

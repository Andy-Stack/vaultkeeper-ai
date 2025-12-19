import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";

export interface IAIClass {
    streamRequest(conversation: Conversation, allowDestructiveActions: boolean): AsyncGenerator<IStreamChunk, void, unknown>;
    formatBinaryFiles(attachments: Attachment[]): string;
}
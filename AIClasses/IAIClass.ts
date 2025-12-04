import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";

export interface IAIClass {
    streamRequest(conversation: Conversation, allowDestructiveActions: boolean): AsyncGenerator<IStreamChunk, void, unknown>;
}
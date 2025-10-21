import type { StreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";

export interface IAIClass {
    streamRequest(conversation: Conversation, allowDestructiveActions: boolean, abortSignal?: AbortSignal): AsyncGenerator<StreamChunk, void, unknown>;
}
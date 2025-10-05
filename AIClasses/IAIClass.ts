import type { StreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";

export interface IAIClass {
    streamRequest(conversation: Conversation): AsyncGenerator<StreamChunk, void, unknown>;
}
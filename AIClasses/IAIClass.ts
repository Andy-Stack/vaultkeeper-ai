import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";
import type { IAIFunctionDefinition } from "./FunctionDefinitions/IAIFunctionDefinition";

export interface IAIClass {
    set systemPrompt(systemPrompt: string);
    set userInstruction(userInstruction: string);
    set toolDefinitions(toolDefinitions: IAIFunctionDefinition[]);

    streamRequest(conversation: Conversation, isPlanningAgent: boolean): AsyncGenerator<IStreamChunk, void, unknown>;
    formatBinaryFiles(attachments: Attachment[]): string;
}
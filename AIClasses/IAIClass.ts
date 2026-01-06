import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";
import type { IAIFunctionDefinition } from "./FunctionDefinitions/IAIFunctionDefinition";
import type { AIProvider } from "Enums/ApiProvider";

export interface IAIClass {
    get currentProvider(): AIProvider;
    set systemPrompt(systemPrompt: string);
    set userInstruction(userInstruction: string);
    set toolDefinitions(toolDefinitions: IAIFunctionDefinition[]);

    streamRequest(conversation: Conversation, isPlanningAgent: boolean): AsyncGenerator<IStreamChunk, void, unknown>;
    formatBinaryFiles(attachments: Attachment[]): string;
}
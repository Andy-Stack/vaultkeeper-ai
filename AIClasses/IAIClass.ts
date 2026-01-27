import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";
import type { IAIFunctionDefinition } from "./FunctionDefinitions/IAIFunctionDefinition";
import type { AIProvider } from "Enums/ApiProvider";
import type { AgentType } from "Enums/AgentType";

export interface IAIClass {
    get currentProvider(): AIProvider;
    set agentType(agentType: AgentType);
    set systemPrompt(systemPrompt: string);
    set userInstruction(userInstruction: string);
    set toolDefinitions(toolDefinitions: IAIFunctionDefinition[]);

    streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown>;
    formatBinaryFiles(attachments: Attachment[]): string;
}
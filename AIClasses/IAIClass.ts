import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";
import type { IAIToolDefinition } from "./ToolDefinitions/IAIToolDefinition";
import type { AIProvider } from "Enums/ApiProvider";
import type { AgentType } from "Enums/AgentType";
import type { AIToolUsageMode } from "Enums/AIToolUsageMode";

export interface IAIClass {
    get currentProvider(): AIProvider;
    set agentType(agentType: AgentType);
    set systemPrompt(systemPrompt: string);
    set userInstruction(userInstruction: string);
    set aiToolDefinitions(aiToolDefinitions: IAIToolDefinition[]);
    set aiToolUsageMode(mode: AIToolUsageMode);

    streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown>;
    formatBinaryFiles(attachments: Attachment[]): string;
}
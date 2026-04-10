import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { IAIToolDefinition } from "./ToolDefinitions/IAIToolDefinition";
import type { AIProvider } from "Enums/ApiProvider";
import type { AgentType } from "Enums/AgentType";
import type { AIToolUsageMode } from "Enums/AIToolUsageMode";
import type { AIToolCall } from "./AIToolCall";
import type { AIToolResponse } from "./ToolDefinitions/AIToolResponse";

export interface IAIClass {
    get currentProvider(): AIProvider;
    set agentType(agentType: AgentType);
    set systemPrompt(systemPrompt: string);
    set userInstruction(userInstruction: string);
    set aiToolDefinitions(aiToolDefinitions: IAIToolDefinition[]);
    set aiToolUsageMode(mode: AIToolUsageMode);

    streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown>;
    
    // Optional provider-level tool call handler. Called before AIToolService.
    resolveToolCall?(toolCall: AIToolCall): Promise<AIToolResponse | null>;
}
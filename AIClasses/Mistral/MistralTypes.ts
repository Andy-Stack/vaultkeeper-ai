// Mistral-specific API types. The generic Chat Completions request/response/stream
// types live in AIClasses/ChatCompletions/ChatCompletionsTypes.ts.

// Agents API types (web search)
export interface MistralAgentCreateRequest {
    model: string;
    name?: string;
    description?: string;
    instructions?: string;
    tools: Array<{ type: "web_search" | "function" }>;
}

export interface MistralAgentCreateResponse {
    id: string;
    object: "agent";
    created_at: string;
    name: string | null;
    model: string;
}

export type MistralAgentListResponse = MistralAgentCreateResponse[];

export interface MistralConversationRequest {
    agent_id: string;
    inputs: string;
    stream?: boolean;
}

export interface MistralConversationResponse {
    object: "conversation.response";
    conversation_id: string;
    outputs: Array<{
        type: "message.output" | "tool.execution";
        role?: string;
        content?: string | Array<{
            type: "text" | "tool_reference";
            text?: string;
        }>;
    }>;
}

// File API types
export interface MistralFile {
    id: string;
    object: "file";
    bytes: number;
    created_at: number;
    filename: string;
    purpose: string;
}

export interface MistralListFilesResponse {
    data: MistralFile[];
    object: "list";
}

export interface MistralSignedUrlResponse {
    url: string;
    expires_at: string;
}

// Mistral Chat Completions API types

export interface MistralStreamChunk {
    id: string;
    object: "chat.completion.chunk";
    created: number;
    model: string;
    choices: MistralStreamChoice[];
}

export interface MistralStreamChoice {
    index: number;
    delta: MistralDelta;
    finish_reason: string | null;
}

export interface MistralDelta {
    role?: string;
    content?: string;
    tool_calls?: MistralToolCallDelta[];
}

export interface MistralToolCallDelta {
    id?: string;
    type?: "function";
    function?: {
        name?: string;
        arguments?: string;
    };
    index?: number;
}

// Non-streaming response (used for conversation naming)
export interface MistralChatResponse {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: MistralChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface MistralChoice {
    index: number;
    message: {
        role: string;
        content: string | null;
        tool_calls?: MistralToolCall[];
    };
    finish_reason: string;
}

export interface MistralToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

// Tool definition format
export interface MistralToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, object>;
            required?: string[];
        };
    };
}

// Message types for request construction
export interface MistralMessage {
    role: string;
    content: string | MistralContentPart[];
    tool_calls?: MistralToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface MistralContentPart {
    type: "text" | "image_url" | "document_url";
    text?: string;
    image_url?: string;
    document_url?: string;
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

// Shared OpenAI-compatible Chat Completions API types.
// Spoken by Mistral and any future Chat Completions provider (Groq, DeepSeek,
// OpenRouter, Ollama, LM Studio, llama.cpp, ...). Provider-specific extensions
// (e.g. Mistral's Agents/File APIs) live in the provider's own *Types.ts.

export interface ChatCompletionStreamChunk {
    id: string;
    object: "chat.completion.chunk";
    created: number;
    model: string;
    choices: ChatCompletionStreamChoice[];
}

export interface ChatCompletionStreamChoice {
    index: number;
    delta: ChatCompletionDelta;
    finish_reason: string | null;
}

export interface ChatCompletionDelta {
    role?: string;
    content?: string;
    tool_calls?: ChatCompletionToolCallDelta[];
}

export interface ChatCompletionToolCallDelta {
    id?: string;
    type?: "function";
    function?: {
        name?: string;
        arguments?: string;
    };
    index?: number;
}

// Non-streaming response (used for conversation naming)
export interface ChatCompletionResponse {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface ChatCompletionChoice {
    index: number;
    message: {
        role: string;
        content: string | null;
        tool_calls?: ChatCompletionToolCall[];
    };
    finish_reason: string;
}

export interface ChatCompletionToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

// Tool definition format
export interface ChatCompletionToolDefinition {
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
export interface ChatCompletionMessage {
    role: string;
    content: string | ChatCompletionContentPart[];
    tool_calls?: ChatCompletionToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface ChatCompletionContentPart {
    type: "text" | "image_url" | "document_url";
    text?: string;
    image_url?: { url: string };
    document_url?: string;
}

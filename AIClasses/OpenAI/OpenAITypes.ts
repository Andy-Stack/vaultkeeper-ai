import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";

/* SDK types are a bit complicated and verbose so define simpler interfaces */

export interface ResponseEvent {
    type: string;
    [key: string]: unknown;
}

export interface ResponseOutputTextDelta extends ResponseEvent {
    type: "response.output_text.delta";
    delta: string;
}

export interface ResponseFunctionCallArgumentsDone extends ResponseEvent {
    type: "response.function_call_arguments.done";
    item_id: string;
    name: string;
    output_index: number;
    arguments: string;
    sequence_number: number;
}

export interface ResponseOutputItemDone extends ResponseEvent {
    type: "response.output_item.done";
    item_id: string;
    output_index: number;
    item: {
        id: string;
        type: string;
        name?: string;
        call_id?: string;
        arguments?: string;
    };
}

export interface ResponseDone extends ResponseEvent {
    type: "response.done";
    response: {
        id: string;
        status: string;
        output: Array<{
            type?: string;            // "message" | "function_call" | etc.
            role?: string;            // For message items
            content?: string;         // For message items
            name?: string;            // For function_call items
            call_id?: string;         // For function_call items
            arguments?: string;       // For function_call items
        }>;
        output_text?: string;
        usage?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        };
    };
}

export interface ResponseErrorEvent extends ResponseEvent {
    type: "error";
    code: string | null;
    message: string;
    param: string | null;
}

export interface ResponseFailedEvent extends ResponseEvent {
    type: "response.failed";
    response: {
        error: {
            code: string | null;
            message: string;
        } | null;
    };
}

export interface OpenAIFunctionTool {
    type: "function";
    name: string;
    description: string;
    parameters: IAIFunctionDefinition["parameters"];
}

/**
 * Responses API Input Item Types
 * These are the formats that can appear in the input array
 */

// Regular user/assistant message
export interface ResponsesAPIMessageInput {
    role: "user" | "assistant";
    content: string;
}

// Function call item (reconstructed from storage or appended from response.output)
export interface ResponsesAPIFunctionCallInput {
    type: "function_call";
    call_id: string;
    name: string;
    arguments: string; // JSON string
}

// Function call output (result of executing a function)
export interface ResponsesAPIFunctionCallOutputInput {
    type: "function_call_output";
    call_id: string;
    output: string; // JSON string
}

// Union type for all possible input items
export type ResponsesAPIInput =
    | ResponsesAPIMessageInput
    | ResponsesAPIFunctionCallInput
    | ResponsesAPIFunctionCallOutputInput;

/**
 * File API Types
 */

export interface OpenAIFile {
    id: string;
    object: "file";
    bytes: number;
    created_at: number;
    expires_at: number;
    filename: string;
    purpose: string;
    status?: string;
    status_details?: string;
}

export interface OpenAIListFilesResponse {
    object: "list";
    data: OpenAIFile[];
    first_id: string;
    last_id: string;
    has_more: boolean;
}

export interface OpenAIDeleteResponse {
    id: string;
    object: "file";
    deleted: boolean;
}
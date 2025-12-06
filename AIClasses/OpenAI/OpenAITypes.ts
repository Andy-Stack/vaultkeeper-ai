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
    call: {
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string;
        };
    };
}

export interface ResponseDone extends ResponseEvent {
    type: "response.done";
    response: {
        id: string;
        status: string;
        output: Array<{
            role: string;
            content?: string;
            tool_calls?: Array<{
                id: string;
                type: string;
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
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
import type { AIToolCall } from "AIClasses/AIToolCall";
import type { StoredToolCall, StoredFunctionResponse } from "AIClasses/Schemas/AIToolTypes";
import { StringTools } from "./StringTools";
import { Exception } from "./Exception";

// handle the rare event where function calls are also included in content (gemini sometimes does this)
export function sanitizeToolCallContent(content: string, toolCalls: AIToolCall[]): string {
    return toolCalls.reduce((sanitized, toolCall) => sanitizeSingleToolCallContent(sanitized, toolCall), content);
}

function sanitizeSingleToolCallContent(content: string, toolCall: AIToolCall): string {
    // Early returns for simple cases
    if (!content.trim()) {
        return content;
    }

    // If content has no JSON-like characters, return as-is
    if (!content.includes('{') || !content.includes('}')) {
        return content;
    }

    const toolCallString = toolCall.toConversationString();
    let sanitized = content;

    // Step 1: Remove markdown code blocks that might contain the function call
    // Pattern matches ```json\n...\n``` or ```\n...\n```
    sanitized = sanitized.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, (match: string, codeContent: string) => {
        // If the code block contains our function call, remove it entirely
        if (codeContent.trim() === toolCallString.trim()) {
            return '';
        }
        // Otherwise keep the code block
        return match;
    });

    // Step 2: Remove exact JSON match (handles compact JSON)
    sanitized = sanitized.replace(toolCallString, '').trim();

    // Step 3: Handle pretty-printed variations by normalizing both strings
    try {
        const toolCallObj: unknown = JSON.parse(toolCallString);
        const normalizedTarget = JSON.stringify(toolCallObj);
        
        // Find and remove any JSON that matches when normalized
        // This regex finds JSON objects/arrays in the text
        const jsonPattern = /\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}|\[(?:[^[\]]|(?:\[(?:[^[\]]|(?:\[[^[\]]*\]))*\]))*\]/g;
        
        sanitized = sanitized.replace(jsonPattern, (match) => {
            try {
                const parsedMatch: unknown = JSON.parse(match);
                const normalizedMatch = JSON.stringify(parsedMatch);
                // Remove if it matches our function call when normalized
                return normalizedMatch === normalizedTarget ? '' : match;
            } catch {
                // If it's not valid JSON, keep it
                return match;
            }
        });
    } catch {
        // If function call string isn't valid JSON, we've done what we can
    }

    // Step 4: Clean up multiple consecutive whitespace/newlines left by removals
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

    return sanitized;
}

// Parses every call stored on an assistant's conversation content
export function parseToolCalls(toolCallsJson: string): StoredToolCall[] | null {
    if (!StringTools.isValidJson(toolCallsJson)) {
        Exception.log(`Invalid JSON in toolCalls field:\n${toolCallsJson}`);
        return null;
    }
    try {
        return JSON.parse(toolCallsJson) as StoredToolCall[];
    } catch (error) {
        Exception.log(error);
        return null;
    }
}

export function parseFunctionResponse(responseJson: string): StoredFunctionResponse | null {
    if (!StringTools.isValidJson(responseJson)) {
        Exception.log(`Invalid JSON in function response content:\n${responseJson}`);
        return null;
    }
    try {
        return JSON.parse(responseJson) as StoredFunctionResponse;
    } catch (error) {
        Exception.log(error);
        return null;
    }
}
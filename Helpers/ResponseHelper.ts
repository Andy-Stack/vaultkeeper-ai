import type { AIToolCall } from "AIClasses/AIToolCall";
import type { StoredFunctionCall, StoredFunctionResponse } from "AIClasses/Schemas/AIToolTypes";
import { StringTools } from "./StringTools";
import { Exception } from "./Exception";

// handle the rare event where a function call is also included in content (gemini sometimes does this)
export function sanitizeFunctionCallContent(content: string, functionCall: AIToolCall | null): string {
    // Early returns for simple cases
    if (!functionCall || !content.trim()) {
        return content;
    }

    // If content has no JSON-like characters, return as-is
    if (!content.includes('{') || !content.includes('}')) {
        return content;
    }

    const functionCallString = functionCall.toConversationString();
    let sanitized = content;

    // Step 1: Remove markdown code blocks that might contain the function call
    // Pattern matches ```json\n...\n``` or ```\n...\n```
    sanitized = sanitized.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, (match: string, codeContent: string) => {
        // If the code block contains our function call, remove it entirely
        if (codeContent.trim() === functionCallString.trim()) {
            return '';
        }
        // Otherwise keep the code block
        return match;
    });

    // Step 2: Remove exact JSON match (handles compact JSON)
    sanitized = sanitized.replace(functionCallString, '').trim();

    // Step 3: Handle pretty-printed variations by normalizing both strings
    try {
        const functionCallObj: unknown = JSON.parse(functionCallString);
        const normalizedTarget = JSON.stringify(functionCallObj);
        
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

export function parseFunctionCall(functionCallJson: string): StoredFunctionCall | null {
    if (!StringTools.isValidJson(functionCallJson)) {
        Exception.log(`Invalid JSON in functionCall field:\n${functionCallJson}`);
        return null;
    }
    try {
        return JSON.parse(functionCallJson) as StoredFunctionCall;
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
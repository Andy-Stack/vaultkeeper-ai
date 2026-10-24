import type { AIProvider } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import { StringTools } from "Helpers/StringTools";

export type Thought = {
    provider: AIProvider;
    text: string;
};

// Every thought produced in a single turn is stored together on the assistant's conversation content
export function thoughtsToConversationString(thoughts: Thought[]): string {
    return JSON.stringify(thoughts);
}

export function parseThoughts(thoughtsJson: string): Thought[] {
    if (!StringTools.isValidJson(thoughtsJson)) {
        Exception.log(`Invalid JSON in thoughts field:\n${thoughtsJson}`);
        return [];
    }
    try {
        const thoughts: unknown = JSON.parse(thoughtsJson);
        return Array.isArray(thoughts) ? thoughts as Thought[] : [];
    } catch (error) {
        Exception.log(error);
        return [];
    }
}

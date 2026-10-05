import { AITool } from "Enums/AITool";
import type { StoredToolCall } from "AIClasses/Schemas/AIToolTypes";

// platform agnostic function call class used to execute the requested function
export class AIToolCall {
    public readonly name: AITool;
    public readonly arguments: Record<string, unknown>;
    public readonly toolId?: string;
    public readonly thoughtSignature?: string;

    constructor(name: AITool, args: Record<string, unknown>, toolId?: string, thoughtSignature?: string) {
        this.name = name;
        this.arguments = args;
        this.toolId = toolId;
        this.thoughtSignature = thoughtSignature;
    }

    // Every call made in a single turn is stored together on the assistant's conversation content
    public static toConversationString(toolCalls: AIToolCall[]): string {
        return JSON.stringify(toolCalls.map(toolCall => toolCall.toStoredToolCall()));
    }

    public toStoredToolCall(): StoredToolCall {
        return {
            toolCall: {
                name: this.name,
                args: this.arguments,
                id: this.toolId ?? "",
                thoughtSignature: this.thoughtSignature
            }
        };
    }

    public toConversationString() {
        return JSON.stringify({
            toolCall: {
                name: this.name,
                args: this.arguments,
                id: this.toolId,
                thoughtSignature: this.thoughtSignature
            }
        });
    }
}
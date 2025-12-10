import { AIFunction } from "Enums/AIFunction";

// platform agnostic function call class used to execute the requested function
export class AIFunctionCall {
    public readonly name: AIFunction;
    public readonly arguments: Record<string, unknown>;
    public readonly toolId?: string;
    public readonly thoughtSignature?: string;

    constructor(name: AIFunction, args: Record<string, unknown>, toolId?: string, thoughtSignature?: string) {
        this.name = name;
        this.arguments = args;
        this.toolId = toolId;
        this.thoughtSignature = thoughtSignature;
    }

    public toConversationString() {
        return JSON.stringify({
            functionCall: {
                name: this.name,
                args: this.arguments,
                id: this.toolId,
                thoughtSignature: this.thoughtSignature
            }
        });
    }
}
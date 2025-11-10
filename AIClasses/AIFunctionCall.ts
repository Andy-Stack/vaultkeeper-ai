// platform agnostic function call class used to execute the requested function
export class AIFunctionCall {
    public readonly name: string;
    public readonly arguments: Record<string, unknown>;
    public readonly toolId?: string;

    constructor(name: string, args: Record<string, unknown>, toolId?: string) {
        this.name = name;
        this.arguments = args;
        this.toolId = toolId;
    }

    public toConversationString(): string {
        return JSON.stringify({
            functionCall: {
                name: this.name,
                args: this.arguments,
                id: this.toolId
            }
        });
    }
}
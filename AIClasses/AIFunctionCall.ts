// platform agnostic function call class used to execute the requested function
export class AIFunctionCall {
    public readonly name: string;
    public readonly arguments: Record<string, any>;

    constructor(name: string, args: Record<string, any>) {
        this.name = name;
        this.arguments = args;
    }

    public toConversationString(): string {
        return JSON.stringify({
            functionCall: {
                name: this.name,
                args: this.arguments
            }
        });
    }
}
// Platform agnostic class for function responses
// Used by AI providers to format function execution results for API calls
export class AIFunctionResponse {
    public readonly name: string;
    public readonly response: object;

    constructor(name: string, response: object) {
        this.name = name;
        this.response = response;
    }

    public toConversationString(): string {
        return JSON.stringify({
            functionResponse: {
                name: this.name,
                response: { result: this.response }
            }
        });
    }
}
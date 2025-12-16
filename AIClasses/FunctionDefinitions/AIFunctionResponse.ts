// Platform agnostic class for function responses

import type { AIFunction } from "Enums/AIFunction";

// Used by AI providers to format function execution results for API calls
export class AIFunctionResponse {
    public readonly name: AIFunction;
    public readonly response: object;
    public readonly toolId?: string;

    public static readonly UserRejectionMessage: string = `The user has explicitly rejected this change.
                                                           They may have changed their mind about the requested change.

                                                           **CRITICAL:** Immediately stop all further actions and consult with the user`;
                                                           
    public static readonly UserSuggestionMessage: string = "The user has rejected the change with the following suggestion: ";

    constructor(name: AIFunction, response: object, toolId?: string) {
        this.name = name;
        this.response = response;
        this.toolId = toolId;
    }

    public toConversationString(): string {
        return JSON.stringify({
            id: this.toolId,
            functionResponse: {
                name: this.name,
                response: { result: this.response }
            }
        });
    }
}
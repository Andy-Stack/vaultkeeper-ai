// Platform agnostic class for function responses

import type { AITool } from "Enums/AITool";
import type { AIToolResponsePayload } from "./AIToolResponsePayload";

// Used by AI providers to format function execution results for API calls
export class AIToolResponse {
    public readonly name: AITool;
    public readonly payload: AIToolResponsePayload;
    public readonly toolId?: string;

    public static readonly UserRejectionMessage: string = `The user rejected this change and it was NOT applied.
Other changes from the same request are reported separately and may have been applied.

Do not retry this change or attempt an alternative to it. Before taking any further action related to it, ask the user how they would like to proceed.`;

    public static readonly UserSuggestionMessage: string = `The user did NOT apply this change and instead left feedback on it.
This is not an error - it is guidance on how the change should differ. Other changes from the same request are reported separately and may have been applied; do not re-propose those.

The feedback may ask you to adjust this change, replace it with a different action (e.g. a different file, or a delete instead of a write), or account for something you missed.
Briefly acknowledge the feedback, then propose a revised version of this change only.

User feedback:`;

    public static readonly UserEmptySuggestionMessage: string = `The user did NOT apply this change and indicated they want something different, but left no feedback.
Other changes from the same request are reported separately and may have been applied.

Do not guess at what they want. Ask the user what they would like changed before proposing this change again.`;

    constructor(name: AITool, payload: AIToolResponsePayload, toolId?: string) {
        this.name = name;
        this.payload = payload;
        this.toolId = toolId;
    }

    public toConversationString(): string {
        return JSON.stringify({
            id: this.toolId,
            functionResponse: {
                name: this.name,
                response: { result: this.payload.response }
            }
        });
    }
}
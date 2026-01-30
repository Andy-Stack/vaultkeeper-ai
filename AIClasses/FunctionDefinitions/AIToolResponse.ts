// Platform agnostic class for function responses

import type { AITool } from "Enums/AITool";

// Used by AI providers to format function execution results for API calls
export class AIToolResponse {
    public readonly name: AITool;
    public readonly response: object;
    public readonly toolId?: string;

    public static readonly UserRejectionMessage: string = `The user has explicitly rejected this change.
                                                           They may have changed their mind about the requested change.

                                                           **CRITICAL:** Immediately stop all further actions and consult with the user`;
                                                           
    public static readonly UserSuggestionMessage: string = `**USER MODIFICATION REQUEST:**

    The user has reviewed your proposed action and provided a modification or alternative direction.

    **Critical Instructions:**
    1. This is NOT an error or failure - this is valuable user guidance that should be taken seriously
    2. The user may want to:
        - Adjust the SAME action with different parameters (e.g., write to a different file)
        - Change to a DIFFERENT action entirely (e.g., delete instead of write)
        - Add context or constraints you didn't initially consider
    3. Carefully analyze the user's suggestion below to understand their true intent
    4. Acknowledge their feedback and explain how you'll adjust your approach
    5. Then proceed with the modified action that aligns with their guidance

    **User's Suggestion:**`;

    constructor(name: AITool, response: object, toolId?: string) {
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
import { Role } from "Enums/Role";
import { ApiErrorType } from "Types/ApiError";

export class ConversationContent {
    role: Role;
    content: string;
    promptContent: string;
    functionCall: string;
    timestamp: Date;
    isFunctionCall: boolean;
    isFunctionCallResponse: boolean;
    isProviderSpecificContent: boolean;
    toolId?: string;
    thoughtSignature?: string;
    errorType?: ApiErrorType;

    /**
     * Creates a conversation content entry.
     *
     * @param role - The role of the message sender (User or Assistant)
     * @param content - The display content shown in the UI (for User messages, this is the user's input; for Assistant, it's the AI response)
     * @param promptContent - The content sent to the AI provider (often same as content, but may differ for system-generated messages)
     * @param functionCall - JSON string of the function call data (only set when isFunctionCall=true)
     * @param timestamp - When this content was created
     * @param isFunctionCall - True if this is an Assistant message containing a function/tool call
     * @param isFunctionCallResponse - True if this is a User message containing the response to a function call (hides from UI)
     * @param isProviderSpecificContent - True if this contains provider-specific formatted content (e.g., binary files in Claude/OpenAI/Gemini format; hides from UI)
     * @param toolId - Unique identifier for tool calls/responses (used to match calls with their responses)
     * @param thoughtSignature - Gemini-specific thought signature for extended thinking
     * @param errorType - If present, indicates this message contains an error
     */
    constructor(
        role: Role,
        content: string = "",
        promptContent: string = "",
        functionCall: string = "",
        timestamp: Date = new Date(),
        isFunctionCall = false,
        isFunctionCallResponse = false,
        isProviderSpecificContent = false,
        toolId?: string,
        thoughtSignature?: string,
        errorType?: ApiErrorType
    ) {
        this.role = role;
        this.content = content;
        this.promptContent = promptContent;
        this.functionCall = functionCall;
        this.timestamp = timestamp;
        this.isFunctionCall = isFunctionCall;
        this.isFunctionCallResponse = isFunctionCallResponse;
        this.isProviderSpecificContent = isProviderSpecificContent;
        this.toolId = toolId;
        this.thoughtSignature = thoughtSignature;
        this.errorType = errorType;
    }

    public static isConversationContentData(this: void, data: unknown): data is {
        role: string; content: string; promptContent: string; functionCall: string; timestamp: string, isFunctionCall: boolean,
        isFunctionCallResponse: boolean, isProviderSpecificContent: boolean, toolId?: string, thoughtSignature?: string, errorType?: string
    } {
        return (
            data !== null &&
            typeof data === "object" &&
            "role" in data &&
            "content" in data &&
            "promptContent" in data &&
            "functionCall" in data &&
            "timestamp" in data &&
            "isFunctionCall" in data &&
            "isFunctionCallResponse" in data &&
            "isProviderSpecificContent" in data &&
            typeof data.role === "string" &&
            typeof data.content === "string" &&
            typeof data.promptContent === "string" &&
            typeof data.functionCall === "string" &&
            typeof data.timestamp === "string" &&
            typeof data.isFunctionCall === "boolean" &&
            typeof data.isFunctionCallResponse === "boolean" &&
            typeof data.isProviderSpecificContent === "boolean" &&

            // optional conversation data fields
            (!("toolId" in data) || typeof data.toolId === "string") &&
            (!("thoughtSignature" in data) || typeof data.thoughtSignature === "string") &&
            (!("errorType" in data) || typeof data.errorType === "string")
        );
    }

    public static safeContinue() {
        return new ConversationContent(
            Role.User,
            "Continue",
            "Continue",
            "",
            new Date(),
            false,
            true  // isFunctionCallResponse = true (hides from UI)
        );
    }
}
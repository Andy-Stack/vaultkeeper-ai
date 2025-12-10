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
    toolId?: string;
    thoughtSignature?: string;
    errorType?: ApiErrorType;

    constructor(role: Role, content: string = "", promptContent: string = "", functionCall: string = "", timestamp: Date = new Date(), isFunctionCall = false, isFunctionCallResponse = false, toolId?: string, thoughtSignature?: string, errorType?: ApiErrorType) {
        this.role = role;
        this.content = content;
        this.promptContent = promptContent;
        this.functionCall = functionCall;
        this.timestamp = timestamp;
        this.isFunctionCall = isFunctionCall;
        this.isFunctionCallResponse = isFunctionCallResponse;
        this.toolId = toolId;
        this.thoughtSignature = thoughtSignature;
        this.errorType = errorType;
    }

    public static isConversationContentData(this: void, data: unknown): data is {
        role: string; content: string; promptContent: string; functionCall: string; timestamp: string, isFunctionCall: boolean,
        isFunctionCallResponse: boolean, toolId?: string, thoughtSignature?: string, errorType?: string
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
            typeof data.role === "string" &&
            typeof data.content === "string" &&
            typeof data.promptContent === "string" &&
            typeof data.functionCall === "string" &&
            typeof data.timestamp === "string" &&
            typeof data.isFunctionCall === "boolean" &&
            typeof data.isFunctionCallResponse === "boolean" &&

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
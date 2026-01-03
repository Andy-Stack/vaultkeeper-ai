import { Role } from "Enums/Role";
import { ApiErrorType } from "Types/ApiError";
import type { Attachment } from "./Attachment";
import type { Reference } from "./Reference";
import { Copy } from "Enums/Copy";

type ConversationContentInit = {
    role: Role;
    timestamp?: Date;
    content?: string;
    displayContent?: string;
    functionCall?: string;
    functionResponse?: string;
    attachments?: Attachment[];
    references?: Reference[];
    shouldDisplayContent?: boolean;
    toolId?: string;
    thoughtSignature?: string;
    errorType?: ApiErrorType;
};

export class ConversationContent {
    public role: Role;
    public timestamp: Date;
    public content: string | undefined;
    public displayContent: string | undefined;
    public functionCall: string | undefined;
    public functionResponse: string | undefined;
    public attachments: Attachment[];
    public references: Reference[];
    public shouldDisplayContent: boolean;
    public toolId: string | undefined;
    public thoughtSignature: string | undefined;
    public errorType: ApiErrorType | undefined;

    /**
     * Creates a conversation content entry.
     *
     * @param init - Initialization object
     * @param init.role - The role of the message sender (User or Assistant)
     * @param init.timestamp - Timestamp of the message (defaults to now)
     * @param init.content - The content to be displayed and/or sent to the AI provider
     * @param init.displayContent - Display content is used when content needs to be formatted differently when displayed versus as a prompt
     * @param init.functionCall - JSON string of the function call data (only set for function/tool calls)
     * @param init.functionResponse - JSON string of the function call response data (only set for function/tool responses)
     * @param init.attachments - Array of file attachments associated with this message (defaults to empty array)
     * @param init.references - Array of file references, used to display attachment's to the user associated with attachments
     * @param init.shouldDisplayContent - Whether this content should be displayed in the UI (defaults to true, false for system-generated messages)
     * @param init.toolId - Unique identifier for tool calls/responses (used to match calls with their responses)
     * @param init.thoughtSignature - Gemini-specific thought signature for extended thinking
     * @param init.errorType - Indicates that this contains an error of the given type
     */
    constructor(init: ConversationContentInit) {
        this.role = init.role;
        this.timestamp = init.timestamp ?? new Date();
        this.content = init.content;
        this.displayContent = init.displayContent;
        this.functionCall = init.functionCall;
        this.functionResponse = init.functionResponse;
        this.attachments = init.attachments ?? [];
        this.references = init.references ?? [];
        this.shouldDisplayContent = init.shouldDisplayContent ?? true;
        this.toolId = init.toolId;
        this.thoughtSignature = init.thoughtSignature;
        this.errorType = init.errorType;
    }

    public getDisplayContent(): string {
        return this.displayContent ?? this.content ?? "";
    }

    public static isConversationContentData(
        this: void,
        data: unknown
    ): data is {
        role: string;
        timestamp: string;
        content?: string;
        displayContent?: string;
        functionCall?: string;
        functionResponse?: string;
        attachments?: unknown[];
        references?: unknown[];
        shouldDisplayContent?: boolean;
        toolId?: string;
        thoughtSignature?: string;
        errorType?: string;
    } {
        return (
            data !== null &&
            typeof data === "object" &&
            "timestamp" in data &&
            "role" in data &&
            typeof data.timestamp === "string" &&
            typeof data.role === "string" &&

            (!("content" in data) || typeof data.content === "string") &&
            (!("displayContent" in data) || typeof data.displayContent === "string") &&
            (!("functionCall" in data) || typeof data.functionCall === "string") &&
            (!("functionResponse" in data) || typeof data.functionResponse === "string") &&
            (!("attachments" in data) || Array.isArray(data.attachments)) &&
            (!("references" in data) || Array.isArray(data.references)) &&
            (!("shouldDisplayContent" in data) || typeof data.shouldDisplayContent === "boolean") &&
            (!("toolId" in data) || typeof data.toolId === "string") &&
            (!("thoughtSignature" in data) || typeof data.thoughtSignature === "string") &&
            (!("errorType" in data) || typeof data.errorType === "string")
        );
    }

    public static safeContinue(): ConversationContent {
        return new ConversationContent({
            role: Role.User,
            content: Copy.SafeContinue,
            shouldDisplayContent: false
        });
    }
}
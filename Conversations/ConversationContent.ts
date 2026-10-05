import { Role } from "Enums/Role";
import { ApiErrorType } from "Types/ApiError";
import type { Attachment } from "./Attachment";
import type { Reference } from "./Reference";
import { Copy } from "Enums/Copy";
import type { Artifact } from "./Artifact";

type ConversationContentInit = {
    role: Role;
    timestamp?: Date;
    content?: string;
    displayContent?: string;
    toolCalls?: string;
    functionResponse?: string;
    artifacts?: Artifact[];
    attachments?: Attachment[];
    references?: Reference[];
    shouldDisplayContent?: boolean;
    toolId?: string;
    errorType?: ApiErrorType;
};

export class ConversationContent {
    // Runtime-only counter for Svelte {#each} keying
    private static nextId: number = 0;

    public readonly id: number;
    public role: Role;
    public timestamp: Date;
    public content: string | undefined;
    public displayContent: string | undefined;
    public toolCalls: string | undefined;
    public functionResponse: string | undefined;
    public artifacts: Artifact[];
    public attachments: Attachment[];
    public references: Reference[];
    public shouldDisplayContent: boolean;
    public toolId: string | undefined;
    public errorType: ApiErrorType | undefined;

    /**
     * Creates a conversation content entry.
     *
     * @param init - Initialization object
     * @param init.role - The role of the message sender (User or Assistant)
     * @param init.timestamp - Timestamp of the message (defaults to now)
     * @param init.content - The content to be displayed and/or sent to the AI provider
     * @param init.displayContent - Display content is used when content needs to be formatted differently when displayed versus as a prompt
     * @param init.toolCalls - JSON array string of every function call made in the turn (only set for function/tool calls)
     * @param init.functionResponse - JSON string of the function call response data (only set for function/tool responses)
     * @param init.artifacts - Array of artefacts that track edits to files made by the agent during the turn
     * @param init.attachments - Array of file attachments associated with this message (defaults to empty array)
     * @param init.references - Array of file references, used to display attachment's to the user associated with attachments
     * @param init.shouldDisplayContent - Whether this content should be displayed in the UI (defaults to true, false for system-generated messages)
     * @param init.toolId - Unique identifier for tool responses (used to match responses with their calls)
     * @param init.errorType - Indicates that this contains an error of the given type
     */
    constructor(init: ConversationContentInit) {
        this.id = ConversationContent.nextId++;
        this.role = init.role;
        this.timestamp = init.timestamp ?? new Date();
        this.content = init.content;
        this.displayContent = init.displayContent;
        this.toolCalls = init.toolCalls;
        this.functionResponse = init.functionResponse;
        this.artifacts = init.artifacts ?? [];
        this.attachments = init.attachments ?? [];
        this.references = init.references ?? [];
        this.shouldDisplayContent = init.shouldDisplayContent ?? true;
        this.toolId = init.toolId;
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
        toolCalls?: string;
        functionResponse?: string;
        artifacts?: unknown[];
        attachments?: unknown[];
        references?: unknown[];
        shouldDisplayContent?: boolean;
        toolId?: string;
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
            (!("toolCalls" in data) || typeof data.toolCalls === "string") &&
            (!("functionResponse" in data) || typeof data.functionResponse === "string") &&
            (!("artifacts" in data) || Array.isArray(data.artifacts)) &&
            (!("attachments" in data) || Array.isArray(data.attachments)) &&
            (!("references" in data) || Array.isArray(data.references)) &&
            (!("shouldDisplayContent" in data) || typeof data.shouldDisplayContent === "boolean") &&
            (!("toolId" in data) || typeof data.toolId === "string") &&
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
import { StringTools } from "Helpers/StringTools";
import { ConversationContent } from "./ConversationContent";
import { ApiErrorType } from "Types/ApiError";

export class Conversation {

    title: string;
    created: Date;
    updated: Date;
    path: string;

    contents: ConversationContent[] = [];

    constructor() {
        this.created = new Date();
        this.updated = new Date();
        this.title = `${StringTools.dateToString(this.created)}`;
    }
    
    public static isConversationData(data: unknown): data is { title: string; created: string; updated: string; contents: ConversationContent[] } {
        return (
            typeof data === "object" &&
            data !== null &&
            "title" in data &&
            "created" in data &&
            "updated" in data &&
            "contents" in data &&
            typeof data.title === "string" &&
            typeof data.created === "string" &&
            typeof data.updated === "string" &&
            Array.isArray(data.contents) &&
            data.contents.every(ConversationContent.isConversationContentData)
        );
    }

    public setMostRecentContent(content: string) {
        const conversationContent: ConversationContent | undefined = this.contents[this.contents.length - 1];
        if (conversationContent) {
            conversationContent.content = content;
            conversationContent.errorType = undefined;
        }
    }

    public setMostRecentError(content: string, errorType: ApiErrorType) {
        const conversationContent: ConversationContent | undefined = this.contents[this.contents.length - 1];
        if (conversationContent) {
            conversationContent.content = content;
            conversationContent.errorType = errorType;
        }
    }

    public setMostRecentFunctionCall(functionCall: string) {
        const conversationContent: ConversationContent | undefined = this.contents[this.contents.length - 1];
        if (conversationContent) {
            conversationContent.functionCall = functionCall;
            conversationContent.isFunctionCall = true;
        }
    }
}
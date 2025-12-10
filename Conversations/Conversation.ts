import { StringTools } from "Helpers/StringTools";
import { ConversationContent } from "./ConversationContent";

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
}
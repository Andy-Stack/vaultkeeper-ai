import { dateToString } from "Helpers/Helpers";
import { ConversationContent } from "./ConversationContent";

export class Conversation {

    title: string;
    created: Date;

    contents: ConversationContent[] = [];

    public static isConversationData(data: unknown): data is { title: string; created: string; contents: ConversationContent[] } {
        return (
            typeof data === 'object' &&
            data !== null &&
            'title' in data &&
            'created' in data &&
            'contents' in data &&
            typeof data.title === 'string' &&
            typeof data.created === 'string' &&
            Array.isArray(data.contents) &&
            data.contents.every(ConversationContent.isConversationContentData)
        );
    }

    constructor() {
        this.created = new Date();
        this.title = `${dateToString(this.created)}`;
    }
}
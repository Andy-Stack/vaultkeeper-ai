import { dateToString } from "Helpers/Helpers";
import type { ConversationContent } from "./ConversationContent";

export class Conversation {

    title: string;
    created: Date;

    contents: ConversationContent[] = [];

    constructor() {
        this.created = new Date();
        this.title = `${dateToString(this.created)}`;
    }
}
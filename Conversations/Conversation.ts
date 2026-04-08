import { StringTools } from "Helpers/StringTools";
import { ConversationContent } from "./ConversationContent";
import type { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { Role } from "Enums/Role";

export class Conversation {

    title: string;
    created: Date;
    updated: Date;

    contents: ConversationContent[] = [];

    constructor() {
        const timestamp = new Date();
        this.created = timestamp;
        this.updated = timestamp;
        this.title = `${StringTools.dateToString(this.created)}`;
    }

    public hasAttachments(): boolean {
        return this.contents.some(c => c.attachments.length > 0);
    }

    public addFunctionResponse(functionResponse: AIToolResponse): void {
        this.contents.push(new ConversationContent({
            role: Role.User,
            functionResponse: functionResponse.toConversationString(),
            shouldDisplayContent: false,
            toolId: functionResponse.toolId
        }));

        if (functionResponse.payload.attachments.length > 0) {
            this.contents.push(new ConversationContent({
                role: Role.User,
                attachments: functionResponse.payload.attachments,
                shouldDisplayContent: false
            }));
        }
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
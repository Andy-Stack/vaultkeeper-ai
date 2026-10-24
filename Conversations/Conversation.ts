import { StringTools } from "Helpers/StringTools";
import { ConversationContent } from "./ConversationContent";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { AIToolResponsePayload } from "AIClasses/ToolDefinitions/AIToolResponsePayload";
import type { StoredToolCall } from "AIClasses/Schemas/AIToolTypes";
import { fromString as aiToolFromString } from "Enums/AITool";
import { Copy } from "Enums/Copy";
import { Role } from "Enums/Role";
import { parseToolCalls } from "Helpers/ResponseHelper";

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
        this.addFunctionResponses([functionResponse]);
    }

    // Responses to the same turn must be contiguous, so any attachments they produce follow all of them in a single entry
    public addFunctionResponses(functionResponses: AIToolResponse[]): void {
        this.contents.push(...functionResponses.map(functionResponse => Conversation.functionResponseContent(functionResponse)));

        const attachments = functionResponses.flatMap(functionResponse => functionResponse.payload.attachments);
        if (attachments.length > 0) {
            this.contents.push(new ConversationContent({
                role: Role.User,
                attachments: attachments,
                shouldDisplayContent: false
            }));
        }
    }
    
    /**
     * A stopped request can leave a turn's tool calls unanswered, which providers reject. Answering them before
     * the next message keeps the history valid while only ever adding to it, so turns replayed unchanged stay valid.
     * Also drops empty turns and responses without a call, which older conversations can contain.
     */
    public closeInterruptedToolCalls(): void {
        const repairedContents: ConversationContent[] = [];
        let index = 0;

        while (index < this.contents.length) {
            const content = this.contents[index++];

            // Valid responses are consumed with their call below
            if (content.functionResponse || Conversation.isEmpty(content)) {
                continue;
            }

            repairedContents.push(content);
            if (!content.toolCalls) {
                continue;
            }

            const responses: ConversationContent[] = [];
            while (index < this.contents.length && this.contents[index].functionResponse) {
                responses.push(this.contents[index++]);
            }

            const unansweredToolCalls = Conversation.unansweredToolCalls(parseToolCalls(content.toolCalls) ?? [], responses);
            repairedContents.push(...responses, ...unansweredToolCalls.map(storedToolCall => Conversation.functionResponseContent(
                new AIToolResponse(
                    aiToolFromString(storedToolCall.toolCall.name),
                    new AIToolResponsePayload({ error: Copy.ToolCallInterrupted }),
                    storedToolCall.toolCall.id || undefined
                ))));
        }

        this.contents = repairedContents;
    }

    private static functionResponseContent(functionResponse: AIToolResponse): ConversationContent {
        return new ConversationContent({
            role: Role.User,
            functionResponse: functionResponse.toConversationString(),
            shouldDisplayContent: false,
            toolId: functionResponse.toolId
        });
    }

    private static isEmpty(content: ConversationContent): boolean {
        return !content.content && !content.toolCalls && !content.providerContent && content.attachments.length === 0;
    }

    // Calls with ids are matched to responses by id, providers without ids (Gemini) answer in call order
    private static unansweredToolCalls(toolCalls: StoredToolCall[], responses: ConversationContent[]): StoredToolCall[] {
        if (toolCalls.every(storedToolCall => storedToolCall.toolCall.id?.trim())) {
            const answeredIds = new Set(responses.map(response => response.toolId));
            return toolCalls.filter(storedToolCall => !answeredIds.has(storedToolCall.toolCall.id));
        }
        return toolCalls.slice(responses.length);
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
import type { Attachment } from "Conversations/Attachment";

export class AIToolResponsePayload {
    public readonly response: object;
    public readonly attachments: Attachment[];

    constructor(response: object, attachments: Attachment[] = []) {
        this.response = response;
        this.attachments = attachments;
    }
}
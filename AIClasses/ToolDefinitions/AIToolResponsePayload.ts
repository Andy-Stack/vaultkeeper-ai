import type { Artifact } from "Conversations/Artifact";
import type { Attachment } from "Conversations/Attachment";

export class AIToolResponsePayload {
    public readonly response: object;
    public readonly artifacts: Artifact[];
    public readonly attachments: Attachment[];

    constructor(response: object, artifacts: Artifact[] = [], attachments: Attachment[] = []) {
        this.response = response;
        this.artifacts = artifacts;
        this.attachments = attachments;
    }
}
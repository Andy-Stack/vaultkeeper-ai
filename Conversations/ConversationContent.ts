export class ConversationContent {
    role: string;
    content: string
    timestamp: Date;

    constructor(role: string, content: string) {
        this.role = role;
        this.content = content;
        this.timestamp = new Date();
    }
}
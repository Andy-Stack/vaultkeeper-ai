export class ConversationContent {
    role: string;
    content: string
    timestamp: Date;

    public static isConversationContentData(data: unknown): data is { role: string; content: string; timestamp: string } {
        return (
            typeof data === 'object' &&
            data !== null &&
            'role' in data &&
            'content' in data &&
            'timestamp' in data &&
            typeof data.role === 'string' &&
            typeof data.content === 'string' &&
            typeof data.timestamp === 'string'
        );
    }
    
    constructor(role: string, content: string) {
        this.role = role;
        this.content = content;
        this.timestamp = new Date();
    }
}
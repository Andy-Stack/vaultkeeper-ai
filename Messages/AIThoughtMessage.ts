import type { IMessage } from "./IMessage";

export class AIThoughtMessage implements IMessage {
    constructor(public thought: string | null) {}
    invoke(): void {
    }
}
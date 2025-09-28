import type { IMessage } from "Messages/IMessage";

type MessageConstructor<T extends IMessage> = new (...args: any[]) => T;

export class MessageService {
  private handlers = new Map<MessageConstructor<any>, Set<(message: any) => void>>();

  register<T extends IMessage>(messageType: MessageConstructor<T>, handler: (message: T) => void): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    
    let messageHandler: Set<(message: any) => void> | undefined = this.handlers.get(messageType);
    
    if (messageHandler != null) {
        messageHandler.add(handler);
    }
  }

  unregister<T extends IMessage>(messageType: MessageConstructor<T>, handler: (message: T) => void): void {
    this.handlers.get(messageType)?.delete(handler);
  }

  send<T extends IMessage>(message: T): void {
    const messageType = message.constructor as MessageConstructor<T>;
    const handlers = this.handlers.get(messageType);
    handlers?.forEach(handler => handler(message));
  }
}
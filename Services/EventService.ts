import type { Event } from "Enums/Event";
import { Events } from "obsidian";

export class EventService extends Events {

    public trigger(name: Event.DiffOpened, data?: unknown): void;
    public trigger(name: Event.DiffClosed, data?: unknown): void;

    public trigger(name: string, ...data: unknown[]): void {
        super.trigger(name, ...data);
    }

}
import type { Event } from "Enums/Event";
import { Events, type EventRef } from "obsidian";

export class EventService extends Events {

    public on(name: Event.DiffOpened, callback: () => void): EventRef;
    public on(name: Event.DiffClosed, callback: () => void): EventRef;
    public on(name: Event.PlanApprovalOpened, callback: () => void): EventRef;
    public on(name: Event.PlanApprovalClosed, callback: () => void): EventRef;
    public on(name: Event.RateLimitCountdown, callback: (delayMs: number) => void): EventRef;

    public on<T extends unknown[]>(name: string, callback: (...data: T) => unknown): EventRef {
        return super.on(name, callback as (...data: unknown[]) => unknown);
    }

    public trigger(name: Event.DiffOpened, data?: unknown): void;
    public trigger(name: Event.DiffClosed, data?: unknown): void;
    public trigger(name: Event.PlanApprovalOpened, data?: unknown): void;
    public trigger(name: Event.PlanApprovalClosed, data?: unknown): void;
    public trigger(name: Event.RateLimitCountdown, delayMs: number): void;

    public trigger(name: string, ...data: unknown[]): void {
        super.trigger(name, ...data);
    }

}
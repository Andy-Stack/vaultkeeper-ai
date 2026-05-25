import { Exception } from "Helpers/Exception";
import type { Component } from "obsidian";

const services = new Map<symbol, unknown>();

export function RegisterSingleton<T>(type: symbol, instance: T) {
    services.set(type, instance);
}

export function RegisterTransient<T>(type: symbol, factory: () => T) {
    services.set(type, factory);
}

export function Resolve<T>(type: symbol): T {
    const service = services.get(type);

    if (!service) {
        Exception.throw(`Service not found for type: ${type.description}`);
    }

    if (typeof service === "function") {
        // It"s a transient factory, return a new instance
        return (service as () => T)();
    }

    // It"s a singleton, return the existing instance
    return service as T;
}

export function TryResolve<T>(type: symbol): T | undefined {
    if (services.has(type)) {
        return Resolve<T>(type);
    }
}

export function DeregisterAllServices() {
    services.forEach((service) => {
        if (!service || typeof service !== "object") {
            return;
        }
        if ("dispose" in service && typeof service.dispose === "function") {
            (service as { dispose: () => void }).dispose();
        }
        if ("unload" in service) {
            (service as Component).unload();
        }
    });
    services.clear();
}
import { Exception } from "Helpers/Exception";

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

    if (typeof service === 'function') {
        // It's a transient factory, return a new instance
        return (service as () => T)();
    }

    // It's a singleton, return the existing instance
    return service as T;
}

export function DeregisterAllServices() {
    services.clear();
}
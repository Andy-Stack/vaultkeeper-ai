const services = new Map<symbol, any>();

export function RegisterSingleton<T>(type: symbol, instance: T): void {
    services.set(type, instance);
}

export function RegisterTransient<T>(type: symbol, factory: () => T): void {
    services.set(type, factory);
}

export function Resolve<T>(type: symbol): T {
    const service = services.get(type);
    if (!service) {
        throw new Error(`Service not found for type: ${type.description}`);
    }

    if (typeof service === 'function') {
        // It's a transient factory, return a new instance
        return service();
    }

    // It's a singleton, return the existing instance
    return service as T;
}
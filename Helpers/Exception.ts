import { Environment } from "Enums/Environment";

export abstract class Exception {

    public static throw(error: unknown): never {
        this.log(error);
        throw error;
    }

    public static new(error: unknown): Error {
        return error instanceof Error ? error : new Error(this.messageFrom(error));
    }

    public static log(error: unknown) {
        if (process.env.NODE_ENV === Environment.DEV) {
            const e: Error = this.new(error);
            console.error(e.message, e);
        }
    }

    public static messageFrom(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === "string") {
            return error;
        }
        if (error && typeof error === "object" && "message" in error) {
            return String(error.message);
        }
        return String(error);
    }

}
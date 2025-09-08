import type { IActioner } from "Actioner/IActioner";

export interface IAIClass {
    apiRequest(req: string, actioner: IActioner): Promise<Part[] | null>;
}
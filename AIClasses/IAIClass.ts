import type { IActioner } from "Actioner/IActioner";
import type { StreamChunk } from "Services/StreamingService";

export interface IAIClass {
    streamRequest(userInput: string, actioner: IActioner): AsyncGenerator<StreamChunk, void, unknown>;
}
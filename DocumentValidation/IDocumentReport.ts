import type { IDocumentValidationResult } from "./IDocumentValidationResult";

export interface IDocumentReport {
    documentValidationResults: IDocumentValidationResult[];
    issueCount(): number;
    toString(): string;
}
import type { IVaultChange } from "Services/TemporaryVaultService";
import type { IDocumentValidationResult } from "./IDocumentValidationResult";

export interface IDocumentReport {
    documentValidationResults: IDocumentValidationResult[];
    issueCount(): number;
    issueCountFor(vaultChange: IVaultChange): number;
    toString(): string;
}
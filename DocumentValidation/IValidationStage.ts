import type { IVaultChange } from "Services/TemporaryVaultService";
import type { IDocumentValidationResult } from "./IDocumentValidationResult";

export interface IValidationStage {
    validate(vaultChanges: IVaultChange[]): IDocumentValidationResult;
}
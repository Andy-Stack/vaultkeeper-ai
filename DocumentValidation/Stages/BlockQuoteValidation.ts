import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";
import type { IVaultChange } from "Services/TemporaryVaultService";

export class BlockQuoteValidation implements IValidationStage {

    validate(vaultChanges: IVaultChange[]): IDocumentValidationResult {
        throw new Error("Method not implemented.");
    }
    
}
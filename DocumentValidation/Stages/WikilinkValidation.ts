import type { IVaultChange } from "Services/TemporaryVaultService";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";
import { WikilinkValidationResult } from "../Results/WikilinkValidationResult";

export class WikilinkValidation implements IValidationStage {

    validate(vaultChanges: IVaultChange[]): IDocumentValidationResult {
        return new WikilinkValidationResult();
    }
    
}
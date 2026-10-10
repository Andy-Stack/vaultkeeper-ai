import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";

export class BlockQuoteValidation implements IValidationStage {

    validate(): Promise<IDocumentValidationResult> {
        throw new Error("Method not implemented.");
    }
    
}
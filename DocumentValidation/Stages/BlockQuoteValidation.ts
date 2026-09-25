import { Resolve } from "Services/DependencyService";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";
import type { TemporaryVaultService } from "Services/TemporaryVaultService";
import { Services } from "Services/Services";

export class BlockQuoteValidation implements IValidationStage {
    
    private readonly temporaryVaultService: TemporaryVaultService;

    public constructor(){
        this.temporaryVaultService = Resolve<TemporaryVaultService>(Services.TemporaryVaultService);
    }

    validate(): IDocumentValidationResult {
        throw new Error("Method not implemented.");
    }
    
}
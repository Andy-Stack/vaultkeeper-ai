import type { TemporaryVaultService } from "Services/TemporaryVaultService";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";
import { WikilinkValidationResult } from "../Results/WikilinkValidationResult";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";

export class WikilinkValidation implements IValidationStage {
    
    private readonly temporaryVaultService: TemporaryVaultService;
    
    public constructor(){
        this.temporaryVaultService = Resolve<TemporaryVaultService>(Services.TemporaryVaultService);
    }

    validate(): IDocumentValidationResult {
        return new WikilinkValidationResult();
    }
    
}
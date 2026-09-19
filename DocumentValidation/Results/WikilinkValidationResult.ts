import type { IDocumentValidationResult } from "../IDocumentValidationResult";

export class WikilinkValidationResult implements IDocumentValidationResult {
    
    public issueCount: number;

    private issues: string[] = [];

    public constructor() {
        this.issueCount = this.issues.length;
    }
    
    toString(): string {
        return "";
    }
    
}
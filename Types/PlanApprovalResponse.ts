export class PlanApprovalResponse {

    public approved: boolean;
    public suggestion: string;

    public constructor(approved: boolean, suggestion: string = "") {
        this.approved = approved;
        this.suggestion = suggestion;
    }

}
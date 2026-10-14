export interface IValidationIssue {
    changePath: string; // the path of the vault change that causes this issue, matching its oldPath or newPath
}

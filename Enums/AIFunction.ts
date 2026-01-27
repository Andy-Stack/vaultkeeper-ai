export enum AIFunction {
    SearchVaultFiles = "search_vault_files",
    ReadVaultFiles = "read_vault_files",
    WriteVaultFile = "write_vault_file",
    PatchVaultFile = "patch_vault_file",
    DeleteVaultFiles = "delete_vault_files",
    MoveVaultFiles = "move_vault_files",
    ListVaultFiles = "list_vault_files",

    // only used by gemini
    RequestWebSearch = "request_web_search",

    // multi agent calls
    ExecuteWorkflow = "execute_workflow",
    Replan = "replan",
    SubmitPlan = "submit_plan",
    CompleteStep = "complete_step",
    CompleteTask = "complete_task",
    ContinuePlanExecution = "continue_plan_execution",
    CompletePlan = "complete_plan",
    CancelPlan = "cancel_plan",
    AskUserQuestionPlanning = "ask_user_question_planning",
    AskUserQuestionExecution = "ask_user_question_execution",

    Unknown = "unknown"
}

export function fromString(functionName: string): AIFunction {
    const enumValue = Object.values(AIFunction).find((value: string) => value === functionName);
    if (enumValue) {
        return enumValue as AIFunction;
    }
    return AIFunction.Unknown;
}

export function isAIFunction(value: unknown, aiFunction: AIFunction): value is AIFunction {
    return value === aiFunction;
}
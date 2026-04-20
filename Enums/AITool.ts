export enum AITool {
    SearchVaultFiles = "search_vault_files",
    ReadVaultFiles = "read_vault_files",
    WriteVaultFile = "write_vault_file",
    PatchVaultFile = "patch_vault_file",
    DeleteVaultFiles = "delete_vault_files",
    MoveVaultFiles = "move_vault_files",
    CreateVaultFolder = "create_vault_folder",
    DeleteVaultFolder = "delete_vault_folder",
    MoveVaultFolder = "move_vault_folder",
    ListVaultFiles = "list_vault_files",
    ReadMemories = "read_memories",
    UpdateMemories = "update_memories",
    GetWebViewerContent = "get_web_viewer_content",

    // used by gemini and mistral
    RequestWebSearch = "request_web_search",

    // multi agent calls
    ExecuteWorkflow = "execute_workflow",
    SubmitPlan = "submit_plan",
    CompleteTask = "complete_task",
    CompleteStep = "complete_step",
    SkipStep = "skip_step",
    ReviseStep = "revise_step",
    RevisePlan = "revise_plan",
    ContinuePlanExecution = "continue_plan_execution",
    CompletePlan = "complete_plan",
    CancelPlan = "cancel_plan",
    AskUserQuestionPlanning = "ask_user_question_planning",
    AskUserQuestionExecution = "ask_user_question_execution",

    Unknown = "unknown"
}

export function fromString(functionName: string): AITool {
    const enumValue = Object.values(AITool).find((value: string) => value === functionName);
    if (enumValue) {
        return enumValue;
    }
    return AITool.Unknown;
}

export function isAITool(value: unknown, aiTool: AITool): value is AITool {
    return value === aiTool;
}
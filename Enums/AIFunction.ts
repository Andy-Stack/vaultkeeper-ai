export enum AIFunction {
    SearchVaultFiles = "search_vault_files",
    ReadVaultFiles = "read_vault_files",
    WriteVaultFile = "write_vault_file",
    DeleteVaultFiles = "delete_vault_files",
    MoveVaultFiles = "move_vault_files",
    ListVaultFiles = "list_vault_files",

    // only used by gemini
    RequestWebSearch = "request_web_search",
}
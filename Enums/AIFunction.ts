export enum AIFunction {
    SearchVaultFiles = "search_vault_files",
    ReadVaultFiles = "read_vault_files",
    WriteVaultFile = "write_vault_file",
    DeleteVaultFile = "delete_vault_file",

    // used by gemini
    RequestWebSearch = "request_web_search"
}
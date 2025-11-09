export enum Path {
    Root = "/",
    VaultAIDir = "Vault AI",
    Conversations = `${Path.VaultAIDir}/Conversations`,
    UserInstructions = `${Path.VaultAIDir}/User Instructions`,
    ExampleUserInstructions = `${Path.UserInstructions}/EXAMPLE_INSTRUCTIONS.md`
};
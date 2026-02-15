export enum Path {
    Root = "/",
    VaultkeeperAIDir = "Vaultkeeper AI",
    Conversations = `${Path.VaultkeeperAIDir}/Conversations`,
    Attachments = `${Path.Conversations}/Attachments`,
    UserInstructions = `${Path.VaultkeeperAIDir}/User Instructions`,
    ExampleUserInstructions = `${Path.UserInstructions}/EXAMPLE_INSTRUCTIONS.md`
};
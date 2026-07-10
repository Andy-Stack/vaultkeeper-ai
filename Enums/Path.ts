export enum Path {
    Root = "/",
    VaultkeeperAIDir = "Vaultkeeper AI",
    Conversations = `${Path.VaultkeeperAIDir}/Conversations`,
    Attachments = `${Path.Conversations}/Attachments`,
    Artifacts = `${Path.Conversations}/Artifacts`,
    UserInstructions = `${Path.VaultkeeperAIDir}/User Instructions`,
    ExampleUserInstructions = `${Path.UserInstructions}/EXAMPLE_INSTRUCTIONS.md`,
    Memories = `${Path.VaultkeeperAIDir}/Memories.md`
};
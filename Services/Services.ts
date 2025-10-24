export class Services {
    static AIAgentPlugin = Symbol("AIAgentPlugin");
    static StatusBarService = Symbol("StatusBarService");
    static FileManager = Symbol("FileManager");
    static VaultService = Symbol("VaultService");
    static WorkSpaceService = Symbol("WorkSpaceService");
    static FileSystemService = Symbol("FileSystemService");
    static ConversationFileSystemService = Symbol("ConversationFileSystemService");
    static ConversationNamingService = Symbol("ConversationNamingService");
    static StreamingService = Symbol("StreamingService");
    static MarkdownService = Symbol("MarkdownService");
    static StreamingMarkdownService = Symbol("StreamingMarkdownService");
    static AIFunctionDefinitions = Symbol("AIFunctionDefinitions");
    static AIFunctionService = Symbol("AIFunctionService");
    static ChatService = Symbol("ChatService");
    static SanitiserService = Symbol("SanitiserService");

    // interfaces
    static IAIClass = Symbol("IAIClass");
    static IPrompt = Symbol("IPrompt");
    static ITokenService = Symbol("ITokenService");
    static IConversationNamingService = Symbol("IConversationNamingService");

    // modals
    static ConversationHistoryModal = Symbol("ConversationHistoryModal");
}
export class Services {
    static AIAgentPlugin = Symbol("AIAgentPlugin");
    static SettingsService = Symbol("SettingsService");
    static StatusBarService = Symbol("StatusBarService");
    static HTMLService = Symbol("HTMLService");
    static FileManager = Symbol("FileManager");
    static VaultService = Symbol("VaultService");
    static VaultCacheService = Symbol("VaultCacheService");
    static UserInputService = Symbol("UserInputService");
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
    static InputService = Symbol("InputService");

    // stores
    static SearchStateStore = Symbol("SearchStateStore");

    // interfaces
    static IAIClass = Symbol("IAIClass");
    static IPrompt = Symbol("IPrompt");
    static ITokenService = Symbol("ITokenService");
    static IConversationNamingService = Symbol("IConversationNamingService");

    // modals
    static ConversationHistoryModal = Symbol("ConversationHistoryModal");
}
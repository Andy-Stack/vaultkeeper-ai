export class Services {
    static VaultkeeperAIPlugin = Symbol("VaultkeeperAIPlugin");
    static SettingsService = Symbol("SettingsService");
    static EventService = Symbol("EventService");
    static AbortService = Symbol("AbortService");
    static HTMLService = Symbol("HTMLService");
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
    static DiffService = Symbol("DiffService");

    // stores
    static SearchStateStore = Symbol("SearchStateStore");

    // interfaces
    static IAIClass = Symbol("IAIClass");
    static IAIFileService = Symbol("IAIFileService");
    static IPrompt = Symbol("IPrompt");
    static IConversationNamingService = Symbol("IConversationNamingService");

    // modals
    static ConversationHistoryModal = Symbol("ConversationHistoryModal");
    static HelpModal = Symbol("HelpModal");
}
export class Services {
    static AIAgentPlugin = Symbol("AIAgentPlugin");
    static FileManager = Symbol("FileManager");
    static VaultService = Symbol("VaultService");
    static MessageService = Symbol("MessageService");
    static WorkSpaceService = Symbol("WorkSpaceService");
    static FileSystemService = Symbol("FileSystemService");
    static ConversationFileSystemService = Symbol("ConversationFileSystemService");
    static StreamingService = Symbol("StreamingService");
    static MarkdownService = Symbol("MarkdownService");
    static StreamingMarkdownService = Symbol("StreamingMarkdownService");
    static AIFunctionDefinitions = Symbol("AIFunctionDefinitions");
    static AIFunctionService = Symbol("AIFunctionService");
    static ChatService = Symbol("ChatService");

    // interfaces
    static IAIClass = Symbol("IAIClass");
    static IPrompt = Symbol("IPrompt");

    // modals
    static ConversationHistoryModal = Symbol("ConversationHistoryModal");
}
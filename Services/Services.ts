export class Services {
    static MessageService = Symbol("MessageService");
    static AIAgentPlugin = Symbol("AIAgentPlugin");
    static WorkSpaceService = Symbol("WorkSpaceService");
    static FileSystemService = Symbol("FileSystemService");
    static ConversationFileSystemService = Symbol("ConversationFileSystemService");
    static StreamingService = Symbol("StreamingService");
    static MarkdownService = Symbol("MarkdownService");
    static StreamingMarkdownService = Symbol("StreamingMarkdownService");
    static AIFunctionDefinitions = Symbol("AIFunctionDefinitions");
    static AIFunctionService = Symbol("AIFunctionService");

    // interfaces
    static IAIClass = Symbol("IAIClass");
    static IPrompt = Symbol("IPrompt");

    // modals
    static ConversationHistoryModal = Symbol("ConversationHistoryModal");
}
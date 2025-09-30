export class Services {
    static MessageService = Symbol("MessageService");
    static DmsAssistantPlugin = Symbol("DmsAssistantPlugin");
    static OdbCache = Symbol("OdbCache");
    static ModalService = Symbol("ModalService");
    static FileSystemService = Symbol("FileSystemService");
    static ConversationFileSystemService = Symbol("ConversationFileSystemService");
    static StreamingService = Symbol("StreamingService");
    static MarkdownService = Symbol("MarkdownService");
    static StreamingMarkdownService = Symbol("StreamingMarkdownService");


    // interfaces
    static IAIClass = Symbol("IAIClass");
    static IPrompt = Symbol("IPrompt");
    static IActioner = Symbol("IActioner");
    static IActionDefinitions = Symbol("IActionDefinitions");
}
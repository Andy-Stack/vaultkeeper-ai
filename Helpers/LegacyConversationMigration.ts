import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { FileSystemService } from "Services/FileSystemService";
import type { StoredToolCall } from "AIClasses/Schemas/AIToolTypes";
import { Path } from "Enums/Path";
import { Exception } from "./Exception";

/**
 * Converts conversations saved before multiple tool calls per turn were supported.
 *
 * Legacy content stored a single call object under 'toolCall', with Gemini's thought signature
 * on the content itself. Current content stores every call in the turn as an array under 'toolCalls',
 * each call carrying its own thought signature.
 *
 * Runs once on startup and only rewrites files that still contain legacy content.
 * Temporary: remove once conversations have had time to migrate.
 */
export class LegacyConversationMigration {

    private static readonly options = { allowAccessToPluginRoot: true };

    public static async migrate(): Promise<void> {
        const fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
        const files = await fileSystemService.listFilesInDirectory(Path.Conversations, { recursive: false, ...this.options });

        for (const file of files) {
            try {
                const conversation = await fileSystemService.readObjectFromFile(file.path, this.options);
                if (conversation instanceof Error || !Array.isArray(conversation.contents)) {
                    continue;
                }

                const contents = conversation.contents as Record<string, unknown>[];
                const migrated = contents.map(content => this.migrateContent(content)).some(Boolean);

                if (migrated) {
                    await fileSystemService.writeObjectToFile(file.path, conversation, this.options);
                }
            } catch (error) {
                Exception.log(`Failed to migrate conversation ${file.path}: ${Exception.messageFrom(error)}`);
            }
        }
    }

    // Returns whether the content held anything legacy
    private static migrateContent(content: Record<string, unknown>): boolean {
        if (!("toolCall" in content) && !("thoughtSignature" in content)) {
            return false;
        }

        if (typeof content.toolCall === "string" && content.toolCall.trim() !== "") {
            try {
                const storedToolCall = JSON.parse(content.toolCall) as StoredToolCall;
                const toolCall = storedToolCall.toolCall;

                // The call's id was also stored on the content, which is only kept for responses now
                toolCall.id = toolCall.id ?? (typeof content.toolId === "string" ? content.toolId : "");
                delete content.toolId;

                if (!toolCall.thoughtSignature && typeof content.thoughtSignature === "string") {
                    toolCall.thoughtSignature = content.thoughtSignature;
                }

                content.toolCalls = JSON.stringify([storedToolCall]);
            } catch (error) {
                // An unreadable call is dropped, its response is then filtered out as an orphan
                Exception.log(`Failed to migrate tool call: ${Exception.messageFrom(error)}`);
            }
        }

        delete content.toolCall;
        delete content.thoughtSignature;
        return true;
    }
}

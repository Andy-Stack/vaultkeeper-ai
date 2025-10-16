import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const MoveVaultFiles: IAIFunctionDefinition = {
    name: AIFunction.MoveVaultFiles,
    description: `Moves or renames one or more files within the vault to new locations.
                  Use this when reorganizing vault structure, moving files between folders, renaming
                  files for better organization, or consolidating related notes into appropriate
                  directories. This operation preserves file content while updating paths and names.
                  If renaming within the same folder, source and destination folders will be identical 
                  with only the filename changing. For safety, consider reading files first to confirm you're 
                  moving the correct content, especially when performing batch operations.`,
    parameters: {
        type: "object",
        properties: {
            source_paths: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "Array of current file paths to move. Each path must be exact and point to an existing file within the vault. Example: ['folder/note.md'] for single file or ['folder1/note1.md', 'folder2/note2.md'] for multiple files.",
            },
            destination_paths: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "Array of destination file paths (including filenames). Must be the same length as source_paths, with each destination corresponding to the source at the same index. Supports renaming by providing a different filename. Example: ['new-folder/note.md'] or ['folder/renamed-note.md']. Ensure parent directories exist.",
            },
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user explaining why these files are being moved. Examples: 'Moving your daily notes to the archive folder' (organizing), 'Renaming project files to match new naming convention' (renaming), or 'Consolidating research notes into one location' (reorganizing)."
            }
        },
        required: ["source_paths", "destination_paths", "user_message"]
    }
}
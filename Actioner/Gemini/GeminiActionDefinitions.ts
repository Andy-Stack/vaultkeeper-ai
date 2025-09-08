import { Type } from "@google/genai";
import { create_file, create_schema, delete_file, edit_file, rename_file, request_contents, request_directories } from "Actioner/Actions";
import type { IActionDefinitions } from "Actioner/IActionDefinitions";

export class GeminiActionDefinitions implements IActionDefinitions {
    public [request_directories](): object {
        return {
            name: "request_directories",
            description: "Request the available user directories. Call this for further available functions",
            parameters: {}
        };
    }

    public [request_contents](): object {
        return {
            name: "request_contents",
            description: "Request the contents of a file. The contents will be added using the Files API",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    file_path: {
                        type: Type.STRING,
                        description: "The file path of the file to be requested"
                    }
                },
                requited: ["file_path"]
            }
        };
    }

    public [create_schema](): object {
        return {
            name: "create_schema",
            description: "Create a new data definition schema for the user",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    file_path: {
                        type: Type.STRING,
                        description: "The file path of the schema to be created"
                    },
                    schema_content: {
                        type: Type.OBJECT,
                        description: "The schema definition where each field is the property name and each value is the default property value. Nested properties are accepted"
                    }
                },
                required: ["file_path", "file_content"]
            }
        };
    }

    public [create_file](): object {
        return {
            name: "create_file",
            description: "Create a new file for the user",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    file_path: {
                        type: Type.STRING,
                        description: "The file path of the file to be created"
                    },
                    file_content: {
                        type: Type.STRING,
                        description: "The content of the file to be created"
                    }
                },
                required: ["file_path", "file_content"]
            }
        };
    }

    public [delete_file](): object {
        return {
            name: "delete_file",
            description: "Request a file to be deleted",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    file_path: {
                        type: Type.STRING,
                        description: "The file path of the file to be deleted"
                    }
                },
                requited: ["file_path"]
            }
        };
    }

    public [edit_file](): object {
        return {
            name: "edit_file",
            description: "Edit the contents of an existing file",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    file_path: {
                        type: Type.STRING,
                        description: "The file path of the file to be edited"
                    },
                    file_content: {
                        type: Type.STRING,
                        description: "The new content of the file to be written"
                    }
                },
                requited: ["file_path, file_content"]
            }
        };
    }

    public [rename_file](): object {
        return {
            name: "rename_file",
            description: "Rename or move a file",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    old_file_path: {
                        type: Type.STRING,
                        description: "The old file path of the file"
                    },
                    new_file_path: {
                        type: Type.STRING,
                        description: "The new file path of the file"
                    }
                },
                requited: ["old_file_path", "new_file_path"]
            }
        };
    }
}
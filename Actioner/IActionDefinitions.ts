import type { create_file, create_schema, delete_file, edit_file, rename_file, request_contents, request_directories } from "./Actions";

export interface IActionDefinitions {
    [request_directories](): object;
    [request_contents](): object;
    [create_schema](): object;
    [create_file](): object;
    [delete_file](): object;
    [edit_file](): object;
    [rename_file](): object;
}
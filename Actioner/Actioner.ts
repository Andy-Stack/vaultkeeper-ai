import { createDirectories } from "Helpers";
import { create_file } from "./Actions";
import type { IActioner } from "./IActioner";
import type { Vault } from "obsidian";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type DmsAssistantPlugin from "main";

export class Actioner implements IActioner {

    private vault: Vault;

    public constructor() {
        this.vault = Resolve<DmsAssistantPlugin>(Services.DmsAssistantPlugin).app.vault;
    }
    
    public async [create_file](action: CreateFileRequest) {
        await createDirectories(this.vault, action.file_path);
        await this.vault.create(action.file_path, JSON.stringify(action.file_content, null, 4));
    }
}
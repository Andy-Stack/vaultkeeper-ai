import { TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import { DynamicRecord } from "./DynamicRecord";
import { Resolve } from "Services/DependencyService";
import type DmsAssistantPlugin from "main";
import { Services } from "Services/Services";
import { Path } from "Enums/Path";
import { DynamicRecordProp } from "Enums/DynamicRecord";
import { FileAction } from "Enums/FileAction";
import { isValidJson } from "Helpers/Helpers";

export class OdbCache {

    private vault: Vault;
    
    private schemas: Map<string, object> = new Map<string, object>();
    private cache: Map<string, DynamicRecord> = new Map<string, DynamicRecord>();

    public constructor() {
        this.vault = Resolve<DmsAssistantPlugin>(Services.DmsAssistantPlugin).app.vault;
    }

    public getSchemas(): Map<string, object> {
        return this.schemas;
    }

    public getRecord(objectId: string): DynamicRecord | null {
        return this.cache.get(objectId) ?? null;
    }

    public async buildCache() {
        await this.loadSchemas();

        let recordDir: TAbstractFile | null = this.vault.getAbstractFileByPath(Path.Records);

        if (!(recordDir instanceof TFolder)) {
            return;
        }

        this.recursiveBuild(recordDir);
    }

    public async onFileChanged(file: TAbstractFile, fileAction: FileAction) {
        if (file instanceof TFolder) {
            for (let child of file.children) {
                this.onFileChanged(child, fileAction);
            }
            return;
        }

        for (let [_, record] of this.cache) {
            if (record.recordPath === file.path) {
                switch (fileAction) {
                    case FileAction.Create:
                        this.addToCache(file as TFile);
                        break;
                    case FileAction.Modify, FileAction.Rename:
                        this.removeFromCache(record.objectId);
                        this.addToCache(file as TFile);
                        break;
                    case FileAction.Delete:
                        this.removeFromCache(record.objectId);
                        break;
                }
            }
        }
    }

    private async recursiveBuild(child : TAbstractFile) {
        if (child instanceof TFolder) {
            for (let subChild of child.children) {
                await this.recursiveBuild(subChild);
            }
        } else if (child instanceof TFile && child.extension === "json") {
            await this.addToCache(child);
        }
    }

    private async createDynamicRecord(file: TFile): Promise<DynamicRecord> {
        let contents: { [key: string]: any } = JSON.parse(await this.vault.read(file));

        if (contents[DynamicRecordProp.Type] === undefined || contents[DynamicRecordProp.ObjectId] === undefined) {
            throw new Error(`Invalid record format in file ${file.path}: missing ${DynamicRecordProp.Type} or ${DynamicRecordProp.ObjectId}`);
        }

        let schema: object | undefined = this.schemas.get(contents[DynamicRecordProp.Type]);

        if (schema === undefined) {
            throw new Error(`No schema found for record type ${contents[DynamicRecordProp.Type]} in file ${file.path}`);
        }

        return new DynamicRecord(file.path, schema, contents);
    }

    private async loadSchemas() {
        let schemaDir: TAbstractFile | null = this.vault.getAbstractFileByPath(Path.Schemas);

        if (!(schemaDir instanceof TFolder)) {
            return;
        }

        for (let child of schemaDir.children) {
            if (!(child instanceof TFile) || child.extension !== "json") {
                continue;
            }

            let contents: string = await this.vault.read(child);

            if (!isValidJson(contents)) {
                console.warn(`Invalid schema format in file ${child.path}`);
                continue;
            }

            let schema: Record<string,any> = JSON.parse(contents);

            if (schema[DynamicRecordProp.Type] === undefined || schema[DynamicRecordProp.ObjectId] === undefined) {
                throw new Error(`Invalid schema format in file ${child.path}: missing ${DynamicRecordProp.Type} or ${DynamicRecordProp.ObjectId}`);
            }

            this.schemas.set(schema[DynamicRecordProp.Type], schema);
        }
    }

    private async addToCache(file: TFile) {
        let record: DynamicRecord = await this.createDynamicRecord(file);
        this.cache.set(record.objectId, record);
    }

    private async removeFromCache(objectId: string) {
        this.cache.delete(objectId);
    }
}
import { DynamicRecordProp } from 'Enums/DynamicRecord';
import { version as uuidVersion } from 'uuid';
import { validate as uuidValidate } from 'uuid';
import type { OdbCache } from './OdbCache';
import { Resolve } from 'Services/DependencyService';
import { Services } from 'Services/Services';
import type DmsAssistantPlugin from 'main';
import { TAbstractFile, TFile, type Vault } from 'obsidian';

interface DynamicProps {
    [key: string]: any;
}

export class DynamicRecord {

    public readonly type: string;
    public readonly schema: object;
    public readonly objectId: string;
    public readonly recordPath: string;

    public props: DynamicProps;

    private vault: Vault;
    private odbCache: OdbCache;

    public constructor(recordPath: string, schema: object, record: { [key: string]: any }) {
        this.odbCache = Resolve<OdbCache>(Services.OdbCache);
        this.vault = Resolve<DmsAssistantPlugin>(Services.DmsAssistantPlugin).app.vault;

        this.schema = schema;
        this.recordPath = recordPath;

        if (record[DynamicRecordProp.Type] === undefined || record[DynamicRecordProp.ObjectId] === undefined) {
            throw new Error(`Invalid record format: missing ${DynamicRecordProp.Type} or ${DynamicRecordProp.ObjectId}`);
        }
        
        this.type = record[DynamicRecordProp.Type];
        this.objectId = record[DynamicRecordProp.ObjectId];

        let parsedRecord: Record<string,any> = {};
        for (let key in schema) {
            if (!(key in record) || key === DynamicRecordProp.Type || key === DynamicRecordProp.ObjectId) {
                continue;
            }

            parsedRecord[key] = this.parse(record[key]);
        }

        this.props = this.createProxy(parsedRecord);
    }

    public save() {
        let file: TAbstractFile | null = this.vault.getAbstractFileByPath(this.recordPath);

        if (file == null || !(file instanceof TAbstractFile)) {
            this.vault.create(this.recordPath, this.toFileContent());
        }

        this.vault.modify(file as TFile, this.toFileContent());
    }

    public delete() {
        let file: TAbstractFile | null = this.vault.getAbstractFileByPath(this.recordPath);

        if (file == null || !(file instanceof TAbstractFile)) {
            return;
        }

        this.vault.delete(file as TFile);
    }

    public move(newPath: string) {
        let file: TAbstractFile | null = this.vault.getAbstractFileByPath(this.recordPath);

        if (file == null || !(file instanceof TAbstractFile)) {
            return;
        }

        this.vault.rename(file as TFile, newPath);
    }

    private parse(data: any): any {
        if (typeof data === null) {
            return data;
        }
        if (Array.isArray(data)) {
            let arr: any[] = [];
            for (let item of data) {
                arr.push(this.parse(item));
            }
            return arr;
        }
        if (typeof data === "object") {
            let obj: Record<string,any> = {};
            for (let key in data) {
                obj[key] = this.parse(data[key]);
            }
            return this.createProxy(obj);
        }
        return data;
    }

    private createProxy(data: object): DynamicProps {
        return new Proxy(data, {
            get: (target, prop, receiver) => {
                if (this.isObjectId(String(prop))) {
                    return this.odbCache.getRecord(String(prop));
                }
                return Reflect.get(target, prop, receiver);
            },
            set: (target, prop, value, receiver) => {
                return Reflect.set(target, prop, value, receiver);
            }
        });
    }

    private isObjectId(key: string): boolean {
        return uuidValidate(key) && uuidVersion(key) === 4;
    }

    private toFileContent(): string {
        let content: Record<string,any> = {};
        
        content[DynamicRecordProp.Type] = this.type;
        content[DynamicRecordProp.ObjectId] = this.objectId;

        // use the schema when saving to file in case the AI did something funky
        for (let key in this.schema) {
            if (!(key in this.props) || key === DynamicRecordProp.Type || key === DynamicRecordProp.ObjectId) {
                continue;
            }
            content[key] = this.serialise(this.props[key]);
        }
        return JSON.stringify(content, null, 4);
    }

    private serialise(value: any): any {
        if (value instanceof DynamicRecord) {
            return value.objectId;
        }
        if (Array.isArray(value)) {
            let arr: any[] = [];
            for (let item of value) {
                arr.push(this.serialise(item));
            }
            return arr;
        }
        if (typeof value === "object") {
            let obj: Record<string,any> = {};
            for (let key in value) {
                obj[key] = this.serialise(value[key]);
            }
            return obj;
        }
        return value;
    }
}
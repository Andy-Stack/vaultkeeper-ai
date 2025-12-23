export class Reference {

    public fileName: string;
    public size: number;

    public constructor(fileName: string, size: number) {
        this.fileName = fileName;
        this.size = size;
    }

    public static isReferenceData(this: void, data: unknown): data is {
        fileName: string;
        size: number;
    } {
        return (
            data !== null &&
            typeof data === "object" &&
            "fileName" in data &&
            "size" in data &&
            typeof data.fileName === "string" &&
            typeof data.size === "number"
        );
    }
}
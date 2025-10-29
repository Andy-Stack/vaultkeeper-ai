export enum SearchTrigger {
    Tag = "#",
    File = "@",
    Folder = "/"
}

export namespace SearchTrigger {
    
    const values: string[] = [
        SearchTrigger.Tag,
        SearchTrigger.File,
        SearchTrigger.Folder
    ];

    export function isSearchTrigger(input: string): boolean {
        return values.includes(input);
    }

    export function fromInput(input: string): SearchTrigger {
        switch(input) {
            case SearchTrigger.Tag:
                return SearchTrigger.Tag;
            case SearchTrigger.File:
                return SearchTrigger.File;
            case SearchTrigger.Folder:
                return SearchTrigger.Folder;
            default:
                throw new Error(`Unknown search trigger: ${input}`);
        }
    }
}
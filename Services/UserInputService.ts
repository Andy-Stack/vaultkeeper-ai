import { SearchTrigger } from "Enums/SearchTrigger";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { VaultCacheService } from "./VaultCacheService";
import type { SearchStateStore } from "Stores/SearchStateStore";
import { get } from "svelte/store";

export class UserInputService {

    private readonly vaultCacheService: VaultCacheService;
    private readonly searchStateStore: SearchStateStore;

    public constructor() {
        this.vaultCacheService = Resolve<VaultCacheService>(Services.VaultCacheService);
        this.searchStateStore = Resolve<SearchStateStore>(Services.SearchStateStore);
    }

    public get searchState() {
        return this.searchStateStore.searchState;
    }

    public performSearch() {
        const state = get(this.searchStateStore.searchState);

        if (!state.active || state.trigger == null) {
            this.searchStateStore.setResults([]);
            return;
        }

        let results: string[] = [];

        switch (state.trigger) {
            case SearchTrigger.Tag:
                results = this.vaultCacheService.matchTag(state.query).map(result => result.obj.tag);
                break;
            case SearchTrigger.File:
                results = this.vaultCacheService.matchFile(state.query).map(result => result.obj.file.path);
                break;
            case SearchTrigger.Folder:
                results = this.vaultCacheService.matchFolder(state.query).map(result => result.obj.folder.path);
                break;
        }

        this.searchStateStore.setResults(results);
    }
}
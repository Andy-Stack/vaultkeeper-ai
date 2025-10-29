import type { SearchTrigger } from 'Enums/SearchTrigger';
import { writable } from 'svelte/store';

export interface ISearchState {
    active: boolean,
    trigger: SearchTrigger | null,
    position: number | null,
    query: string,
    results: string[],
    selectedResult: string
}

export class SearchStateStore {
    public searchState = writable<ISearchState>({
        active: false,
        trigger: null,
        position: null,
        query: "",
        results: [],
        selectedResult: ""
    });

    public setActive(active: boolean) {
        this.searchState.update(state => ({ ...state, active }));
    }

    public setTrigger(trigger: SearchTrigger | null) {
        this.searchState.update(state => ({ ...state, trigger }));
    }

    public setPosition(position: number | null) {
        this.searchState.update(state => ({ ...state, position }));
    }

    public setQuery(query: string) {
        this.searchState.update(state => ({ ...state, query }));
    }

    public appendToQuery(char: string) {
        this.searchState.update(state => ({ ...state, query: state.query + char }));
    }

    public removeLastCharFromQuery() {
        this.searchState.update(state => ({ ...state, query: state.query.slice(0, -1) }));
    }

    public removeCharAtPosition(position: number) {
        this.searchState.update(state => ({
            ...state,
            query: state.query.slice(0, position) + state.query.slice(position + 1)
        }));
    }

    public setResults(results: string[]) {
        this.searchState.update(state => ({ ...state, results }));
        this.setSelectedResultToFirst();
    }

    public setSelectedResultToFirst() {
        this.searchState.update(state => ({ ...state, selectedResult: state.results.length > 0 ? state.results[0] : "" }));
    }

    public setSelectedResultToNext() {
        this.searchState.update(state => {
            if (state.results.length === 0) {
                return state;
            }

            const currentIndex = state.results.indexOf(state.selectedResult);
            const nextIndex = (currentIndex + 1) % state.results.length;

            return {
                ...state,
                selectedResult: state.results[nextIndex]
            };
        });
    }

    public setSelectedResultToPrevious() {
        this.searchState.update(state => {
            if (state.results.length === 0) {
                return state;
            }

            const currentIndex = state.results.indexOf(state.selectedResult);
            const previousIndex = currentIndex <= 0
                ? state.results.length - 1
                : currentIndex - 1;

            return {
                ...state,
                selectedResult: state.results[previousIndex]
            };
        });
    }

    public initializeSearch(trigger: SearchTrigger, position: number) {
        this.searchState.update(state => ({
            ...state,
            active: true,
            trigger,
            position,
            query: "",
            results: []
        }));
    }

    public resetSearch() {
        this.searchState.set({
            active: false,
            trigger: null,
            position: null,
            query: "",
            results: [],
            selectedResult: ""
        });
    }
}
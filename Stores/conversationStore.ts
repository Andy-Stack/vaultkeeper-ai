import { writable } from 'svelte/store';

function createConversationStore() {
    const { subscribe, set, update } = writable({ shouldReset: false });

    return {
        subscribe,
        reset: () => set({ shouldReset: true }),
        clearResetFlag: () => set({ shouldReset: false })
    };
}

export const conversationStore = createConversationStore();

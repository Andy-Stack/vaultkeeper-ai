import { writable } from 'svelte/store';
import type { Conversation } from 'Conversations/Conversation';

interface IConversationStoreState {
    shouldReset: boolean;
    conversationToLoad: { conversation: Conversation; filePath: string } | null;
}

function createConversationStore() {
    const { subscribe, set, update } = writable<IConversationStoreState>({
        shouldReset: false,
        conversationToLoad: null,
    });

    return {
        subscribe,
        reset: () => set({ shouldReset: true, conversationToLoad: null }),
        clearResetFlag: () => update(state => ({ ...state, shouldReset: false })),
        loadConversation: (conversation: Conversation, filePath: string) =>
            set({ shouldReset: false, conversationToLoad: { conversation, filePath } }),
        clearLoadFlag: () => update(state => ({ ...state, conversationToLoad: null })),
    };
}

export const conversationStore = createConversationStore();

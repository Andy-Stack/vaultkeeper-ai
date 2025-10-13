import { writable } from 'svelte/store';
import type { Conversation } from 'Conversations/Conversation';

interface ConversationStoreState {
    shouldReset: boolean;
    conversationToLoad: { conversation: Conversation; filePath: string } | null;
    shouldDeactivateEditMode: boolean;
}

function createConversationStore() {
    const { subscribe, set, update } = writable<ConversationStoreState>({
        shouldReset: false,
        conversationToLoad: null,
        shouldDeactivateEditMode: false
    });

    return {
        subscribe,
        reset: () => set({ shouldReset: true, conversationToLoad: null, shouldDeactivateEditMode: true }),
        clearResetFlag: () => update(state => ({ ...state, shouldReset: false })),
        loadConversation: (conversation: Conversation, filePath: string) =>
            set({ shouldReset: false, conversationToLoad: { conversation, filePath }, shouldDeactivateEditMode: true }),
        clearLoadFlag: () => update(state => ({ ...state, conversationToLoad: null })),
        deactivateEditMode: () => update(state => ({ ...state, shouldDeactivateEditMode: true })),
        clearEditModeFlag: () => update(state => ({ ...state, shouldDeactivateEditMode: false }))
    };
}

export const conversationStore = createConversationStore();

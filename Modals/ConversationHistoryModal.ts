import { App, Modal } from 'obsidian';
import ConversationHistoryModalSvelte from './ConversationHistoryModalSvelte.svelte';
import type { Conversation } from 'Conversations/Conversation';
import { mount, unmount } from 'svelte';
import { Resolve } from 'Services/DependencyService';
import { Services } from 'Services/Services';
import type { ConversationFileSystemService } from 'Services/ConversationFileSystemService';
import { dateToString } from 'Helpers/Helpers';

interface ListItem {
    id: string;
    date: string;
    title: string;
    selected: boolean;
}

export class ConversationHistoryModal extends Modal {

    private readonly conversationFileSystemService: ConversationFileSystemService = Resolve(Services.ConversationFileSystemService);

    private component: Record<string, any> | null = null;
    private items: ListItem[];

    constructor(app: App) {
        super(app);
    }

    override async open() {
        const conversations: Conversation[] = await this.conversationFileSystemService.getAllConversations();

        this.items = conversations.map((conversation, index) => ({
            id: index.toString(),
            date: dateToString(conversation.created, false),
            title: conversation.title,
            selected: false
        }));

        super.open();
    }

    onOpen() {
        const { contentEl, modalEl, containerEl } = this;

        containerEl.addClass('conversation-history-modal');
        modalEl.addClass('conversation-history-modal');

        this.component = mount(ConversationHistoryModalSvelte, {
            target: contentEl,
            props: {
                items: this.items,
                onClose: () => this.close(),
                onDelete: (itemIds: string[]) => this.handleDelete(itemIds)
            }
        });
    }

    handleDelete(itemIds: string[]) {
        this.items = this.items.filter(item => !itemIds.includes(item.id));

        if (this.component) {
            this.component.items = this.items;
        }
    }

    onClose() {
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }

        const { contentEl } = this;
        contentEl.empty();
    }
}
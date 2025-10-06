import { App, Modal } from 'obsidian';
import ConversationHistoryModalSvelte from './ConversationHistoryModalSvelte.svelte';
import type { Conversation } from 'Conversations/Conversation';
import { mount, unmount } from 'svelte';
import { Resolve } from 'Services/DependencyService';
import { Services } from 'Services/Services';
import type { ConversationFileSystemService } from 'Services/ConversationFileSystemService';
import type { FileSystemService } from 'Services/FileSystemService';
import { dateToString } from 'Helpers/Helpers';
import { conversationStore } from 'Stores/conversationStore';

interface ListItem {
    id: string;
    date: string;
    title: string;
    selected: boolean;
    filePath: string;
}

export class ConversationHistoryModal extends Modal {

    private readonly conversationFileSystemService: ConversationFileSystemService = Resolve(Services.ConversationFileSystemService);
    private readonly fileSystemService: FileSystemService = Resolve(Services.FileSystemService);

    private component: Record<string, any> | null = null;
    private items: ListItem[];
    private conversations: Conversation[];

    constructor(app: App) {
        super(app);
    }

    override async open() {
        this.conversations = await this.conversationFileSystemService.getAllConversations();

        this.items = this.conversations
        .sort((a, b) => b.created.getTime() - a.created.getTime())
        .map((conversation, index) => ({
            id: index.toString(),
            date: dateToString(conversation.created, false),
            title: conversation.title,
            selected: false,
            filePath: this.conversationFileSystemService.generateConversationPath(conversation)
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
                onDelete: (itemIds: string[]) => this.handleDelete(itemIds),
                onSelect: (itemId: string) => this.handleSelect(itemId)
            }
        });
    }

    handleSelect(itemId: string) {
        const index = parseInt(itemId);
        const selectedConversation = this.conversations[index];
        const filePath = this.items[index].filePath;

        if (selectedConversation) {
            conversationStore.loadConversation(selectedConversation, filePath);
            this.close();
        }
    }

    async handleDelete(itemIds: string[]) {
        const itemsToDelete = this.items.filter(item => itemIds.includes(item.id));

        let shouldResetChat = false;
        const currentPath = this.conversationFileSystemService.getCurrentConversationPath();

        for (const item of itemsToDelete) {
            const deleted = await this.fileSystemService.deleteFile(item.filePath);
            if (deleted && currentPath === item.filePath) {
                shouldResetChat = true;
            }
        }

        this.items = this.items.filter(item => !itemIds.includes(item.id));

        if (this.component) {
            this.component.items = this.items;
        }

        if (shouldResetChat) {
            this.conversationFileSystemService.resetCurrentConversation();
            conversationStore.reset();
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
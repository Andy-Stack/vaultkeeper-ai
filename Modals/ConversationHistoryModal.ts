import { App, Modal } from 'obsidian';
import ConversationHistoryModalSvelte from './ConversationHistoryModalSvelte.svelte';
import type { Conversation } from 'Conversations/Conversation';
import { mount, unmount } from 'svelte';
import { Resolve } from 'Services/DependencyService';
import { Services } from 'Services/Services';
import type { ConversationFileSystemService } from 'Services/ConversationFileSystemService';
import type { FileSystemService } from 'Services/FileSystemService';
import { dateToString } from 'Helpers/Helpers';
import { conversationStore } from 'Stores/ConversationStore';
import { Selector } from 'Enums/Selector';
import type { ChatService } from 'Services/ChatService';

interface IListItem {
    id: string;
    date: string;
    updated: Date;
    title: string;
    selected: boolean;
    filePath: string;
}

export class ConversationHistoryModal extends Modal {

    private readonly conversationFileSystemService: ConversationFileSystemService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
    private readonly fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
    private readonly chatService: ChatService = Resolve<ChatService>(Services.ChatService);

    private component: Record<string, any> | null = null;
    private items: IListItem[];
    private conversations: Conversation[];
    public onModalClose?: () => void;

    constructor(app: App) {
        super(app);
    }

    override async open() {
        this.conversations = await this.conversationFileSystemService.getAllConversations();

        this.items = this.conversations
        .sort((a, b) => b.updated.getTime() - a.updated.getTime())
        .map((conversation) => {
            const filePath = this.conversationFileSystemService.generateConversationPath(conversation);
            return {
                id: filePath,
                date: dateToString(conversation.created, false),
                updated: conversation.updated,
                title: conversation.title,
                selected: false,
                filePath: filePath
            };
        });

        super.open();
    }

    onOpen() {
        const { contentEl, modalEl, containerEl } = this;

        containerEl.addClass(Selector.ConversationHistoryModal);
        modalEl.addClass(Selector.ConversationHistoryModal);

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
        const item = this.items.find(i => i.id === itemId);
        const conversation = this.conversations.find(c =>
            this.conversationFileSystemService.generateConversationPath(c) === itemId
        );

        if (conversation && item) {
            conversationStore.loadConversation(conversation, item.filePath);
            this.close();
        }
    }

    async handleDelete(itemIds: string[]) {
        this.chatService.stop();

        const itemsToDelete = this.items.filter(item => itemIds.includes(item.id));

        let shouldResetChat = false;
        const currentPath = this.conversationFileSystemService.getCurrentConversationPath();

        for (const item of itemsToDelete) {
            const deleted = await this.fileSystemService.deleteFile(item.filePath, true);
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

        this.onModalClose?.();
    }
}
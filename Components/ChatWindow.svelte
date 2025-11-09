<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import ChatArea from "./ChatArea.svelte";
  import ChatInput from "./ChatInput.svelte";
	import { tick, onMount } from "svelte";
  import { conversationStore } from "../Stores/ConversationStore";
  import { Conversation } from "Conversations/Conversation";
	import type VaultAIPlugin from "main";
	import { openPluginSettings } from "Helpers/Helpers";
	import { Selector } from "Enums/Selector";
	import type { WorkSpaceService } from "Services/WorkSpaceService";
  import type { ChatService } from "Services/ChatService";
  import type { ConversationFileSystemService } from "Services/ConversationFileSystemService";
	import type { SettingsService } from "Services/SettingsService";

  const plugin: VaultAIPlugin = Resolve<VaultAIPlugin>(Services.VaultAIPlugin);
  const settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
  const chatService: ChatService = Resolve<ChatService>(Services.ChatService);
  const workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
  const conversationService: ConversationFileSystemService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);

  let chatContainer: HTMLDivElement;
  let chatArea: ChatArea;
  let chatInput: ChatInput;

  let hasNoApiKey = false;
  let isSubmitting = false;
  let editModeActive = false;
  let currentStreamingMessageId: string | null = null;

  let conversation: Conversation = new Conversation();

  let currentThought: string | null = null;

  export function focusInput() {
    chatInput?.focusInput();
  }

  export function resetChatArea() {
    chatArea.resetChatArea();
  }

  onMount(() => {
    if (chatContainer) {
      plugin.registerDomEvent(chatContainer, 'click', handleLinkClick);
    }
    chatService.setStatusBarTokens(0, 0);
  });

  async function handleLinkClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement;

    const link = target.closest(`.${Selector.MarkDownLink}`) as HTMLAnchorElement | null;
    if (!link) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#/page/')) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    const encodedPath = href.replace('#/page/', '');
    const notePath = decodeURIComponent(encodedPath);
    await workSpaceService.openNote(notePath);
  }

  function handleNoApiKey(): boolean {
    hasNoApiKey = settingsService.getApiKeyForCurrentModel().trim() == "";
    if (hasNoApiKey) {
      openPluginSettings(plugin);
    }
    return hasNoApiKey;
  }

  function toggleEditMode() {
    editModeActive = !editModeActive;
    focusInput();
  }

  function handleStop() {
    chatService.stop();
    currentThought = null;
    isSubmitting = false;
    chatArea.scrollChatArea("smooth");
  }

  async function handleSubmit(userRequest: string, formattedRequest: string) {
    focusInput();

    if (handleNoApiKey()) {
      return;
    }

    const currentRequest = userRequest;

    await chatService.submit(conversation, editModeActive, currentRequest, formattedRequest, {
      onSubmit: () => {
        chatArea.scrollChatArea("smooth");
        isSubmitting = true;
      },
      onStreamingUpdate: (streamingId) => {
        conversation = conversation;
        currentStreamingMessageId = streamingId;
      },
      onThoughtUpdate: (thought) => {
        currentThought = thought;
      },
      onComplete: () => {
        isSubmitting = false;
        chatArea.scrollChatArea(undefined);
        chatService.updateTokenDisplay(conversation);
      }
    });
  }

  $: if ($conversationStore.shouldReset) {
    conversation = new Conversation();
    chatService.setStatusBarTokens(0, 0);
    conversationStore.clearResetFlag();
  }

  $: if ($conversationStore.conversationToLoad) {
    conversation.contents = [];
    chatArea.resetChatArea();

    tick().then(() => {
      if ($conversationStore.conversationToLoad) {
        const { conversation: loadedConversation, filePath } = $conversationStore.conversationToLoad;
        conversation = loadedConversation;
        conversationService.setCurrentConversationPath(filePath);
        chatService.onNameChanged?.(loadedConversation.title);
        chatService.updateTokenDisplay(loadedConversation);
        conversationStore.clearLoadFlag();
        chatArea.scrollChatArea("instant");
      }
    });
  }

  $: if ($conversationStore.shouldDeactivateEditMode) {
    conversationStore.clearEditModeFlag();
    editModeActive = false;
  }
</script>

<main class="container">
  <div id="chat-container">
    <ChatArea messages={conversation.contents} bind:this={chatArea} bind:currentThought bind:isSubmitting bind:chatContainer
      currentStreamingMessageId={currentStreamingMessageId} editModeActive={editModeActive}/>
  </div>

  <ChatInput
    bind:this={chatInput}
    {hasNoApiKey}
    {isSubmitting}
    {editModeActive}
    onsubmit={handleSubmit}
    ontoggleeditmode={toggleEditMode}
    onstop={handleStop}
  />
</main>

<style>
  .container {
    display: grid;
    grid-template-rows: 1fr auto var(--size-2-1);
    grid-template-columns: 1fr;
    height: calc(100% - var(--size-4-16));
    border-radius: var(--radius-m);
    color: var(--font-interface-theme);
  }

  #chat-container {
    height: 100%;
    width: 100%;
    max-width: 1000px;
    justify-self: center;
    user-select: text;
    grid-row: 1;
    grid-column: 1;
    overflow: hidden;
  }
</style>
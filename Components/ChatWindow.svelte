<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import ChatArea from "./ChatArea.svelte";
	import { tick, onMount } from "svelte";
  import { setIcon } from "obsidian";
  import { conversationStore } from "../Stores/conversationStore";
  import { Conversation } from "Conversations/Conversation";
	import type AIAgentPlugin from "main";
	import { openPluginSettings } from "Helpers/Helpers";
	import { Selector } from "Enums/Selector";
	import type { WorkSpaceService } from "Services/WorkSpaceService";
  import type { ChatService } from "Services/ChatService";
  import type { ConversationFileSystemService } from "Services/ConversationFileSystemService";

  let plugin: AIAgentPlugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
  let chatService: ChatService = Resolve<ChatService>(Services.ChatService);
  let workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
  let conversationService: ConversationFileSystemService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);

  let textareaElement: HTMLDivElement;
  let chatContainer: HTMLDivElement;
  let submitButton: HTMLButtonElement;
  let editModeButton: HTMLButtonElement;
  let chatArea: ChatArea;

  let userRequest = "";
  let hasNoApiKey = false;
  let isSubmitting = false;
  let editModeActive = false;
  let currentStreamingMessageId: string | null = null;

  let conversation: Conversation = new Conversation();

  let currentThought: string | null = null;

  export function focusInput() {
    tick().then(() => {
      textareaElement?.focus();
    });
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
    hasNoApiKey = plugin.settings.apiKey.trim() == "";
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

  async function handleSubmit() {
    focusInput();

    if (handleNoApiKey()) {
      return;
    }

    if (userRequest.trim() === "" || isSubmitting) {
      return;
    }

    const currentRequest = userRequest;

    textareaElement.textContent = "";
    userRequest = "";

    await chatService.submit(conversation, editModeActive, currentRequest, {
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      } else {
        e.preventDefault();
        handleSubmit();
      }
    }
  }

  function handleInput() {
    if (textareaElement) {
      userRequest = textareaElement.textContent || "";
      if (userRequest.trim() === "") {
        textareaElement.textContent = "";
      }
    }
  }

  $: if (submitButton) {
    setIcon(submitButton, isSubmitting ? "square" : "send-horizontal");
  }

  $: if (editModeButton) {
    setIcon(editModeButton, editModeActive ? "pencil" : "pencil-off");
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
  
  <div id="input-container" class:edit-mode={editModeActive}>
    <div
      id="input-field"
      class:error={hasNoApiKey}
      class:edit-mode={editModeActive && !hasNoApiKey}
      bind:this={textareaElement}
      contenteditable="true"
      on:keydown={handleKeydown}
      on:input={handleInput}
      data-placeholder="Type a message..."
      role="textbox"
      aria-multiline="true"
      tabindex="0">
    </div>
  
    <button
      id="edit-mode-button"
      class:edit-mode={editModeActive}
      bind:this={editModeButton}
      on:click={() => { toggleEditMode() }}
      disabled={isSubmitting}
      aria-label={editModeActive ? "Turn off Agent Mode" : "Turn on Agent Mode"}>
    </button>

    <button
      id="submit-button"
      class:edit-mode={editModeActive}
      bind:this={submitButton}
      on:click={() => { isSubmitting ? handleStop() : handleSubmit() }}
      disabled={!isSubmitting && userRequest.trim() === ""}
      aria-label={isSubmitting ? "Cancel" : "Send Message"}>
    </button>
  </div>
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

  #input-container {
    grid-row: 2;
    grid-column: 1;
    display: grid;
    grid-template-rows: var(--size-4-3) 1fr var(--size-4-3);
    grid-template-columns: var(--size-4-3) 1fr var(--size-4-2) auto var(--size-4-2) auto var(--size-4-3);
    border-radius: var(--modal-radius);
    background-color: var(--background-primary);
  }

  #input-container.edit-mode {
    border-color: var(--alt-interactive-accent);
    transition: border-color 0.5s ease-out;
  }

  #input-field {
    grid-row: 2;
    grid-column: 2;
    height: 100%;
    max-height: 30vh;
    border-radius: var(--input-radius);
    font-weight: var(--input-font-weight);
    border-width: var(--input-border-width);
    border-style: solid;
    border-color: var(--background-modifier-border);
    padding: var(--size-2-2) var(--size-2-3);
    background-color: var(--background-primary);
    font-family: var(--font-interface-theme);
    resize: none;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
    color: var(--font-interface-theme);
    transition: border-color 0.5s ease-out;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  #input-field:focus {
    border-color: var(--color-accent);
    box-shadow: 0px 0px 4px 1px var(--color-accent);
    transition: border-color 0.5s ease-out;
  }
  
  #input-field.edit-mode:focus {
    border-color: var(--alt-interactive-accent);
    box-shadow: 0px 0px 3px 1px var(--alt-interactive-accent);
    transition: border-color 0.5s ease-out;
  }

  #input-field.error,
  #input-field.error:focus {
    border-color: var(--color-red);
    box-shadow: 0px 0px 4px 1px var(--color-red);
    transition: border-color 0.5s ease-out;
  }

  #input-field::-webkit-scrollbar {
    display: none;
  }

  #input-field:empty::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    opacity: 0.75;
    pointer-events: none;
  }

  #input-field[contenteditable]:focus {
    outline: none;
  }

  #edit-mode-button {
    grid-row: 2;
    grid-column: 4;
    border-radius: var(--button-radius);
    align-self: end;
    transition-duration: 0.5s;
  }

  #submit-button {
    grid-row: 2;
    grid-column: 6;
    border-radius: var(--button-radius);
    padding-left: var(--size-4-5);
    padding-right: var(--size-4-5);
    align-self: end;
    transition-duration: 0.5s;
    background-color: var(--interactive-accent);
  }

  #submit-button:not(:disabled):hover {
    cursor: pointer;
    background-color: var(--interactive-accent-hover);
  }

  #submit-button.edit-mode {
    background-color: var(--alt-interactive-accent);
  }

  #submit-button.edit-mode:not(:disabled):hover {
    cursor: pointer;
    background-color: var(--alt-interactive-accent-hover);
  }
</style>
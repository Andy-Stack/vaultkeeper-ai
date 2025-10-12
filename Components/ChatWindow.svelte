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

  let textareaElement: HTMLTextAreaElement;
  let chatContainer: HTMLDivElement;
  let submitButton: HTMLButtonElement;
  let chatArea: ChatArea;

  let userRequest = "";
  let hasNoApiKey = false;
  let isSubmitting = false;
  let isStreaming = false;
  let currentStreamingMessageId: string | null = null;

  let conversation = new Conversation();

  let currentThought: string | null = null;

  export function focusInput() {
    tick().then(() => {
      textareaElement?.focus();
    });
  }

  onMount(() => {
    if (chatContainer) {
      plugin.registerDomEvent(chatContainer, 'click', handleLinkClick);
    }
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

  function handleStop() {
    chatService.stop();
    currentThought = null;
    isSubmitting = false;
    chatArea.onFinishedSubmitting();
  }

  async function handleSubmit() {
    focusInput();

    if (handleNoApiKey()) {
      return;
    }

    if (userRequest.trim() === "" || isSubmitting) {
      return;
    }

    isSubmitting = true;
    const currentRequest = userRequest;

    textareaElement.value = "";
    userRequest = "";
    autoResize();
    scrollToBottom();

    conversation = await chatService.submit(conversation, currentRequest, {
      onStreamingUpdate: (updatedConversation, streamingId, streaming) => {
        conversation = updatedConversation;
        currentStreamingMessageId = streamingId;
        isStreaming = streaming;
      },
      onThoughtUpdate: (thought) => {
        currentThought = thought;
      },
      onComplete: () => {
        isSubmitting = false;
        chatArea.onFinishedSubmitting();
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

  function autoResize() {
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = textareaElement.scrollHeight + 'px';
    }
  }

  function scrollToBottom() {
    tick().then(() => {
      if (chatContainer) {
        chatContainer.scroll({
          top: chatContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  }

  $: if (submitButton) {
    setIcon(submitButton, isSubmitting ? 'square' : 'send-horizontal');
  }

  $: if ($conversationStore.shouldReset) {
    conversation = new Conversation();
    conversationStore.clearResetFlag();
  }

  $: if ($conversationStore.conversationToLoad) {
    const { conversation: loadedConversation, filePath } = $conversationStore.conversationToLoad;
    conversation = loadedConversation;
    conversationService.setCurrentConversationPath(filePath);
    conversationStore.clearLoadFlag();
    scrollToBottom();
  }
</script>

<main class="container">
  <div id="chat-container">
    <ChatArea messages={conversation.contents} bind:this={chatArea} bind:currentThought bind:isSubmitting bind:chatContainer currentStreamingMessageId={currentStreamingMessageId}/>
  </div>
  
  <div id="input-container">
    <textarea
      id="input"
      class:error={hasNoApiKey}
      bind:this={textareaElement}
      bind:value={userRequest}
      on:keydown={handleKeydown}
      on:input={autoResize}
      placeholder="Type a message..."
      rows="1">
    </textarea>
  
    <button
      id="submit"
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
    max-width: 40vw;
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
    grid-template-columns: var(--size-4-3) 1fr var(--size-4-3) auto var(--size-4-3);
    border-radius: var(--modal-radius);
    background-color: var(--color-base-00);
  }

  #input {
    grid-row: 2;
    grid-column: 2;
    min-height: var(--input-height);
    max-height: 30vh;
    border-radius: var(--input-radius);
    font-weight: var(--input-font-weight);
    border-width: var(--input-border-width);
    resize: none;
    overflow-y: auto;
    scroll-behavior: smooth;
    color: var(--font-interface-theme);
    transition: border-color 0.3s ease-out;
  }

  #input:focus {
    border-color: var(--color-accent);
    transition: border-color 0.3s ease-out;
  }

  #input.error,
  #input.error:focus {
    border-color: var(--color-red);
  }

  #input::-webkit-scrollbar {
    display: none;
  }

  #submit {
    grid-row: 2;
    grid-column: 4;
    border-radius: var(--button-radius);
    align-self: end;
    background-color: var(--interactive-accent);
    transition-duration: 0.25s;
  }

  #submit:not(:disabled):hover {
    cursor: pointer;
    background-color: var(--interactive-accent-hover);
  }
</style>
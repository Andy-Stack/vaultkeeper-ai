<script lang="ts">
  import { Resolve } from '../Services/DependencyService';
  import { Services } from '../Services/Services';
  import type AIAgentPlugin from '../main';
  import { setIcon, type WorkspaceLeaf } from 'obsidian';
  import { ConversationFileSystemService } from '../Services/ConversationFileSystemService';
  import { conversationStore } from '../Stores/ConversationStore';
	import type { ConversationHistoryModal } from 'Modals/ConversationHistoryModal';
	import { openPluginSettings } from 'Helpers/Helpers';
	import type { ChatService } from 'Services/ChatService';
	import { fade } from 'svelte/transition';

  export let leaf: WorkspaceLeaf;
  export let onNewConversation: (() => void) | undefined = undefined;

  const plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
  const conversationFileSystemService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
  const chatService: ChatService = Resolve<ChatService>(Services.ChatService);

  let conversationTitle: string = ""

  chatService.onNameChanged = (name: string) => {
    conversationTitle = "";
    setTimeout(() => conversationTitle = name, 500);
  };

  function startNewConversation() {
    conversationFileSystemService.resetCurrentConversation();
    conversationStore.reset();
    onNewConversation?.();
    conversationTitle = "";
  }

  async function deleteCurrentConversation() {
    chatService.stop();
    await conversationFileSystemService.deleteCurrentConversation();
    conversationStore.reset();
    onNewConversation?.();
    conversationTitle = "";
  }

  function openConversationHistory() {
    const modal = Resolve<ConversationHistoryModal>(Services.ConversationHistoryModal);
    modal.onModalClose = onNewConversation;
    modal.open();
  }

  function openSettings() {
    openPluginSettings(plugin);
  }

  function closePlugin() {
    leaf.detach();
  }

  let newConversationButton: HTMLButtonElement;
  let deleteConversationButton: HTMLButtonElement;
  let conversationHistoryButton: HTMLButtonElement;
  let settingsButton: HTMLButtonElement;
  let closeButton: HTMLButtonElement;

  $: if (newConversationButton) {
    setIcon(newConversationButton, 'plus');
  }
  $: if (deleteConversationButton) {
    setIcon(deleteConversationButton, 'trash-2');
  }
  $: if (conversationHistoryButton) {
    setIcon(conversationHistoryButton, 'messages-square');
  }
  $: if (settingsButton) {
    setIcon(settingsButton, 'settings');
  }
  $: if (closeButton) {
    setIcon(closeButton, 'circle-x');
  }
</script>

<main class="top-bar">
  <div class="top-bar-content">
    <button
      bind:this={newConversationButton}
      id="new-conversation-button"
      class="top-bar-button clickable-icon"
      on:click={() => startNewConversation()}
      aria-label="New Conversation"
    ></button>
    <button
      bind:this={deleteConversationButton}
      id="delete-conversation-button"
      class="top-bar-button clickable-icon"
      on:click={() => deleteCurrentConversation()}
      aria-label="Delete Conversation"
    ></button>
    <button
      bind:this={conversationHistoryButton}
      id="conversation-history-button"
      class="top-bar-button clickable-icon"
      on:click={() => openConversationHistory()}
      aria-label="Conversation History"
    ></button>
    <div id="conversation-divider-1" class="top-bar-divider"></div>
    <button
      bind:this={settingsButton}
      id="settings-button"
      class="top-bar-button clickable-icon"
      on:click={openSettings}
      aria-label="AI Agent Settings"
    ></button>
    {#if conversationTitle !== ""}
      <div id="conversation-divider-2" class="top-bar-divider" out:fade></div>
      <div id="conversation-title" class="typing-in" out:fade>{conversationTitle}</div>
    {/if}
    <button
      bind:this={closeButton}
      id="close-button"
      class="top-bar-button clickable-icon"
      on:click={closePlugin}
      aria-label="Close AI Agent"
    ></button>
  </div>
</main>

<style>
  .top-bar {
    display: grid;
    background-color: transparent;
    grid-template-rows: var(--size-4-3) 1fr var(--size-4-3);
    grid-template-columns: var(--size-4-3) 1fr var(--size-4-3);
    height: var(--size-4-16);
    margin-left: calc(var(--size-4-3) * -1);
    margin-right: calc(var(--size-4-3) * -1);
  }

  .top-bar-content {
    grid-row: 2;
    grid-column: 2;
    display: grid;
    grid-template-rows: auto;
    grid-template-columns: var(--size-4-2) auto auto auto auto auto auto 1fr 0.1fr auto var(--size-4-2);
    background-color: var(--background-modifier-hover);
    border-radius: var(--radius-m);
  }

  .top-bar-divider {
    width: var(--divider-width);
    height: auto;
    background: var(--background-modifier-border-hover);
    margin: var(--size-4-2) var(--size-4-3);
  }

  #new-conversation-button {
    grid-row: 1;
    grid-column: 2;
  }

  #delete-conversation-button {
    grid-row: 1;
    grid-column: 3;
  }

  #conversation-history-button {
    grid-row: 1;
    grid-column: 4;
  }

  #conversation-divider-1 {
    grid-row: 1;
    grid-column: 5;
  }

  #settings-button {
    grid-row: 1;
    grid-column: 6;
  }

  #conversation-divider-2 {
    grid-row: 1;
    grid-column: 7;
  }

  #conversation-title {
    grid-row: 1;
    grid-column: 8;
    display: inline-block;
    align-self: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    color: var(--text-muted);
  }

  #close-button {
    grid-row: 1;
    grid-column: 10;
  }
</style>

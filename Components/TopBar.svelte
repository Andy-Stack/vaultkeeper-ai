<script lang="ts">
  import { Resolve } from '../Services/DependencyService';
  import { Services } from '../Services/Services';
  import type AIAgentPlugin from '../main';
  import { setIcon, type WorkspaceLeaf } from 'obsidian';
  import { ConversationFileSystemService } from '../Services/ConversationFileSystemService';
  import { conversationStore } from '../Stores/conversationStore';

  export let leaf: WorkspaceLeaf;

  const plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
  const conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);

  function startNewConversation() {
    conversationService.resetCurrentConversation();
    conversationStore.reset();
  }

  async function deleteCurrentConversation() {
    await conversationService.deleteCurrentConversation();
    conversationStore.reset();
  }

  function openConversationHistory() {
    
  }

  function openSettings() {
    // @ts-ignore - accessing internal API
    plugin.app.setting.open();
    // @ts-ignore - accessing internal API
    plugin.app.setting.openTabById(plugin.manifest.id);
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
    <div id="conversation-divider" class="top-bar-divider"></div>
    <button
      bind:this={settingsButton}
      id="settings-button"
      class="top-bar-button clickable-icon"
      on:click={openSettings}
      aria-label="AI Agent Settings"
    ></button>
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
    grid-template-columns: var(--size-4-2) auto auto auto auto auto 1fr auto var(--size-4-2);
    background-color: var(--color-base-30);
    border-radius: var(--radius-m);
  }

  .top-bar-button {
    margin: var(--size-4-2) 0px var(--size-4-2) 0px;
    padding: var(--size-4-1) var(--size-4-2) var(--size-4-1) var(--size-4-2);
    color: var(--text-muted);
  }

  .top-bar-button:hover {
    background-color: var(--color-base-35);
  }

  .top-bar-divider {
    width: var(--divider-width);
    height: auto;
    background: var(--color-base-35);
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

  #conversation-divider {
    grid-row: 1;
    grid-column: 5;
  }

  #settings-button {
    grid-row: 1;
    grid-column: 6;
  }

  #close-button {
    grid-row: 1;
    grid-column: 8;
  }
</style>

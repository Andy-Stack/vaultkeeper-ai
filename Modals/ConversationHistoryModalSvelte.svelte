<script lang="ts">
	import { setIcon } from "obsidian";
	import { fade } from "svelte/transition";

    export let items: Array<{id: string, date: string, title: string, selected: boolean}>;
    export let onClose: () => void;
    export let onDelete: (itemIds: string[]) => void;
  
    let deleteButton: HTMLButtonElement;
    let closeButton: HTMLButtonElement;

    $: if (deleteButton) {
      setIcon(deleteButton, 'trash-2');
    }
    $: if (closeButton) {
      setIcon(closeButton, 'circle-x');
    }

    let selectedItems = new Set<string>();
  
    function toggleSelection(itemId: string) {
      if (selectedItems.has(itemId)) {
        selectedItems.delete(itemId);
      } else {
        selectedItems.add(itemId);
      }
      selectedItems = selectedItems;
    }
  
    function handleDelete() {
      if (selectedItems.size === 0) {
        return;
      }
      onDelete(Array.from(selectedItems));
      selectedItems.clear();
      selectedItems = selectedItems;
    }
  </script>

  <div class="conversation-history-modal-container">
    <div class="conversation-history-modal-top-bar">
      <div class="conversation-history-modal-top-bar-content">
        <button
          bind:this={closeButton}
          id="close-button"
          class="top-bar-button clickable-icon"
          on:click={onClose}
          aria-label="Close Conversation History"
        ></button>
        {#if selectedItems.size > 0}
        <button
          bind:this={deleteButton}
          in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}
          id="delete-button"
          class="top-bar-button clickable-icon"
          on:click={handleDelete}
          aria-label="Delete Selected Conversations"
        ></button>
        {/if}
      </div>
    </div>
    <div class="conversation-history-modal-content">
      {#if items.length === 0}
      <p class="history-empty-state">
        Conversation history is empty.
      </p>
      {:else}
      {#each items as item (item.id)}
      <div class="history-list-modal-content">
        <span class="history-list-modal-date">{item.date}</span>
        <span class="history-list-modal-separator">|</span>
        <span class="history-list-modal-title">{item.title}</span>
        <input 
          type="checkbox" 
          class="history-list-modal-checkbox"
          checked={selectedItems.has(item.id)}
          on:change={() => toggleSelection(item.id)}
        />
      </div>
      {/each}
      {/if}
    </div>
  </div>
  
  <style>
    .conversation-history-modal-container {
      display: grid;
      grid-template-rows: var(--size-4-3) auto var(--size-4-3) 1fr var(--size-4-3);
      grid-template-columns: var(--size-4-3) 1fr var(--size-4-3);
    }

    .conversation-history-modal-top-bar {
      grid-row: 2;
      grid-column: 2;
      height: var(--size-4-16);
      display: grid;
      grid-template-rows: var(--size-4-3) 1fr var(--size-4-3);
      grid-template-columns: 1fr;
    }

    .conversation-history-modal-top-bar-content {
      grid-row: 2;
      grid-column: 1;
      display: grid;
      grid-template-rows: auto;
      grid-template-columns: var(--size-4-2) auto 1fr auto var(--size-4-2);
      background-color: var(--color-base-30);
      border-radius: var(--radius-m);
    }

    .conversation-history-modal-content {
      grid-row: 4;
      grid-column: 2;
      min-height: 10vh;
      overflow: scroll;
      scroll-behavior: smooth;
    }

    .conversation-history-modal-content::-webkit-scrollbar {
      display: none;
    }

    .history-empty-state {
      margin: 3vh 0px;
      text-align: center;
      color: var(--text-muted);
    }

    .history-list-modal-content {
      display: grid;
      grid-template-rows: 1fr;
      grid-template-columns: auto auto 1fr auto;
    }

    .history-list-modal-date {
      grid-row: 1;
      grid-column: 1;
      margin: 0px var(--size-2-3) 0px var(--size-4-3)
    }

    .history-list-modal-separator {
      grid-row: 1;
      grid-column: 2;
      color: var(--color-base-35);
      margin: 0px var(--size-4-3);
    }

    .history-list-modal-title {
      grid-row: 1;
      grid-column: 3;
      display: inline-block;
      max-width: 80%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .history-list-modal-checkbox {
      grid-row: 1;
      grid-column: 4;
      margin: 0px var(--size-4-3) 0px var(--size-2-3)
    }

    #delete-button {
      grid-row: 1;
      grid-column: 2;
    }

    #close-button {
      grid-row: 1;
      grid-column: 4;
    }
  </style>
<script lang="ts">
	import { Copy } from "Enums/Copy";
	import { setIcon } from "obsidian";
	import { fade } from "svelte/transition";
	import Spinner from "Components/Spinner.svelte";
	import type { IListItem } from "./ConversationHistoryModal";

  let {
    items = $bindable(),
    loading = false,
    onClose,
    onDelete,
    onSelect
  }: {
    items: Array<IListItem>;
    loading?: boolean;
    onClose: () => void;
    onDelete: (itemIds: string[]) => void;
    onSelect: (itemId: string) => void;
  } = $props();

  let deleteButton: HTMLButtonElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (deleteButton) {
      setIcon(deleteButton, 'trash-2');
    }
  });
  $effect(() => {
    if (closeButton) {
      setIcon(closeButton, 'circle-x');
    }
  });

  let selectedItems = $state(new Set<string>());
  let searchQuery = $state("");

  let filteredItems = $derived(items.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => b.updated.getTime() - a.updated.getTime()));

  function toggleSelection(itemId: string) {
    if (selectedItems.has(itemId)) {
      selectedItems.delete(itemId);
    } else {
      selectedItems.add(itemId);
    }
    selectedItems = new Set(selectedItems);
  }

  function toggleAll(state: boolean) {
    selectedItems = state ? new Set(items.map(item => item.id)) : new Set();
  }

  function handleDelete() {
    if (selectedItems.size === 0) {
      return;
    }
    onDelete(Array.from(selectedItems));
    items = items.filter((item) => !selectedItems.has(item.id))
    selectedItems = new Set();
  }

  function handleConversationClick(itemId: string, event: UIEvent) {
    onSelect(itemId);
  }

  let contentElement: HTMLDivElement | undefined = $state();
  let isScrolledToTop = $state(true);
  let isScrolledToBottom = $state(true);

  function updateScrollFade() {
    if (!contentElement) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = contentElement;
    isScrolledToTop = scrollTop < 1;
    isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;
  }

  $effect(() => {
    filteredItems;
    loading;
    updateScrollFade();
  });
</script>

<div class="conversation-history-modal-container">
  <div class="conversation-history-modal-top-bar">
    <div class="conversation-history-modal-top-bar-content">
      <button
        bind:this={deleteButton}
        id="delete-button"
        class="top-bar-button clickable-icon"
        class:hidden={selectedItems.size === 0}
        onclick={handleDelete}
        aria-label="Delete Selected Conversations"
      ></button>
      <input
        type="text"
        id="search-input"
        class="top-bar-button conversation-search-input"
        placeholder="Search conversations..."
        disabled={items.length === 0}
        bind:value={searchQuery}
        aria-label="Search Conversations"
      />
      <button
        bind:this={closeButton}
        id="close-button"
        class="top-bar-button clickable-icon"
        onclick={onClose}
        aria-label="Close Conversation History"
      ></button>
    </div>
  </div>
  <div class="conversation-history-modal-content-wrapper">
    <div class="conversation-history-modal-content" bind:this={contentElement} onscroll={updateScrollFade}>
      {#if loading}
        <div class="history-loading-state" in:fade={{ duration: 200 }}>
          <Spinner />
        </div>
      {:else if filteredItems.length === 0}
        <p class="history-empty-state" in:fade={{ duration: 200 }}>
          {Copy.NoConversationsFound}
        </p>
      {:else}
        <div class="history-list-modal-list" transition:fade={{ duration: 200 }}>
          <span class="history-list-modal-date history-list-modal-header">Date</span>
          <span class="history-list-modal-separator history-list-modal-header">|</span>
          <span class="history-list-modal-title history-list-modal-header">Title</span>
          <input
            type="checkbox"
            class="history-list-modal-checkbox"
            onchange={(event) => toggleAll(event.currentTarget.checked)}
          />
          {#each filteredItems as item (item.id)}
            <span class="history-list-modal-date history-list-modal-clickable"
              onclick={(e) => handleConversationClick(item.id, e)}
              onkeydown={(e) => e.key === 'Enter' && handleConversationClick(item.id, e)}
              role="button"
              tabindex="0">{item.date}</span>
            <span class="history-list-modal-separator history-list-modal-clickable"
              onclick={(e) => handleConversationClick(item.id, e)}
              onkeydown={(e) => e.key === 'Enter' && handleConversationClick(item.id, e)}
              role="button"
              tabindex="0">|</span>
            <span class="history-list-modal-title history-list-modal-clickable"
              onclick={(e) => handleConversationClick(item.id, e)}
              onkeydown={(e) => e.key === 'Enter' && handleConversationClick(item.id, e)}
              role="button"
              tabindex="0">{item.title}</span>
            <input
              type="checkbox"
              class="history-list-modal-checkbox"
              checked={selectedItems.has(item.id)}
              onchange={() => toggleSelection(item.id)}
            />
          {/each}
        </div>
      {/if}
    </div>
    <div class="history-fade top" class:hidden={isScrolledToTop}></div>
    <div class="history-fade bottom" class:hidden={isScrolledToBottom}></div>
  </div>
</div>

<style>
  .conversation-history-modal-container {
    display: grid;
    grid-template-rows: auto 1fr var(--size-4-1);
    grid-template-columns: var(--size-4-2) 1fr var(--size-4-2);
    max-height: 60vh;
    margin: 10px;
  }

  .conversation-history-modal-top-bar {
    grid-row: 1;
    grid-column: 2;
    display: grid;
    grid-template-rows: var(--size-4-2) 1fr var(--size-4-2);
    grid-template-columns: 1fr;
  }

  .conversation-history-modal-top-bar-content {
    grid-row: 2;
    grid-column: 1;
    display: grid;
    grid-template-rows: auto;
    grid-template-columns: var(--size-4-2) auto 1fr var(--size-4-2) auto var(--size-4-2);
    background-color: var(--background-secondary-alt);
    border-radius: var(--radius-m);
  }

  .conversation-history-modal-content-wrapper {
    grid-row: 2;
    grid-column: 2;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .conversation-history-modal-content {
    flex: 1;
    min-height: 0;
    overflow: scroll;
    scroll-behavior: smooth;
  }

  .history-fade {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--size-4-8);
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.2s ease-out;
  }

  .history-fade.top {
    top: 0;
    background-image: linear-gradient(to top, transparent, var(--modal-background));
  }

  .history-fade.bottom {
    bottom: 0;
    background-image: linear-gradient(to bottom, transparent, var(--modal-background));
  }

  .history-fade.hidden {
    opacity: 0;
  }

  .conversation-history-modal-content::-webkit-scrollbar {
    display: none;
  }

  .history-empty-state {
    margin: 3vh 0px;
    text-align: center;
    color: var(--text-muted);
  }

  .history-loading-state {
    display: flex;
    justify-content: center;
    margin: 3vh 0px;
  }

  .history-list-modal-list {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    gap: 0;
    align-items: center;
  }

  :global(.is-mobile) .history-list-modal-list {
    margin-top: var(--size-4-1);
  }

  .history-list-modal-header {
    padding: var(--size-2-2) 0;
    color: var(--text-muted);
  }

  .history-list-modal-clickable {
    cursor: pointer;
    padding: var(--size-2-2) 0;
    transition: background-color 0.2s ease;
  }

  .history-list-modal-clickable:hover {
    background-color: var(--background-secondary);
  }

  .history-list-modal-clickable:active {
    background-color: var(--background-secondary-alt);
  }

  .history-list-modal-date {
    margin-left: var(--size-4-3);
  }

  .history-list-modal-separator {
    color: var(--text-faint);
    margin: 0px var(--size-4-3);
  }

  .history-list-modal-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .history-list-modal-checkbox {
    margin: 0px var(--size-4-3) 0px var(--size-2-3);
  }

  #delete-button {
    grid-row: 1;
    grid-column: 2;
    margin-right: var(--size-4-2);
    transition: width 300ms ease-out, opacity 300ms ease-out, padding 300ms ease-out, margin 300ms ease-out;
  }

  #delete-button.hidden {
    width: 0;
    min-width: 0;
    padding: 0;
    opacity: 0;
    margin: 0;
    overflow: hidden;
    pointer-events: none;
  }

  #close-button {
    grid-row: 1;
    grid-column: 5;
  }

  #search-input {
    grid-row: 1;
    grid-column: 3;
  }

  .conversation-search-input {
    max-width: 200px;
    background-color: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    padding: var(--size-2-1) var(--size-2-3);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    outline: none;
    transition: border-color 0.3s ease-out;
    transition: max-width 0.3s ease-out;
  }

  .conversation-search-input:focus {
    border-color: var(--color-accent);
    max-width: 100%;
    transition: border-color 0.3s ease-out;
    transition: max-width 0.3s ease-out;
  }

  .conversation-search-input::placeholder {
    color: var(--text-muted);
  }

  @media (max-width: 600px) {
		.conversation-history-modal-container {
			margin: 0px;
		}
	}
</style>
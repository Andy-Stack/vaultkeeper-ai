<script lang="ts">
  import { Resolve } from '../Services/DependencyService';
  import { Services } from '../Services/Services';
  import type AIAgentPlugin from '../main';
  import { setIcon, type WorkspaceLeaf } from 'obsidian';

  export let leaf: WorkspaceLeaf;

  const plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);

  function openSettings() {
    // @ts-ignore - accessing internal API
    plugin.app.setting.open();
    // @ts-ignore - accessing internal API
    plugin.app.setting.openTabById(plugin.manifest.id);
  }

  function closePlugin() {
    leaf.detach();
  }

  let settingsButton: HTMLButtonElement;
  let closeButton: HTMLButtonElement;

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
    grid-template-columns: var(--size-4-2) auto 1fr auto var(--size-4-2);
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

  #settings-button {
    grid-row: 1;
    grid-column: 2;
  }

  #close-button {
    grid-row: 1;
    grid-column: 4;
  }
</style>

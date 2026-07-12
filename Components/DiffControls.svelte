<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import type { DiffService } from "Services/DiffService";
  import { Services } from "Services/Services";
  import { tick } from "svelte";

  export let diffOpen = false;

  const diffService: DiffService = Resolve<DiffService>(Services.DiffService);

  let contentDiv: HTMLDivElement;
  let height = 0;

  $: diffOpen, updateHeight();

  function updateHeight() {
    tick().then(() => {
      if (contentDiv) {
        height = contentDiv.scrollHeight;
      }
    });
  }
</script>

<div id="diff-controls-wrapper" style:height="{height}px">
  <div id="diff-controls" bind:this={contentDiv}>
    {#if diffOpen}
      <button
        id="diff-accept"
        class="diff-button"
        aria-label="Accept"
        on:click={() => diffService.onAccept()}>
        Accept
      </button>
      <button
        id="diff-reject"
        class="diff-button"
        aria-label="Reject"
        on:click={() => diffService.onReject()}>
        Reject
      </button>
    {/if}
  </div>
</div>

<style>
  #diff-controls-wrapper {
    transition: height 0.2s ease-out;
    overflow: hidden;
  }

  #diff-controls {
    display: grid;
    grid-template-columns: 1fr var(--size-4-2) 1fr;
    grid-template-rows: auto;
  }

  #diff-accept {
    grid-column: 1;
    color: white;
    background-color: #38533a;
  }

  #diff-accept:hover {
    background-color: #537555;
  }

  #diff-accept:focus {
    background-color: #537555;
  }

  #diff-reject {
    grid-column: 3;
    color: white;
    background-color: #593030;
  }

  #diff-reject:hover {
    background-color: #774545;
  }

  #diff-reject:focus {
    background-color: #774545;
  }

  .diff-button {
    transition: background-color 0.2s ease-out;
  }
</style>
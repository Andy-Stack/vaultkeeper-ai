<script lang="ts">
	import { Platform } from "obsidian";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { WorkSpaceService } from "Services/WorkSpaceService";
  import { tick } from "svelte";
	import { VIEW_TYPE_DIFF } from "Views/DiffView";

  export let diffOpen = false;

  let workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);

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

  async function focusDiff() {
    const leaf = workSpaceService.getLeavesOfType(VIEW_TYPE_DIFF)[0];
    if (leaf) {
      await workSpaceService.getWorkSpace().revealLeaf(leaf);
    }
  }
</script>

<div id="diff-controls-wrapper" style:height="{height}px">
  <div id="diff-controls" bind:this={contentDiv}>
    {#if diffOpen}
      <span>Proposed changes are waiting for your review.</span>
      {#if Platform.isPhone}
        <button class="diff-controls-link transparent-button" onclick={focusDiff}>Review changes</button>
      {/if}
    {/if}
  </div>
</div>

<style>
  #diff-controls-wrapper {
    transition: height 0.2s ease-out;
    overflow: hidden;
  }

  #diff-controls {
    display: flex;
    font-size: var(--font-smaller);
  }

  .diff-controls-link {
		color: var(--color-accent-1);
		text-decoration: underline;
    margin-left: var(--size-4-2);
		padding: 0;
		cursor: pointer;
	}
</style>
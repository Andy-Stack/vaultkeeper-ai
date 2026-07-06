<script lang="ts">
  import { fade } from "svelte/transition";
  export let thought: string | null = null;
  export let thoughtIndicatorElement: HTMLElement | undefined = undefined;

  $: isVisible = thought !== null && thought.trim().length > 0;

</script>

{#if isVisible}
  <div class="ai-thought-container" bind:this={thoughtIndicatorElement} transition:fade={{ duration: 300 }}>
    <div class="ai-thought-line">
      <span class="ai-thought-dot"></span>
      <span class="ai-thought-text">{thought}</span>
    </div>
  </div>
{/if}

<style>
  .ai-thought-container {
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .ai-thought-line {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding-left: 0.125rem;
    max-width: 100%;
  }

  .ai-thought-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    margin-top: 5px;
    border-radius: 50%;
    background: var(--text-accent, #a78bfa);
    animation: breathe 1.6s ease-in-out infinite;
  }

  .ai-thought-text {
    font-size: var(--font-smallest);
    color: var(--text-muted);
    font-style: italic;
    line-height: 1.5;
    word-wrap: break-word;
  }

  @keyframes breathe {
    0%, 100% {
      opacity: 0.35;
      transform: scale(0.85);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
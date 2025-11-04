<script lang="ts">
  import { fade } from "svelte/transition";
  export let thought: string | null = null;
  export let thoughtElement: HTMLElement | undefined;
  $: isVisible = thought !== null && thought.trim().length > 0;
</script>

{#if isVisible}
  <div class="ai-thought-container" bind:this={thoughtElement} in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
    <div class="ai-thought-bubble">
      <span>{thought}</span>
    </div>
  </div>
{/if}

<style>
  .ai-thought-container {
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .ai-thought-bubble {
    --border-width: 1px;
    position: relative;
    display: inline-flex;
    align-items: center;
    border-radius: 10px;
    max-width: 100%;
  }

  .ai-thought-bubble span {
    position: relative;
    z-index: 1;
    background: var(--background-primary-alt);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--text-muted);
    font-style: italic;
    word-wrap: break-word;
    width: 100%;
  }

  .ai-thought-bubble::after {
    position: absolute;
    content: "";
    top: calc(-1 * var(--border-width));
    left: calc(-1 * var(--border-width));
    z-index: 0;
    width: calc(100% + var(--border-width) * 2);
    height: calc(100% + var(--border-width) * 2);
    background: linear-gradient(
      60deg,
      hsl(224, 85%, 66%),
      hsl(269, 85%, 66%),
      hsl(314, 85%, 66%),
      hsl(359, 85%, 66%),
      hsl(44, 85%, 66%),
      hsl(89, 85%, 66%),
      hsl(134, 85%, 66%),
      hsl(179, 85%, 66%)
    );
    background-size: 300% 300%;
    background-position: 0 50%;
    border-radius: 10px;
    animation: moveGradient 3s alternate infinite;
  }

  @keyframes moveGradient {
    50% {
      background-position: 100% 50%;
    }
  }
</style>
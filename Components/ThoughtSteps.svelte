<script lang="ts" context="module">
  export type ThoughtStep = { thought: string, isComplete: boolean };
</script>

<script lang="ts">
  import { setElementIcon } from "Helpers/ElementHelper";
  import { StringTools } from "Helpers/StringTools";
  import { fade, slide } from "svelte/transition";

  export let steps: ThoughtStep[] = [];
  export let isLive: boolean = false;

  const liveVisibleStepCount = 2;

  let isExpanded = false;
  let isScrolledToTop = true;
  let isScrolledToBottom = true;

  $: visibleSteps = isExpanded ? steps : isLive ? steps.slice(-liveVisibleStepCount) : [];
  $: hiddenStepCount = steps.length - visibleSteps.length;
  $: toggleLabel = isExpanded
    ? "Collapse"
    : isLive ? `+${hiddenStepCount} earlier` : `${steps.length} ${StringTools.pluralise("step", steps.length)}`;
  $: showToggle = isExpanded || hiddenStepCount > 0;

  function updateScrollFade(element: HTMLElement) {
    const { scrollTop, scrollHeight, clientHeight } = element;
    isScrolledToTop = scrollTop < 1;
    isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;
  }

  function stepsListScrollAction(element: HTMLElement) {
    updateScrollFade(element);
    const handleScroll = () => updateScrollFade(element);
    element.addEventListener("scroll", handleScroll);
    return {
      destroy() {
        element.removeEventListener("scroll", handleScroll);
      }
    };
  }
</script>

{#if steps.length > 0}
  <div class="thought-steps" transition:slide>
    {#if showToggle}
      <button class="thought-steps-toggle" on:click={() => isExpanded = !isExpanded} transition:slide>
        <span>{toggleLabel}</span>
        <span class="thought-steps-toggle-icon" class:expanded={isExpanded} use:setElementIcon={"chevron-right"}></span>
      </button>
    {/if}
    {#if visibleSteps.length > 0}
      <div class="thought-steps-list-wrapper" transition:slide>
        <div class="thought-steps-list" class:expanded={isExpanded} use:stepsListScrollAction>
          {#each visibleSteps as step}
            <div class="thought-step" aria-label={step.thought}>
              {#if step.isComplete}
                <span class="thought-step-complete" use:setElementIcon={"check"}></span>
              {:else}
                <span class="thought-step-dot"></span>
              {/if}
              <span class="thought-step-text">{step.thought}</span>
            </div>
          {/each}
        </div>
        {#if isExpanded}
          <div class="thought-steps-fade top" class:hidden={isScrolledToTop}></div>
          <div class="thought-steps-fade bottom" class:hidden={isScrolledToBottom}></div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .thought-steps {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-1);
    border-left: var(--border-width) solid var(--background-modifier-border);
    padding-left: var(--size-4-3);
    margin-left: var(--size-2-1);
    font-size: var(--font-smallest);
    color: var(--text-muted);
  }

  .thought-steps-toggle {
    display: flex;
    align-items: center;
    gap: var(--size-2-1);
    width: fit-content;
    height: auto;
    padding: 0;
    background: none;
    box-shadow: none;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    cursor: pointer;
  }

  .thought-steps-toggle:hover {
    color: var(--text-muted);
  }

  .thought-steps-toggle-icon {
    display: flex;
    transition: transform 0.2s ease-out;
  }

  .thought-steps-toggle-icon :global(svg) {
    width: var(--size-4-3);
    height: var(--size-4-3);
  }

  .thought-steps-toggle-icon.expanded {
    transform: rotate(90deg);
  }

  .thought-steps-list-wrapper {
    position: relative;
  }

  .thought-steps-list {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-1);
  }

  .thought-steps-list.expanded {
    max-height: 160px;
    overflow: scroll;
  }

  .thought-steps-list::-webkit-scrollbar {
    display: none;
  }

  .thought-step {
    display: grid;
    grid-template-columns: var(--size-4-3) 1fr;
    gap: var(--size-4-2);
    align-items: center;
    flex-shrink: 0;
  }

  .thought-step-dot {
    justify-self: center;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-accent);
    animation: breathe 1.6s ease-in-out infinite;
  }

  .thought-step-complete {
    display: flex;
    justify-content: center;
    color: var(--text-faint);
  }

  .thought-step-complete :global(svg) {
    width: var(--size-4-3);
    height: var(--size-4-3);
  }

  .thought-step-text {
    font-style: italic;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .thought-steps-fade {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--size-4-6);
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.2s ease-out;
  }

  .thought-steps-fade.top {
    top: 0;
    background-image: linear-gradient(to top, transparent, var(--background-secondary));
  }

  .thought-steps-fade.bottom {
    bottom: 0;
    background-image: linear-gradient(to bottom, transparent, var(--background-secondary));
  }

  .thought-steps-fade.hidden {
    opacity: 0;
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

<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
  import type { ConversationContent } from "Conversations/ConversationContent";
  import { setElementIcon } from "Helpers/ElementHelper";
  import { fade } from "svelte/transition";
  import { ArtifactAction, artifactActionToCopy } from "Enums/ArtifactAction";
  import { basename } from "path-browserify";
	import type { Artifact } from "Conversations/Artifact";
	import type { DiffService } from "Services/DiffService";

  export let message: ConversationContent;
  export let isSubmitting: boolean = false;

  let streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);
  let diffService: DiffService = Resolve<DiffService>(Services.DiffService);

  function messageRenderAction(element: HTMLElement, message: ConversationContent) {
    streamingMarkdownService.render(message.getDisplayContent(), element);
    return {
      update(newMessage: ConversationContent) {
        streamingMarkdownService.render(newMessage.getDisplayContent(), element, !isSubmitting);
      }
    };
  }

  function tallyArtifactsByAction(artifacts: { action: ArtifactAction }[]): Partial<Record<ArtifactAction, number>> {
    const tally: Partial<Record<ArtifactAction, number>> = {};
    for (const artifact of artifacts) {
      tally[artifact.action] = (tally[artifact.action] ?? 0) + 1;
    }
    return tally;
  }

  let isScrolledToBottom = true;

  function updateScrollFade(element: HTMLElement) {
    const { scrollTop, scrollHeight, clientHeight } = element;
    isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;
  }

  function artifactsListScrollAction(element: HTMLElement) {
    updateScrollFade(element);
    const handleScroll = () => updateScrollFade(element);
    element.addEventListener("scroll", handleScroll);
    return {
      destroy() {
        element.removeEventListener("scroll", handleScroll);
      }
    };
  }

  function handleArtifactCardClick(artifact: Artifact) {
    diffService.showArtifactDiff(artifact);
  }
</script>

<div class="message-container assistant">
  <div class="message-bubble assistant">
    <div class="markdown-content">
      <div use:messageRenderAction={message} class="streaming-content"></div>
    </div>
    {#if message.artifacts.length > 0}
      {@const artifactTally = tallyArtifactsByAction(message.artifacts)}
      <div class="artifacts-container" in:fade={{ duration: 300 }}>
        <span class="artifacts-container-title">{message.artifacts.length} FILES CHANGED</span>
        <div class="artifacts-tally">
          {#each Object.values(ArtifactAction) as action}
            {#if artifactTally[action]}
              <div class="artifact-tally-container">
                <span class="artifact-tally-ellipse artifact-{action}"></span>
                <span class="artifact-tally-count">{artifactTally[action]}</span>
              </div>
            {/if}
          {/each}
        </div>
        <div class="artifacts-list-wrapper">
          <div class="artifacts-list-container" use:artifactsListScrollAction>
            {#each message.artifacts as artifact}
              <div
                class="artifact-card"
                aria-label="{artifact.filePath}"
                on:click={() => handleArtifactCardClick(artifact)}
                on:keydown={(e) => e.key === 'Enter' && handleArtifactCardClick(artifact)}
                role="button"
                tabindex="0"
              >
                <span class="artifact-ellipse artifact-ellipse-{artifact.action}"></span>
                <div
                 class="artifact-icon"
                 use:setElementIcon={artifact.getIconName()}
                ></div>
                <span class="artifact-name">{basename(artifact.filePath)}</span>
                <span class="artifact-action artifact-action-{artifact.action}">{artifactActionToCopy(artifact.action)}</span>
              </div>
            {/each}
          </div>
          <div class="artifacts-list-fade" class:hidden={isScrolledToBottom}></div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .message-container {
    display: flex;
    text-align: left;
    margin: 0;
    justify-content: flex-start;
    animation: fadeIn 0.5s ease-out forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message-bubble {
    word-wrap: break-word;
    width: 100%;
  }

  .streaming-content {
    justify-content: left;
    min-height: 1em; /* Ensure the element exists for binding */
  }

  /* Streaming message styles */
  .content-fade-in {
    animation: reveal-fade 0.5s ease-in-out forwards;
  }

  @keyframes reveal-fade {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .artifacts-container {
    display: grid;
    grid-template-rows: auto auto;
    grid-template-columns: auto auto;
    width: 100%;
    margin-top: var(--size-4-3);
    margin-bottom: var(--size-4-6);
    gap: var(--size-4-4);
  }

  .artifacts-container-title {
    grid-row: 1;
    grid-column: 1;
    font-size: var(--font-smallest);
  }

  .artifacts-tally {
    grid-row: 1;
    grid-column: 2;
    display: flex;
    flex-direction: row;
  }

  .artifact-tally-container {
    display: flex;
    flex-direction: row;
    margin-left: auto;
    align-items: center;
  }

  .artifact-tally-ellipse {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-left: var(--size-4-2);
  }

  .artifact-create {
    background: var(--color-green);
  }

  .artifact-modify {
    background: var(--color-blue);
  }

  .artifact-delete {
    background: var(--color-red);
  }

  .artifact-tally-count {
    font-size: var(--font-smallest);
    margin-left: var(--size-4-1);
  }

  .artifacts-list-wrapper {
    grid-row: 2;
    grid-column: 1 / 3;
    position: relative;
    width: 100%;
  }

  .artifacts-list-container {
    display: flex;
    flex-direction: column;
    overflow: scroll;
    width: 100%;
    max-height: 200px;
    gap: var(--size-4-1);
  }

  .artifacts-list-container::-webkit-scrollbar {
    display: none;
  }

  .artifacts-list-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--size-4-8);
    background-image: linear-gradient(to bottom, transparent, var(--background-secondary));
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.2s ease-out;
  }

  .artifacts-list-fade.hidden {
    opacity: 0;
  }

  .artifact-card {
    display: grid;
    grid-template-rows: auto;
    grid-template-columns: auto auto 1fr auto;
    gap: var(--size-4-3);
    align-items: center;
    height: 30px;
    flex-shrink: 0;
    background-color: var(--background-secondary-alt);
    border-radius: var(--size-4-2);
    padding: 0 var(--size-4-1) 0 var(--size-4-2);
    cursor: pointer;
  }

  .artifact-ellipse {
    grid-row: 1;
    grid-column: 1;
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    align-self: center;
    transition: box-shadow 0.2s ease-out;
  }

  .artifact-card:hover .artifact-ellipse,
  .artifact-card:focus-visible .artifact-ellipse {
    width: 12px;
    height: 12px;
    box-shadow: 0px 0px 4px 1px currentColor;
    transition: box-shadow 0.2s ease-out;
  }

  .artifact-ellipse-create {
    background: var(--color-green);
    color: var(--color-green);
  }

  .artifact-ellipse-modify {
    background: var(--color-blue);
    color: var(--color-blue);
  }

  .artifact-ellipse-delete {
    background: var(--color-red);
    color: var(--color-red);
  }

  .artifact-icon {
    grid-row: 1;
    grid-column: 2;
    display: flex;
		align-items: center;
		justify-content: center;
  }

  .artifact-name {
    grid-row: 1;
    grid-column: 3;
    display: flex;
    align-items: center;
    justify-content: start;
    font-size: var(--font-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artifact-action {
    grid-row: 1;
    grid-column: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-smallest);
    font-weight: var(--font-semibold);
    border-radius: var(--size-4-1);
    padding: var(--size-2-1) var(--size-4-2);
  }

  .artifact-action-create {
    background-color: color-mix(
        in srgb,
        var(--color-green) 25%,
        black 20%
    );
    color: color-mix(
        in srgb,
        var(--color-green) 100%,
        white 10%
    );
  }

  .artifact-action-modify {
    background-color: color-mix(
        in srgb,
        var(--color-blue) 25%,
        black 20%
    );
    color: color-mix(
        in srgb,
        var(--color-blue) 100%,
        white 10%
    );
  }

  .artifact-action-delete {
    background-color: color-mix(
        in srgb,
        var(--color-red) 25%,
        black 20%
    );
    color: color-mix(
        in srgb,
        var(--color-red) 100%,
        white 10%
    );
  }
</style>

<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import ThoughtIndicator from "./ThoughtIndicator.svelte";
	import StreamingIndicator from "./StreamingIndicator.svelte";
	import { Greeting } from "Enums/Greeting";
	import { Role } from "Enums/Role";
  import type { ConversationContent } from "Conversations/ConversationContent";
	import { tick } from "svelte";
	import { setElementIcon } from "Helpers/ElementHelper";
	import { setIcon } from "obsidian";
	import { fade } from "svelte/transition";
	import GraphAnimation from "./GraphAnimation.svelte";

  export let messages: ConversationContent[] = [];
  export let currentThought: string | null = null;
  export let isSubmitting: boolean = false;
  export let chatContainer: HTMLDivElement;

  export function resetChatArea() {
    chatContainer.scroll({ top: 0, behavior: "instant" });
    tick().then(updateScrolledState);
  }

  export async function updateChatAreaLayout(behavior: ScrollBehavior | undefined = undefined) {
    await tick();

    requestAnimationFrame(() => {
      if (behavior) {
        scrollToLatestTurn(behavior);
      }
      tick().then(updateScrolledState);
    });
  }

  function scrollToLatestTurn(behavior: ScrollBehavior) {
    const latestTurn = chatContainer.querySelector<HTMLElement>(".message-group.latest");
    if (!latestTurn) {
      return;
    }
    const paddingTop = parseFloat(getComputedStyle(chatContainer).paddingTop) || 0;
    chatContainer.scroll({ top: latestTurn.offsetTop - paddingTop, behavior });
  }

  function scrollToBottom(behavior: ScrollBehavior) {
    chatContainer.scroll({ top: chatContainer.scrollHeight, behavior });
  }

  function updateScrolledState() {
    if (!chatContainer) {
      return;
    }
    const isScrollable = chatContainer.scrollHeight > chatContainer.clientHeight;
    scrolledToBottom = !isScrollable || Math.abs(chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < 100;
  }

  let scrolledToBottom: boolean = true;

  let scrollToBottomButton: HTMLButtonElement;

  let streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);

  type Turn = { id: number, messages: ConversationContent[] };

  $: turns = groupTurns(messages);

  // A turn starts at each visible user message; hidden contents (tool
  // responses, planning notices, attachment stubs) stay attached to the
  // turn they belong to instead of starting phantom turns
  function groupTurns(messages: ConversationContent[]): Turn[] {
    const turns: Turn[] = [];
    for (const message of messages) {
      if ((message.role === Role.User && message.shouldDisplayContent) || turns.length === 0) {
        turns.push({ id: message.id, messages: [] });
      }
      turns[turns.length - 1].messages.push(message);
    }
    return turns;
  }

  function getGreetingByTime(): string {
    const hour = new Date().getHours();

    // Morning: 5am - 11:59am
    if (hour >= 5 && hour < 12) {
      return Greeting.Morning;
    }
    // Midday: 12pm - 4:59pm
    else if (hour >= 12 && hour < 17) {
      return Greeting.Midday;
    }
    // Evening: 5pm - 8:59pm
    else if (hour >= 17 && hour < 21) {
      return Greeting.Evening;
    }
    // Night: 9pm - 4:59am
    else {
      return Greeting.Night;
    }
  }

  function messageRenderAction(element: HTMLElement, message: ConversationContent) {
    streamingMarkdownService.render(message.getDisplayContent(), element);
    return {
      update(newMessage: ConversationContent) {
        streamingMarkdownService.render(newMessage.getDisplayContent(), element, !isSubmitting);
      }
    };
  }

  $: if (scrollToBottomButton) {
    setIcon(scrollToBottomButton, "arrow-down");
  }
</script>

<div class="chat-area-wrapper">
  {#if messages.length > 0}
    <div class="top-fade"></div>
  {/if}
  <div class="chat-area" bind:this={chatContainer} on:scroll={updateScrolledState}>
    {#each turns as turn, turnIndex (turn.id)}
      {@const isLatestTurn = turnIndex === turns.length - 1}
      <div class="message-group" class:latest={isLatestTurn}>
        {#each turn.messages as message (message.id)}
          {@const content = message.getDisplayContent()}
          {#if message.shouldDisplayContent && content.trim() !== ""}
            {#if message.role === Role.User}
              <div class="message-container {Role.User}">
                <div class="message-bubble {Role.User}">
                  <div class="message-text-user-container" contenteditable="false">
                    <div class="message-text-user">
                      {@html content}
                    </div>
                  </div>
                  {#if message.references.length > 0}
                    <hr class="message-attachment-break"/>
                    <div class="message-attachments-container">
                      {#each message.references as reference}
                        <div class="message-attachmanet" aria-label="{reference.fileName}">
                          <div
                            class="message-attachment-icon"
                            use:setElementIcon={reference.getIconName()}
                          ></div>
                          <div class="message-attachment-info">
                            <div class="message-attachment-name">{reference.fileName}</div>
                            <div class="message-attachment-size">{reference.size}MB</div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="message-container {Role.Assistant}">
                <div class="message-bubble {Role.Assistant}">
                  <div class="markdown-content">
                    <div use:messageRenderAction={message} class="streaming-content"></div>
                  </div>
                </div>
              </div>
            {/if}
          {/if}
        {/each}

        {#if isLatestTurn}
          <ThoughtIndicator thought={currentThought}/>
          {#if isSubmitting}
            <div transition:fade={{ duration: 300 }}>
              <StreamingIndicator/>
            </div>
          {/if}
        {/if}
      </div>
    {/each}

    {#if messages.length === 0}
      <div class="conversation-empty-container">
        <div class="conversation-empty-animation">
          <GraphAnimation/>
        </div>
        <div class="conversation-empty-greeting">
          <div class="conversation-empty-greeting-backdrop"></div>
          <div class="conversation-empty-greeting-label">{getGreetingByTime()}</div>
        </div>
      </div>
    {/if}

  </div>

  {#if messages.length > 0}
    <div class="bottom-fade"></div>
  {/if}

  {#if !scrolledToBottom}
    <div class="scroll-to-bottom-container" transition:fade>
      <button
        id="scroll-to-bottom-button"
        bind:this={scrollToBottomButton}
        on:click={() => scrollToBottom("smooth")}
        aria-label="Scroll to bottom">
      </button>
    </div>
  {/if}
</div>

<style>
  .scroll-to-bottom-container {
    background-color: color-mix(in srgb, var(--background-primary) 70%, transparent);
    border-radius: var(--radius-l);
    padding: var(--size-4-2);
    position: absolute;
    bottom: var(--size-4-2);
    right: 0px;
  }

  #scroll-to-bottom-button {
    background-color: var(--interactive-accent);
  }

  .chat-area-wrapper {
    position: relative;
    height: 100%;
    width: 100%;
  }

  .top-fade {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: var(--size-4-4);
    background-image: linear-gradient(to bottom, var(--background-secondary), transparent);
    z-index: 10;
    pointer-events: none;
  }

  .bottom-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--size-4-4);
    background-image: linear-gradient(to top, var(--background-secondary), transparent);
    z-index: 10;
    pointer-events: none;
  }

  .chat-area {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    padding: var(--size-4-4) var(--size-4-3) var(--size-4-3) var(--size-4-3);
    gap: var(--size-4-2);
    scroll-behavior: smooth;
  }

  .chat-area::-webkit-scrollbar {
    display: none;
  }

  .message-group {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: var(--size-4-2);
  }

  .message-group.latest {
    min-height: 100%;
  }

  .message-container {
    display: flex;
    text-align: left;
    margin: 0;
  }
  
  .message-container.user {
    justify-content: flex-end;
  }
  
  .message-container.assistant {
    justify-content: flex-start;
  }

  .message-container {
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
  }

  .message-bubble.user {
    word-wrap: break-word;
    max-width: 70%;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: 0px var(--size-4-2);
  }

  .message-bubble.assistant {
    word-wrap: break-word;
    max-width: 100%;
  }

  .message-text-user-container {
    max-height: 15vh;
    overflow: scroll;
    padding-top: var(--size-4-2);
    white-space: pre-wrap;
  }

  .message-text-user-container::-webkit-scrollbar {
    display: none;
  }

  .message-text-user-container {
    padding-bottom: var(--size-4-2);
  }
  
  .conversation-empty-container {
    display: grid;
    height: 100%;
    width: 100%;
  }

  .conversation-empty-animation {
    grid-row: 1;
    grid-column: 1;
    height: 100%;
    width: 100%;
  }

  .conversation-empty-greeting-backdrop {
    position: absolute;
    inset: -48px;
    background: radial-gradient(
      ellipse closest-side,
      var(--background-secondary) 0%,
      color-mix(in srgb, var(--background-secondary) 80%, transparent) 65%,
      transparent 100%
    );
  }

  .conversation-empty-greeting {
    grid-row: 1;
    grid-column: 1;
    position: relative;
    margin: auto;
    font-style: italic;
    font-size: var(--font-ui-medium);
    color: var(--text-muted);
    pointer-events: none;
  }

  .conversation-empty-greeting-label {
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    padding: var(--size-2-2);
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

  /* Message attachments styles */
  .message-attachment-break {
    color: var(--background-secondary-alt);
    margin: 0 0 var(--size-4-2) 0;
    opacity: 0.5;
  }

  .message-attachments-container {
		display: flex;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-behavior: smooth;
		gap: var(--size-4-2);
    margin-bottom: var(--size-4-2);
	}

  .message-attachments-container::-webkit-scrollbar {
		display: none;
	}

	.message-attachmanet {
		display: grid;
		grid-template-rows: var(--size-4-2) auto var(--size-4-2);
		grid-template-columns: var(--size-4-2) auto var(--size-4-2) auto var(--size-4-2);
    background-color: var(--background-secondary-alt);
		border: var(--border-width) solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		flex-shrink: 0;
	}

  .message-attachment-icon {
		grid-row: 2;
		grid-column: 2;
		display: flex;
		align-items: center;
		justify-content: center;
	}

  .message-attachment-info {
		grid-row: 2;
		grid-column: 4;
		min-width: 40px;
		overflow: hidden;
	}

  .message-attachment-name {
      display: inline-block;
      white-space: nowrap;
      width: 100%;
      padding: 0;
      font-size: var(--font-smaller);
  }

  .message-attachment-size {
      padding: 0;
      font-size: var(--font-smallest);
      color: var(--text-muted);
  }
</style>
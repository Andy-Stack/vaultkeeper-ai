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
	import { getOuterHeight, setElementIcon } from "Helpers/ElementHelper";
	import { setIcon } from "obsidian";
	import { fade } from "svelte/transition";

  export let messages: ConversationContent[] = [];
  export let currentThought: string | null = null;
  export let isSubmitting: boolean = false;
  export let chatContainer: HTMLDivElement;

  export function resetChatArea() {
    messageElements = [];
    if (chatAreaPaddingElement) {
      chatAreaPaddingElement.style.padding = "0px";
    }
    chatContainer.scroll({ top: 0, behavior: "instant" });
  }

  export async function updateChatAreaLayout(behavior: ScrollBehavior | undefined = undefined, shouldSettle: boolean = false) {
    await tick();

    if (!chatAreaPaddingElement) {
      return;
    }

    if (messageElements.length <= 0) {
      chatAreaPaddingElement.style.paddingBottom = "0px";
      return;
    }

    requestAnimationFrame(() => {
      applyLayout(behavior, shouldSettle);
    });
  }

  function applyLayout(behavior: ScrollBehavior | undefined, shouldSettle: boolean) {
    if (!chatAreaPaddingElement || messageElements.length <= 0) {
      return;
    }

    const styles = getComputedStyle(chatContainer);
    const gap = parseFloat(styles.gap) || 0;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;

    const sortedMessages = messageElements.sort((a, b) => a.index - b.index);
    
    let result = calculateMessageHeight(sortedMessages);
    let contentHeight = result.height + (gap * (result.count - 1));

    if (!shouldSettle) {
      if (thoughtIndicatorElement) {
        contentHeight += getOuterHeight(thoughtIndicatorElement) + gap;
      }
      if (streamingIndicatorElement) {
        contentHeight += getOuterHeight(streamingIndicatorElement) + gap;
      }
    }

    const availableHeight = chatContainer.offsetHeight - paddingTop - paddingBottom;
    let padding = shouldSettle
      ? Math.max(0, availableHeight - contentHeight)
      : Math.max(25, availableHeight - contentHeight);

    chatAreaPaddingElement.style.paddingBottom = `${padding}px`;

    if (behavior) {
      chatContainer.scroll({ top: chatContainer.scrollHeight, behavior });
    }
  }

  function calculateMessageHeight(sortedMessages: { element: HTMLElement, index: number, role: Role }[]): { count: number, height: number } {
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    if (lastMessage.role === Role.User) {
      return { count: 1, height: getOuterHeight(lastMessage.element) };
    }

    let count = 0;
    let height = 0;

    for (const message of sortedMessages.reverse()) {
      if (message.role === Role.User) {
        break;
      }
      height += getOuterHeight(message.element);
      count++;
    }
    return { count: count, height: height };
  }

  function updateScrolledState() {
    scrolledToBottom = chatContainer && Math.abs(chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < 1;
  }

  let scrolledToBottom: boolean = true;

  let scrollToBottomButton: HTMLButtonElement;
  let chatAreaPaddingElement: HTMLElement | undefined;
  let thoughtIndicatorElement: HTMLElement | undefined;
  let streamingIndicatorElement: HTMLElement | undefined;

  let streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);

  let messageElements: { element: HTMLElement, index: number, role: Role }[] = [];

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

  function trackingAction(element: HTMLElement, { index, role }: { index: number, role: Role }) {
    messageElements.push({ index: index, element: element, role: role });
  }

  $: if (scrollToBottomButton) {
    setIcon(scrollToBottomButton, "arrow-down");
  }

  $: {
    if (messages.length === 0 && chatAreaPaddingElement) {
      chatAreaPaddingElement.style.padding = "0px";
    }
  }
</script>

<div class="chat-area-wrapper">
  {#if messages.length > 0}
    <div class="top-fade"></div>
  {/if}
  <div class="chat-area" bind:this={chatContainer} on:scroll={updateScrolledState}>
    {#each messages as message, index}
      {@const content = message.getDisplayContent()}
      {#if message.shouldDisplayContent && content.trim() !== ""}
        {#if message.role === Role.User}
          <div class="message-container {Role.User}" use:trackingAction={{ index, role: Role.User }}>
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
          {@const messageId = message.timestamp.getTime().toString()}
          <div class="message-container {Role.Assistant}" use:trackingAction={{ index, role: Role.Assistant }}>
            <div class="message-bubble {Role.Assistant}">
              <div class="markdown-content">
                <div use:messageRenderAction={message} class="streaming-content"></div>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    {/each}

    <ThoughtIndicator thought={currentThought} bind:thoughtIndicatorElement={thoughtIndicatorElement}/>
    {#if isSubmitting}
      <StreamingIndicator bind:streamingIndicatorElement={streamingIndicatorElement}/>
    {/if}

    <div bind:this={chatAreaPaddingElement} style:user-select=none></div>

    {#if messages.length === 0}
      <div class="conversation-empty-state">
        <div class="typing-in">{getGreetingByTime()}</div>
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
        on:click={() => updateChatAreaLayout("smooth")}
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
  
  .conversation-empty-state {
    margin: auto;
    font-style: italic;
    font-size: var(--font-ui-medium);
    color: var(--text-muted);
    pointer-events: none;
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
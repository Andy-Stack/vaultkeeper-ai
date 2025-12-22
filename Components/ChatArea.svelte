<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import ThoughtIndicator from "./ThoughtIndicator.svelte";
	import StreamingIndicator from "./StreamingIndicator.svelte";
  import CancellationIndicator from "./CancellationIndicator.svelte";
	import { Greeting } from "Enums/Greeting";
	import { Role } from "Enums/Role";
  import type { ConversationContent } from "Conversations/ConversationContent";
	import { tick } from "svelte";
	import { Selector } from "Enums/Selector";
	import { Exception } from "Helpers/Exception";
	import { getOuterHeight } from "Helpers/ElementHelper";

  export let cancelling: boolean = false;
  export let messages: ConversationContent[] = [];
  export let currentThought: string | null = null;
  export let isSubmitting: boolean = false;
  export let chatContainer: HTMLDivElement;
  export let currentStreamingMessageId: string | null = null;
  export let editModeActive: boolean = false;

  export function resetChatArea() {
    autoScroll = true;
    cancelling = false;
    messageElements = [];
    lastProcessedContent.clear();
    currentStreamFinalized = false;
    if (chatAreaPaddingElement) {
      chatAreaPaddingElement.style.padding = "0px";
    }
    chatContainer.scroll({ top: 0, behavior: "instant" });
  }

  export function updateChatAreaLayout(behavior: ScrollBehavior | undefined, shouldSettle: boolean = false, isObserver: boolean = false) {
    if (layoutUpdateTimeout) {
      clearTimeout(layoutUpdateTimeout);
    }

    const performLayoutCalculations = () => {
      if (messageElements.length <= 0 || !chatAreaPaddingElement) {
        if (chatAreaPaddingElement) {
          chatAreaPaddingElement.style.padding = "0px";
        }
        return;
      }

      const gap = parseFloat(getComputedStyle(chatContainer).gap) || 0;
      const paddingTop = parseFloat(getComputedStyle(chatContainer).paddingTop) || 0;
      const paddingBottom = parseFloat(getComputedStyle(chatContainer).paddingBottom) || 0;

      const messageElement = messageElements.sort((a, b) => a.index - b.index)[messageElements.length - 1];
      let messageSpace = getOuterHeight(messageElement.element);

      if (!shouldSettle) {
        if (thoughtIndicatorElement) {
          messageSpace += getOuterHeight(thoughtIndicatorElement) + gap;
        }
        if (streamingIndicatorElement) {
          messageSpace += getOuterHeight(streamingIndicatorElement) + gap;
        }
      }

      let padding = chatContainer.offsetHeight - paddingTop - paddingBottom - messageSpace;
      if (!shouldSettle) {
        padding = Math.max(padding, 25);
      }
      chatAreaPaddingElement.style.padding = `${Math.max(0, padding / 2)}px`;

      tick().then(() => {
        if (behavior && (autoScroll || shouldSettle)) {
          chatContainer.scroll({ top: chatContainer.scrollHeight, behavior: behavior })
        }
      });
    };

    if (isObserver) { // instant updates for observers
      performLayoutCalculations();
    } else if (behavior === "instant" || shouldSettle) {
      tick().then(() => {
        requestAnimationFrame(() => {
          performLayoutCalculations();
        });
      });
    } else {
      layoutUpdateTimeout = setTimeout(() => {
        tick().then(() => {
          requestAnimationFrame(() => {
            performLayoutCalculations();
          });
        });
      }, 50);
    }
  }

  let autoScroll: boolean = true;
  let lastScrollTop: number = 0;

  let chatAreaPaddingElement: HTMLElement | undefined;
  let thoughtIndicatorElement: HTMLElement | undefined;
  let streamingIndicatorElement: HTMLElement | undefined;

  let streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);

  let messageElements: { index: number, element: HTMLElement }[] = [];
  let lastProcessedContent: Map<string, string> = new Map<string, string>();
  let currentStreamFinalized: boolean = false;
  let layoutUpdateTimeout: NodeJS.Timeout | null = null;

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

  function updateMessageContent(messageId: string, content: string, isCurrentlyStreaming: boolean) {
    if (isCurrentlyStreaming) {
      streamingMarkdownService.streamChunk(messageId, content);
      currentStreamFinalized = false;
    } else if (!currentStreamFinalized) {
      streamingMarkdownService.finalizeStream(messageId, content);
      currentStreamFinalized = true;
    }
  }

  // Process static messages (user messages and initial load)
  function getStaticHTML(message: ConversationContent): string {
    if (message.role === Role.User) {
      return `<div>${message.content}</div>`;
    }

    // For assistant messages, check if this specific message is currently streaming
    const messageId = message.timestamp.getTime().toString();
    const isCurrentlyStreaming = currentStreamingMessageId === messageId;

    // For assistant messages that aren't streaming, use traditional parsing
    if (!isCurrentlyStreaming) {
      const content = message.getDisplayContent();
      if (message.errorType) {
        return `<div class="${Selector.ErrorSelector}">${content}</div>`;
      }

      try {
        return streamingMarkdownService.formatText(content) || `<div>${content}</div>`;
      } catch (error) {
        Exception.log(error);
        return `<div>${content}</div>`;
      }
    }

    return ""; // Streaming messages will be handled by the streaming service
  }

  function streamingAction(element: HTMLElement, messageId: string) {
    streamingMarkdownService.initializeStream(messageId, element);
  }

  function trackingAction(element: HTMLElement, index: number) {
    messageElements.push({ index: index, element: element });
  }

  function observeResize(element: HTMLElement) {
    const observer = new ResizeObserver(() => {
      updateChatAreaLayout("smooth", false, true);
    });

    observer.observe(element);

    return {
      destroy() {
        observer.disconnect();
      }
    };
  }

  // decide if we should be auto scrolling
  function handleScroll() {
    if (!chatContainer) {
      return;
    }

    const scrollTop = chatContainer.scrollTop;
    const scrollHeight = chatContainer.scrollHeight;
    const clientHeight = chatContainer.clientHeight;

    // Only process if the user actually scrolled (scrollTop changed)
    // This prevents false triggers when content grows and pushes things down
    if (scrollTop === lastScrollTop) {
      return;
    }

    const previousScrollTop = lastScrollTop;
    lastScrollTop = scrollTop;

    // Check if we're at the bottom (with a small tolerance for rounding errors)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 5;

    if (isAtBottom) {
      autoScroll = true;
    } else if (scrollTop < previousScrollTop) {
      autoScroll = false; // user scrolled up
    }
  }

  // Track streaming messages and update them incrementally
  $: {
    messages.forEach((message) => {
      if (message.role !== Role.User) {
        const messageId = message.timestamp.getTime().toString();
        const lastContent = lastProcessedContent.get(messageId) || "";

        // Only update if content has changed
        if (message.content !== lastContent) {
          // Check if this specific message is currently streaming
          const isCurrentlyStreaming = currentStreamingMessageId === messageId;

          const content = message.getDisplayContent();
          // Only process through streaming service if actively streaming
          if (isCurrentlyStreaming) {
            updateMessageContent(messageId, content, isCurrentlyStreaming);
          }
          lastProcessedContent.set(messageId, content);
        }
      }
    });
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
  <div class="chat-area" bind:this={chatContainer} on:scroll={handleScroll} use:observeResize>
    {#each messages as message, index}
      {@const content = message.getDisplayContent()}
      {#if message.shouldDisplayContent && content.trim() !== ""}
        {#if message.role === Role.User}
          <div class="message-container {Role.User}" use:trackingAction={index}>
            <div class="message-bubble {Role.User}">
              <div class="message-text-user fade-in-fast" contenteditable="false">
                {@html content}
              </div>
            </div>
          </div>
        {:else}
          {@const messageId = message.timestamp.getTime().toString()}
          <div class="message-container {Role.Assistant}" use:trackingAction={index}>
            <div class="message-bubble {Role.Assistant}">
              <div class="markdown-content fade-in-fast {currentStreamingMessageId === messageId ? "streaming" : ""}">
                {#if currentStreamingMessageId === messageId}
                  <div use:streamingAction={messageId} class="streaming-content"></div>
                {:else}
                  {@html getStaticHTML(message)}
                {/if}
              </div>
            </div>
          </div>
        {/if}
      {/if}
    {/each}

    <ThoughtIndicator thought={currentThought} bind:thoughtIndicatorElement={thoughtIndicatorElement}/>
    {#if isSubmitting}
      <StreamingIndicator editModeActive={editModeActive} bind:streamingIndicatorElement={streamingIndicatorElement}/>
    {/if}

    {#if cancelling}
      <CancellationIndicator/>
    {/if}

    <div bind:this={chatAreaPaddingElement}></div>

    {#if messages.length === 0}
      <div class="conversation-empty-state">
        <div class="typing-in">{getGreetingByTime()}</div>
      </div>
    {/if}
  </div>
  
  {#if messages.length > 0}
    <div class="bottom-fade"></div>
  {/if}
</div>

<style>
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
  
  .message-bubble {
    word-wrap: break-word;
  }

  .message-bubble.user {
    word-wrap: break-word;
    max-width: 70%;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: 0px var(--size-4-2);
    white-space: pre-wrap;
  }

  .message-bubble.assistant {
    word-wrap: break-word;
    max-width: 100%;
  }

  .message-text-user {
    margin: var(--size-4-2);
  }
  
  .conversation-empty-state {
    margin: auto;
    font-style: italic;
    font-size: var(--font-ui-medium);
    color: var(--text-muted);
    pointer-events: none;
    user-select: none;
  }

  .streaming-content {
    justify-content: left;
    min-height: 1em; /* Ensure the element exists for binding */
  }

  /* Streaming message styles */
  .fade-in-fast {
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
</style>
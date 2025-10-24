<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import ChatAreaThought from "./ChatAreaThought.svelte";
	import StreamingIndicator from "./StreamingIndicator.svelte";
	import { Greeting } from "Enums/Greeting";
	import { Role } from "Enums/Role";
  import type { ConversationContent } from "Conversations/ConversationContent";
	import { tick } from "svelte";
	import { Copy } from "Enums/Copy";
	import { Selector } from "Enums/Selector";

  export let messages: ConversationContent[] = [];
  export let currentThought: string | null = null;
  export let isSubmitting: boolean = false;
  export let chatContainer: HTMLDivElement;
  export let currentStreamingMessageId: string | null = null;
  export let editModeActive: boolean = false;

  let conversationKey = 0;

  export function resetChatArea() {
    messageElements = [];
    lastProcessedContent.clear();
    currentStreamFinalized = false;
    conversationKey++; // Force complete re-render
    if (chatAreaPaddingElement) {
      chatAreaPaddingElement.style.padding = "0px";
    }
    chatContainer.scroll({ top: 0, behavior: "instant" });
  }

  export function scrollChatArea() {
    tick().then(() => {
      settled = false;

      const lastMessage = messageElements.sort((a, b) => a.index - b.index).last();
      if (!lastMessage || !chatAreaPaddingElement) {
        if (chatAreaPaddingElement) {
          chatAreaPaddingElement.style.padding = "0px";
        }
        return;
      }

      const gap = parseFloat(getComputedStyle(chatContainer).gap) || 0;
      const paddingTop = parseFloat(getComputedStyle(chatContainer).paddingTop) || 0;
      const paddingBottom = parseFloat(getComputedStyle(chatContainer).paddingBottom) || 0;

      let usedSpace = 0;
      for (let i = messageElements.length - 1; i >= 0; i--) {
        const messageElement = messageElements[i];
        usedSpace += messageElement.element.offsetHeight + gap;
        if (messageElement.element.classList.contains(Role.User)) {
          break;
        }
      }
      const padding = chatContainer.offsetHeight - paddingTop - paddingBottom - usedSpace;

      chatAreaPaddingElement.style.padding = `${Math.max(0, padding / 2)}px`;

      tick().then(() => {
        chatContainer.scroll({ top: chatContainer.scrollHeight, behavior: "smooth" })
        tick().then(() => settled = true);
      });
    });
  }

  let settled: boolean = false;

  let thoughtElement: HTMLElement | undefined;
  let streamingElement: HTMLElement | undefined;
  let chatAreaPaddingElement: HTMLElement | undefined;

  let streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);

  let messageElements: { index: number, element: HTMLElement }[] = [];
  let lastProcessedContent: Map<string, string> = new Map<string, string>();
  let currentStreamFinalized: boolean = false;

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

  function updateMessageContent(message: {id: string, content: string, role: string, isCurrentlyStreaming: boolean}) {
    if (message.isCurrentlyStreaming) {
      streamingMarkdownService.streamChunk(message.id, message.content);
      currentStreamFinalized = false;
    } else if (!currentStreamFinalized) {
      streamingMarkdownService.finalizeStream(message.id, message.content);
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
      // Check if this is a cancelled request message
      if (message.content.includes(Selector.ApiRequestAborted)) {
        return `<span class="${Selector.ApiRequestAborted}">${Copy.ApiRequestAborted}</span>`;
      }

      try {
        return streamingMarkdownService.formatText(message.content) || `<div>${message.content}</div>`;
      } catch (err) {
        console.error("HTML processing failed:", err);
        return `<div>${message.content}</div>`;
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

          // Only process through streaming service if actively streaming
          if (isCurrentlyStreaming) {
            updateMessageContent({ ...message, id: messageId, isCurrentlyStreaming });
          }
          lastProcessedContent.set(messageId, message.content);
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

<div class="chat-area" bind:this={chatContainer}>
  {#each messages as message, index}
    {#if !message.isFunctionCallResponse && message.content}
      <div class="message-container {message.role === Role.User ? Role.User : Role.Assistant}" use:trackingAction={index}>
        <div class="message-bubble {message.role === Role.User ? Role.User : Role.Assistant}">
          {#if message.role === Role.User}
            <div class="message-text-user fade-in-fast">{message.content}</div>
          {:else}
            {@const messageId = message.timestamp.getTime().toString()}
            <div class="markdown-content fade-in-fast {currentStreamingMessageId === messageId ? "streaming" : ""}">
              {#if currentStreamingMessageId === messageId}
                <div use:streamingAction={messageId} class="streaming-content"></div>
              {:else}
                {@html getStaticHTML(message)}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/each}
  
  {#if settled}
    <ChatAreaThought bind:thoughtElement thought={currentThought}/>
    {#if isSubmitting}
      <StreamingIndicator bind:streamingElement editModeActive={editModeActive}/>
    {/if}
  {/if}

  <div bind:this={chatAreaPaddingElement}></div>
  
  {#if messages.length === 0}
    <div class="conversation-empty-state">
      <div class="typing-in">{getGreetingByTime()}</div>
    </div>
  {/if}
</div>

<style>
  .chat-area {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    padding: var(--size-4-3);
    gap: var(--size-4-2);
    scroll-behavior: smooth;
  }

  .chat-area::-webkit-scrollbar {
    display: none;
  }

  .message-container {
    display: flex;
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
  }

  .streaming-content {
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
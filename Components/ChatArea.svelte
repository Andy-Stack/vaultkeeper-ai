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
	import type AIAgentPlugin from "main";
	import { Copy } from "Enums/Copy";
	import { Selector } from "Enums/Selector";

  export let messages: ConversationContent[] = [];
  export let currentThought: string | null = null;
  export let isSubmitting: boolean = false;
  export let chatContainer: HTMLDivElement;
  export let currentStreamingMessageId: string | null = null;
  export let editModeActive: boolean = false;

  export function onFinishedSubmitting() {
    if (lastAssistantMessageElement && lastAssistantMessageElement.offsetHeight < 
      chatContainer.offsetHeight - parseFloat(getComputedStyle(chatContainer).padding) * 2) {
      // Recalculate padding when streaming ends to fix race condition with streaming indicator removal
      assistantMessageAction(lastAssistantMessageElement);

      // use an interval to complete scrolling once the dom has finished updating
      const scrollInterval: number = plugin.registerInterval(window.setInterval(() => {
        tick().then(() => {
          chatContainer.scroll({ top: chatContainer.scrollHeight, behavior: "smooth" });
        });
      }, 50));
      
      setTimeout(() => {
        if (scrollInterval) {
          clearInterval(scrollInterval);
        }
      }, 1000);
    }
  }

  let thoughtElement: HTMLElement | undefined;
  let streamingElement: HTMLElement | undefined;

  let plugin: AIAgentPlugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
  let streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);

  let messageElements: Map<string, HTMLElement> = new Map<string, HTMLElement>();
  let lastProcessedContent: Map<string, string> = new Map<string, string>();
  let currentStreamFinalized: boolean = false;

  let messagePadding: number = 0;
  let staticMessagePadding: number = 0;
  let lastAssistantMessageElement: HTMLElement | undefined;

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

  // Track streaming messages and update them incrementally
  $: {
    messages.forEach((message) => {
      if (message.role !== Role.User) {
        const lastContent = lastProcessedContent.get(message.id) || "";

        // Only update if content has changed
        if (message.content !== lastContent) {
          // Check if this specific message is currently streaming
          const isCurrentlyStreaming = currentStreamingMessageId === message.id;

          updateMessageContent({ ...message, isCurrentlyStreaming });
          lastProcessedContent.set(message.id, message.content);
        }
      }
    });
  }

  function updateMessageContent(message: {id: string, content: string, role: string, isCurrentlyStreaming: boolean}) {
    const element = messageElements.get(message.id);
    if (!element) {
      return;
    }

    if (message.isCurrentlyStreaming) {
      streamingMarkdownService.streamChunk(message.id, message.content);
      currentStreamFinalized = false;
    } else if (!currentStreamFinalized) {
      streamingMarkdownService.finalizeStream(message.id, message.content);
      currentStreamFinalized = true;
    }
  }

  function initializeMessageElement(messageId: string, element: HTMLElement) {
    messageElements.set(messageId, element);
    streamingMarkdownService.initializeStream(messageId, element);
  }

  // Svelte action to handle element initialization
  function streamingAction(element: HTMLElement, messageId: string) {
    initializeMessageElement(messageId, element);
    
    return {
      destroy() {
        messageElements.delete(messageId);
      }
    };
  }

  // Process static messages (user messages and initial load)
  function getStaticHTML(message: ConversationContent): string {
    if (message.role === Role.User) {
      return `<div>${message.content}</div>`;
    }

    // For assistant messages, check if this specific message is currently streaming
    const isCurrentlyStreaming = currentStreamingMessageId === message.id;

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

  // Make sure to clean up when messages are removed
  $: {
    const currentMessageIds = new Set(messages.map((msg) => msg.id));

    // Remove tracking for messages that no longer exist
    for (const [id] of messageElements) {
      if (!currentMessageIds.has(id)) {
        messageElements.delete(id);
        lastProcessedContent.delete(id);
      }
    }
  }

  /**
   * Chat area padding logic during message streaming 
  */

  function messageContainerAction(element: HTMLElement) {
    tick().then(() => {
      if (element.classList.contains(Role.Assistant)) {
        assistantMessageAction(element);
      }
      else {
        userMessageAction(element);
      }
    });
  }
  
  function userMessageAction(element: HTMLElement) {
    requestAnimationFrame(() => {
      const paddingTop = parseFloat(getComputedStyle(chatContainer).paddingTop) || 0;

      if (element.offsetHeight > chatContainer.offsetHeight / 2) {
        messagePadding = chatContainer.offsetHeight * 0.75;
        staticMessagePadding = messagePadding;
      } else {
        staticMessagePadding = Math.max(0,
          chatContainer.offsetHeight -
          element.offsetHeight -
          paddingTop);

        messagePadding = Math.max(0,
          chatContainer.offsetHeight -
          element.offsetHeight -
          calculateStreamingThoughtSize() -
          paddingTop);
      }
      chatContainer.style.paddingBottom = `${messagePadding}px`;

      tick().then(() => {
        chatContainer.scroll({ top: chatContainer.scrollHeight, behavior: "smooth" });
      });
    });
  }

  function assistantMessageAction(element: HTMLElement) {
    lastAssistantMessageElement = element;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const previousAssistantMessagesHeight = calculatePreviousAssistantMessagesHeight(element);

        messagePadding = Math.max(0,
          staticMessagePadding -
          previousAssistantMessagesHeight -
          element.offsetHeight -
          calculateStreamingThoughtSize() -
          parseFloat(getComputedStyle(chatContainer).gap) || 0);

        chatContainer.style.paddingBottom = `${messagePadding}px`;
      });
    });

    resizeObserver.observe(element);

    return {
      destroy() {
        resizeObserver.disconnect();
      }
    }
  }

  function calculatePreviousAssistantMessagesHeight(currentElement: HTMLElement): number {
    // Find the index of the current message in the messages array
    const currentMessageIndex = messages.findIndex((msg) => {
      const msgElement = messageElements.get(msg.id);
      return msgElement?.parentElement === currentElement;
    });

    if (currentMessageIndex === -1) {
      return 0;
    }

    // Walk backward from current message to find the last user message
    let totalHeight = 0;
    const gap = parseFloat(getComputedStyle(chatContainer).gap) || 0;

    for (let i = currentMessageIndex - 1; i >= 0; i--) {
      const msg = messages[i];

      // Stop when we hit a user message
      if (msg.role === Role.User) {
        break;
      }

      // Sum up heights of all assistant messages before the current one
      if (msg.role === Role.Assistant && !msg.isFunctionCall && !msg.isFunctionCallResponse && msg.content) {
        const msgElement = messageElements.get(msg.id);
        if (msgElement) {
          const containerElement = msgElement.parentElement;
          if (containerElement) {
            totalHeight += containerElement.offsetHeight + gap;
          }
        }
      }
    }

    return totalHeight;
  }

  $: {
    if (chatContainer && messages.length == 0) {
      chatContainer.style.paddingBottom = "";
    }
  }

  function calculateStreamingThoughtSize() {
    const thoughtHeight = thoughtElement?.offsetHeight || 0;
    const streamingHeight = streamingElement?.offsetHeight || 0;

    let thoughtMargins = 0;
    if (thoughtElement) {
      thoughtMargins = parseFloat(getComputedStyle(thoughtElement).marginTop) || 0 +
        parseFloat(getComputedStyle(thoughtElement).marginBottom) || 0;  
    }
    let indicatorMargins = 0;
    if (streamingElement) {
      indicatorMargins = parseFloat(getComputedStyle(streamingElement).marginTop) || 0 +
        parseFloat(getComputedStyle(streamingElement).marginBottom) || 0;
    }

    const gap = parseFloat(getComputedStyle(chatContainer).gap) || 0;
    const gaps = thoughtElement && streamingElement ? 2 : thoughtElement || streamingElement ? 1 : 0;

    return thoughtHeight + streamingHeight + thoughtMargins + indicatorMargins + (gaps * gap);
  }
</script>

<div class="chat-area" bind:this={chatContainer}>
  {#each messages as message (message.id)}
    {#if !message.isFunctionCall && !message.isFunctionCallResponse && message.content}
      <div class="message-container {message.role === Role.User ? Role.User : Role.Assistant}" use:messageContainerAction>
        <div class="message-bubble {message.role === Role.User ? Role.User : Role.Assistant}">
          {#if message.role === Role.User}
            <div class="message-text-user fade-in-fast">{message.content}</div>
          {:else}
            <div class="markdown-content fade-in-fast {currentStreamingMessageId === message.id ? "streaming" : ""}">
              {#if currentStreamingMessageId === message.id}
                <div use:streamingAction={message.id} class="streaming-content"></div>
              {:else}
                {@html getStaticHTML(message)}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/each}

  <ChatAreaThought bind:thoughtElement thought={currentThought}/>
  {#if isSubmitting}
    <StreamingIndicator bind:streamingElement editModeActive={editModeActive}/>
  {/if}
  
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

  /* Welcome text animation */
  .typing-in {
    overflow: hidden;
    white-space: nowrap;
    animation: reveal-center 1.5s ease-in-out forwards;
    max-width: 0;
    margin: 0 auto;
    padding: 5px;
  }

  @keyframes reveal-center {
    0% { 
      max-width: 0;
      opacity: 0;
      filter: blur(1px);
    }
    100% { 
      max-width: 100%;
      opacity: 1;
      filter: blur(0px);
    }
  }
</style>
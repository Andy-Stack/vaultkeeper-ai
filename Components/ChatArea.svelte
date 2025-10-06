<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import ChatAreaThought from "./ChatAreaThought.svelte";
	import StreamingIndicator from "./StreamingIndicator.svelte";
	import { Greeting } from "Enums/Greeting";
	import type AIAgentPlugin from "main";
	import { Role } from "Enums/Role";
  import type { ConversationContent } from "Conversations/ConversationContent";

  export let messages: ConversationContent[] = [];
  export let isStreaming: boolean = false;
  export let isSubmitting: boolean = false;
  export let chatContainer: HTMLDivElement;

  let plugin: AIAgentPlugin = Resolve(Services.AIAgentPlugin);
  let streamingMarkdownService: StreamingMarkdownService = Resolve(Services.StreamingMarkdownService);

  let messageElements: Map<string, HTMLElement> = new Map<string, HTMLElement>();
  let lastProcessedContent: Map<string, string> = new Map<string, string>();
  let currentStreamFinalized: boolean = false;

  let scrollInterval: number | null = null;
  let userScrolledUp: boolean = false;
  let lastScrollTop: number = 0;

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
    messages.forEach((message, messageIndex) => {
      if (message.role !== Role.User) {
        const messageId = `${message.role}-${messageIndex}`;
        const lastContent = lastProcessedContent.get(messageId) || '';

        // Only update if content has changed
        if (message.content !== lastContent) {
          // Check if this is the last message and we're currently streaming
          const isLastMessage = messageIndex === messages.length - 1;
          if (isStreaming && isLastMessage && lastContent === '') {
            userScrolledUp = false;
          }

          updateMessageContent({ ...message, id: messageId, isCurrentlyStreaming: isStreaming && isLastMessage });
          lastProcessedContent.set(messageId, message.content);
        }
      }
    });
  }

  function handleScroll() {
    if (!chatContainer) return;

    if (chatContainer.scrollTop < lastScrollTop) {
      userScrolledUp = true;
    }

    lastScrollTop = chatContainer.scrollTop;
  }

  function startScrolling() {
    if (scrollInterval || userScrolledUp) return;

    scrollInterval = plugin.registerInterval(window.setInterval(() => {
      if (chatContainer && !userScrolledUp) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 50));

    setTimeout(() => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    }, 500);
  }

  function updateMessageContent(message: {id: string, content: string, role: string, isCurrentlyStreaming: boolean}) {
    const element = messageElements.get(message.id);
    if (!element) return;

    if (message.isCurrentlyStreaming) {
      streamingMarkdownService.streamChunk(message.id, message.content);
      currentStreamFinalized = false;
    } else if (!currentStreamFinalized) {
      streamingMarkdownService.finalizeStream(message.id, message.content);
      currentStreamFinalized = true;
    }
    startScrolling();
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
  function getStaticHTML(message: ConversationContent, messageIndex: number): string {
    if (message.role === Role.User) {
      return `<p>${message.content}</p>`;
    }

    // For assistant messages, check if this is the last message and we're streaming
    const isLastMessage = messageIndex === messages.length - 1;
    const isCurrentlyStreaming = isStreaming && isLastMessage;

    // For assistant messages that aren't streaming, use traditional parsing
    if (!isCurrentlyStreaming) {
      try {
        return streamingMarkdownService.formatText(message.content) || `<p>${message.content}</p>`;
      } catch (err) {
        console.error('HTML processing failed:', err);
        return `<p>${message.content}</p>`;
      }
    }

    return ''; // Streaming messages will be handled by the streaming service
  }

  // Make sure to clean up when messages are removed
  $: {
    const currentMessageIds = new Set(messages.map((msg, messageIndex) => `${msg.role}-${messageIndex}`));

    // Remove tracking for messages that no longer exist
    for (const [id] of messageElements) {
      if (!currentMessageIds.has(id)) {
        messageElements.delete(id);
        lastProcessedContent.delete(id);
      }
    }
  }
</script>

<div class="chat-area" bind:this={chatContainer} on:scroll={handleScroll}>
  {#each messages as message, messageIndex (`${message.role}-${messageIndex}`)}
    {#if !message.isFunctionCall && !message.isFunctionCallResponse && message.content}
      <div class="message-container {message.role === Role.User ? 'user' : 'assistant'}">
        <div class="message-bubble {message.role === Role.User ? 'user' : 'assistant'}">
          {#if message.role === Role.User}
            <p class="message-text-user fade-in-fast">{message.content}</p>
          {:else}
            <div class="markdown-content fade-in-fast {isStreaming && messageIndex === messages.length - 1 ? 'streaming' : ''}">
              {#if isStreaming && messageIndex === messages.length - 1}
                <div use:streamingAction={`${message.role}-${messageIndex}`} class="streaming-content"></div>
              {:else}
                {@html getStaticHTML(message, messageIndex)}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/each}

  {#if isSubmitting}
  <ChatAreaThought/>
  <StreamingIndicator/>
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
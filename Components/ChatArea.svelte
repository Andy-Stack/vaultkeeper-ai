<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import ChatAreaThought from "./ChatAreaThought.svelte";
	import StreamingIndicator from "./StreamingIndicator.svelte";
	import { slide } from "svelte/transition";

  export let messages: Array<{id: string, content: string, isUser: boolean, isStreaming: boolean}> = [];
  export let showChatPadding: boolean = false;
  export let chatContainer: HTMLDivElement;
  
  let streamingMarkdownService: StreamingMarkdownService = Resolve(Services.StreamingMarkdownService);

  let messageElements = new Map<string, HTMLElement>();
  let lastProcessedContent = new Map<string, string>();

  // Track streaming messages and update them incrementally
  $: {
    messages.forEach((message) => {
      if (!message.isUser) {
        const lastContent = lastProcessedContent.get(message.id) || '';
        
        // Only update if content has changed
        if (message.content !== lastContent) {
          updateMessageContent(message);
          lastProcessedContent.set(message.id, message.content);
        }
      }
    });
  }

  function updateMessageContent(message: {id: string, content: string, isUser: boolean, isStreaming: boolean}) {
    const element = messageElements.get(message.id);
    if (!element) return;

    if (message.isStreaming) {
      streamingMarkdownService.streamChunk(message.id, message.content);
    } else {
      streamingMarkdownService.finalizeStream(message.id, message.content);
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
  function getStaticHTML(message: {id: string, content: string, isUser: boolean, isStreaming: boolean}): string {
    if (message.isUser) {
      return `<p>${message.content}</p>`;
    }
    
    // For assistant messages that aren't streaming, use traditional parsing
    if (!message.isStreaming) {
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
    const currentMessageIds = new Set(messages.map(m => m.id));
    
    // Remove tracking for messages that no longer exist
    for (const [id] of messageElements) {
      if (!currentMessageIds.has(id)) {
        messageElements.delete(id);
        lastProcessedContent.delete(id);
      }
    }
  }
</script>

<div class="chat-area" bind:this={chatContainer}>
  {#each messages as message (message.id)}
    <div class="message-container" class:user={message.isUser} class:assistant={!message.isUser}>
      <div class="message-bubble" class:user={message.isUser} class:assistant={!message.isUser}>
        {#if message.isUser}
          <p class="message-text-user">{message.content}</p>
        {:else}
          <div class="markdown-content" class:streaming={message.isStreaming}>
            <!-- Streaming message: use action for initialization -->
            {#if message.isStreaming}
            <div use:streamingAction={message.id} class="streaming-content"></div>
            <StreamingIndicator/>
            <ChatAreaThought/>
            {#if showChatPadding}
            <div class="chat-padding" transition:slide={{duration: 3000, delay: 0}}></div>
            {/if}
            {:else}
            <!-- Static message: use traditional rendering -->
            {@html getStaticHTML(message)}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/each}
  
  {#if messages.length === 0}
    <div class="empty-state">
      <p>Start a conversation by typing a message below.</p>
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

  .chat-padding {
    height: 40vh;
    width: 100%;
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
  
  .empty-state {
    justify-content: center;
    align-items: center;
    font-style: italic;
    color: var(--text-muted);
    pointer-events: none;
  }

  .streaming-content {
    min-height: 1em; /* Ensure the element exists for binding */
  }

</style>
<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import { MarkdownService } from "Services/MarkdownService";
  import { Services } from "Services/Services";
	import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";

  export let messages: Array<{id: string, content: string, isUser: boolean, isStreaming: boolean}> = [];
  
  let chatContainer: HTMLDivElement;
  let streamingMarkdownService: StreamingMarkdownService = Resolve(Services.StreamingMarkdownService);

  
  // Process each message content with markdown
  $: processedMessages = messages.map((message) => {
    if (message.isUser) {
      return {
        ...message,
        htmlContent: `<p>${message.content}</p>`
      };
    } else {
      let htmlContent;
      try {
        htmlContent = streamingMarkdownService.formatText(message.content) || `<p>${message.content}</p>`;
      } catch (err) {
        console.error('HTML processing failed:', err);
        htmlContent = `<p>${message.content}</p>`;
      }
      return {
        ...message,
        htmlContent
      };
    }
  });
</script>

<div class="chat-area" bind:this={chatContainer}>
  {#each processedMessages as message (message.id)}
    <div class="message-container" class:user={message.isUser} class:assistant={!message.isUser}>
      <div class="message-bubble" class:user={message.isUser} class:assistant={!message.isUser}>
        {#if message.isUser}
          <p>{message.content}</p>
        {:else}
        <div class="markdown-content" class:streaming={message.isStreaming}>
          {@html message.htmlContent}
          {#if message.isStreaming}
            <span class="streaming-indicator">● ● ●</span>
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
    overflow-y: auto;
    padding: var(--size-4-3);
    gap: var(--p-spacing);
  }
  
  .message-container {
    display: flex;
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
  }

  .message-bubble.assistant {
    word-wrap: break-word;
    max-width: 100%;
  }
  
  .empty-state {
    justify-content: center;
    align-items: center;
    font-style: italic;
    color: var(--text-muted);
    pointer-events: none;
  }

  .streaming-indicator {
    display: inline-block;
    color: var(--text-accent);
    animation: pulse 1.5s infinite;
    margin-left: 4px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
</style>
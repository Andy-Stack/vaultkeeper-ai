<script lang="ts">
	import { AIThoughtMessage } from "Messages/AIThoughtMessage";
    import { Resolve } from "Services/DependencyService";
	import type { MessageService } from "Services/MessageService";
    import { Services } from "Services/Services";
    import { onDestroy } from "svelte";
	import { fade } from "svelte/transition";
  
    let messageService: MessageService = Resolve(Services.MessageService);
    let currentThought: string | null = null;
    let isVisible: boolean = false;
  
    // Handler for AI thought messages
    function handleAIThought(message: AIThoughtMessage): void {
      currentThought = message.thought;
      isVisible = currentThought !== null && currentThought.trim().length > 0;
    }
  
    messageService.register(AIThoughtMessage, handleAIThought);
  
    onDestroy(() => {
      messageService.unregister(AIThoughtMessage, handleAIThought);
    });
  </script>
  
  {#if isVisible && currentThought}
    <div class="ai-thought-container" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
      <div class="ai-thought-bubble">
        <span>{currentThought}</span>
      </div>
    </div>
  {/if}
  
  <style>
    .ai-thought-container {
      margin-top: var(--size-2-1);
      margin-bottom: var(--size-2-1);
    }
  
    .ai-thought-bubble {
      display: inline-flex;
      align-items: center;
      background: var(--metadata-background);
      border: var(--border-width) solid var(--metadata-border-color);
      border-radius: var(--metadata-border-radius);
      padding: var(--metadata-padding);
      font-size: var(--metadata-label-font-size);
      color: var(--text-muted);
      font-style: italic;
      max-width: 100%;
      word-wrap: break-word;
    }
  </style>
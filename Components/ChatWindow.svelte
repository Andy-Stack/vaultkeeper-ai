<script lang="ts">
  import type { IActioner } from "Actioner/IActioner";
  import { Semaphore } from "Helpers";
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import ChatArea from "./ChatArea.svelte";
	import type { IAIClassStreaming } from "AIClasses/Gemini/Gemini";

  let ai: IAIClassStreaming = Resolve(Services.IAIClass);
  let actioner: IActioner = Resolve(Services.IActioner);

  let semaphore: Semaphore = new Semaphore(1, false);
  let textareaElement: HTMLTextAreaElement;

  let userRequest = "";
  let isSubmitting = false;
  let messages: Array<{
    id: string, 
    content: string, 
    isUser: boolean, 
    isStreaming: boolean
  }> = [];

  async function handleSubmit() {
    if (userRequest.trim() === "" || isSubmitting) {
      return;
    }
    isSubmitting = true;

    const requestToSend = userRequest;
    userRequest = "";
    textareaElement.value = "";
    autoResize();

    if (!await semaphore.wait()) {
      return;
    }

    // Add user message to chat
    const userMessageId = `user-${Date.now()}`;
    messages = [...messages, {
      id: userMessageId,
      content: requestToSend,
      isUser: true,
      isStreaming: true
    }];

    try {
      // Create AI message placeholder
      const aiMessageId = `ai-${Date.now()}`;
      messages = [...messages, {
        id: aiMessageId,
        content: "",
        isUser: false,
        isStreaming: true
      }];

      // Stream the response
      let accumulatedContent = "";
      
      for await (const chunk of ai.streamRequest(requestToSend, actioner)) {
        if (chunk.error) {
          console.error("Streaming error:", chunk.error);
          // Update message with error
          messages = messages.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: "Error: " + chunk.error, isStreaming: false }
              : msg
          );
          break;
        }

        if (chunk.content) {
          accumulatedContent += chunk.content;
          // Update the message with accumulated content
          messages = messages.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: accumulatedContent }
              : msg
          );
        }

        if (chunk.isComplete) {
          // Mark streaming as complete
          messages = messages.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: accumulatedContent, isStreaming: false }
              : msg
          );
        }
      }
    } finally {
      semaphore.release();
      isSubmitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      } else {
        e.preventDefault();
        handleSubmit();
      }
    }
  }

  function autoResize() {
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = textareaElement.scrollHeight + 'px';
    }
  }
</script>

<main class="container">
  <div id="chat-container">
    <ChatArea bind:messages />
  </div>
  
  <div id="input-container">
    <textarea
      id="input"
      bind:this={textareaElement}
      bind:value={userRequest}
      on:keydown={handleKeydown}
      on:input={autoResize}
      placeholder="Type a message..."
      disabled={isSubmitting}
      rows="1">
    </textarea>
  
    <button id="submit" on:click={handleSubmit} disabled={isSubmitting || userRequest.trim() === ""}>
      {isSubmitting ? 'Sending...' : 'Submit'}
    </button>
  </div>
</main>

<style>
  .container {
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: 1fr;
    height: 100%;
    border-radius: var(--radius-m);
    color: var(--font-interface-theme);
  }

  #chat-container {
    height: 100%;
    width: 100%;
    grid-row: 1;
    grid-column: 1;
    overflow: hidden;
  }

  #input-container {
    grid-row: 2;
    grid-column: 1;
    display: grid;
    grid-template-rows: var(--size-4-3) 1fr var(--size-4-3);
    grid-template-columns: var(--size-4-3) 1fr var(--size-4-3) auto var(--size-4-3);
    border-radius: var(--modal-radius);
    background-color: var(--modal-background);
  }

  #input {
    grid-row: 2;
    grid-column: 2;
    min-height: var(--input-height);
    max-height: var(--dialog-max-height);
    border-radius: var(--input-radius);
    font-weight: var(--input-font-weight);
    border-width: var(--input-border-width);
    resize: none;
    overflow-y: auto;
    color: var(--font-interface-theme);
  }

  #submit {
    grid-row: 2;
    grid-column: 4;
    border-radius: var(--button-radius);
    align-self: end;
    background-color: var(--interactive-accent);
    transition-duration: 0.25s;
  }

  #submit:hover {
    background-color: var(--interactive-accent-hover);
  }
</style>
<script lang="ts">
  import { Semaphore } from "Helpers/Semaphore";
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import ChatArea from "./ChatArea.svelte";
  import type { IAIClass } from "AIClasses/IAIClass";
	import { tick } from "svelte";
  import { ConversationFileSystemService } from "Services/ConversationFileSystemService";
  import { setIcon } from "obsidian";
  import { conversationStore } from "../Stores/conversationStore";
	import { Role } from "Enums/Role";
  import { Conversation } from "Conversations/Conversation";
  import { ConversationContent } from "Conversations/ConversationContent";
  import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
	import type { AIFunctionService } from "Services/AIFunctionService";
	import type { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";

  let ai: IAIClass = Resolve(Services.IAIClass);
  let conversationService: ConversationFileSystemService = Resolve(Services.ConversationFileSystemService);
  let aiFunctionService: AIFunctionService = Resolve(Services.AIFunctionService);

  let semaphore: Semaphore = new Semaphore(1, false);
  let textareaElement: HTMLTextAreaElement;
  let chatContainer: HTMLDivElement;
  let submitButton: HTMLButtonElement;

  let userRequest = "";
  let isSubmitting = false;
  let isStreaming = false;

  let conversation = new Conversation();

  async function handleSubmit() {
    if (!await semaphore.wait()) {
      return;
    }

    try {
      if (userRequest.trim() === "" || isSubmitting) {
        return;
      }
      isSubmitting = true;

      conversation.contents = [...conversation.contents, new ConversationContent(Role.User, userRequest)];
      await conversationService.saveConversation(conversation);

      textareaElement.value = "";
      userRequest = "";
      autoResize();

      scrollToBottom();

      let functionCall: AIFunctionCall | null = await streamRequestResponse();
      while (functionCall) {

        if ('user_message' in functionCall.arguments) {
          conversation.contents = [...conversation.contents, new ConversationContent(
            Role.Assistant, functionCall.arguments.user_message)];
          await conversationService.saveConversation(conversation);
        }

        conversation.contents = [...conversation.contents, new ConversationContent(
          Role.Assistant, functionCall.toConversationString(), new Date(), true)];
        await conversationService.saveConversation(conversation);  
        
        const functionResponse: AIFunctionResponse = await aiFunctionService.performAIFunction(functionCall);
        conversation.contents = [...conversation.contents, new ConversationContent(
          Role.User, functionResponse.toConversationString(), new Date(), false, true)];
        await conversationService.saveConversation(conversation);

        functionCall = await streamRequestResponse();
      }
    } finally {
      semaphore.release();
      isSubmitting = false;
      tick().then(() => {
        textareaElement?.focus();
      });
    }
  }

  async function streamRequestResponse(): Promise<AIFunctionCall | null> {
    // Create AI message placeholder
    const aiMessageIndex = conversation.contents.length;
    conversation.contents = [...conversation.contents, new ConversationContent(Role.Assistant, "")];
    isStreaming = true;

    let accumulatedContent = "";
    let capturedFunctionCall: AIFunctionCall | null = null;

    for await (const chunk of ai.streamRequest(conversation)) {
      if (chunk.error) {
        console.error("Streaming error:", chunk.error);
        conversation.contents = conversation.contents.map((msg, messageIndex) =>
          messageIndex === aiMessageIndex
            ? { ...msg, content: "Error: " + chunk.error }
            : msg
        );
        isStreaming = false;
        break;
      }

      if (chunk.content) {
        accumulatedContent += chunk.content;
        conversation.contents = conversation.contents.map((msg, messageIndex) =>
          messageIndex === aiMessageIndex
            ? { ...msg, content: accumulatedContent }
            : msg
        );
      }

      if (chunk.functionCall) {
        capturedFunctionCall = chunk.functionCall;
      }

      if (chunk.isComplete) {
        isStreaming = false;
        conversation.contents = conversation.contents.map((msg, messageIndex) =>
          messageIndex === aiMessageIndex
            ? { ...msg, content: accumulatedContent }
            : msg
        );

        await conversationService.saveConversation(conversation);
      }
    }

    return capturedFunctionCall;
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

  function scrollToBottom() {
    tick().then(() => {
      if (chatContainer) {
        chatContainer.scroll({
          top: chatContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  }

  $: if (submitButton) {
    setIcon(submitButton, 'send-horizontal');
  }

  $: if ($conversationStore.shouldReset) {
    conversation = new Conversation();
    conversationStore.clearResetFlag();
  }

  $: if ($conversationStore.conversationToLoad) {
    const { conversation: loadedConversation, filePath } = $conversationStore.conversationToLoad;
    conversation = loadedConversation;
    conversationService.setCurrentConversationPath(filePath);
    conversationStore.clearLoadFlag();
    scrollToBottom();
  }
</script>

<main class="container">
  <div id="chat-container">
    <ChatArea messages={conversation.contents} bind:isStreaming bind:chatContainer={chatContainer}/>
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
  
    <button
      id="submit"
      bind:this={submitButton}
      on:click={() => { handleSubmit() }}
      disabled={isSubmitting || userRequest.trim() === ""}
      aria-label="Send Message">
    </button>
  </div>
</main>

<style>
  .container {
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: 1fr;
    height: calc(100% - var(--size-4-16));
    border-radius: var(--radius-m);
    color: var(--font-interface-theme);
  }

  #chat-container {
    height: 100%;
    width: 100%;
    max-width: 40vw;
    justify-self: center;
    user-select: text;
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
    background-color: var(--color-base-00);
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
    transition: border-color 0.3s ease-out;
  }

  #input:focus {
    border-color: var(--color-accent);
    transition: border-color 0.3s ease-out;
  }

  #submit {
    grid-row: 2;
    grid-column: 4;
    border-radius: var(--button-radius);
    align-self: end;
    background-color: var(--interactive-accent);
    transition-duration: 0.25s;
  }

  #submit:not(:disabled):hover {
    cursor: pointer;
    background-color: var(--interactive-accent-hover);
  }
</style>
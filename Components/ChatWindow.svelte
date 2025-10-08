<script lang="ts">
  import { Semaphore } from "Helpers/Semaphore";
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import ChatArea from "./ChatArea.svelte";
  import type { IAIClass } from "AIClasses/IAIClass";
	import { tick, onMount } from "svelte";
  import { ConversationFileSystemService } from "Services/ConversationFileSystemService";
  import { Notice, setIcon } from "obsidian";
  import { conversationStore } from "../Stores/conversationStore";
	import { Role } from "Enums/Role";
  import { Conversation } from "Conversations/Conversation";
  import { ConversationContent } from "Conversations/ConversationContent";
  import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
	import type { AIFunctionService } from "Services/AIFunctionService";
	import type { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
	import type AIAgentPlugin from "main";
	import { openPluginSettings } from "Helpers/Helpers";
	import { Selector } from "Enums/Selector";
	import type { WorkSpaceService } from "Services/WorkSpaceService";

  let plugin: AIAgentPlugin = Resolve(Services.AIAgentPlugin);

  let ai: IAIClass = Resolve(Services.IAIClass);
  let conversationService: ConversationFileSystemService = Resolve(Services.ConversationFileSystemService);
  let aiFunctionService: AIFunctionService = Resolve(Services.AIFunctionService);
  let workSpaceService: WorkSpaceService = Resolve(Services.WorkSpaceService);

  let semaphore: Semaphore = new Semaphore(1, false);
  let textareaElement: HTMLTextAreaElement;
  let chatContainer: HTMLDivElement;
  let submitButton: HTMLButtonElement;

  let userRequest = "";
  let hasNoApiKey = false;
  let isSubmitting = false;
  let isStreaming = false;

  let conversation = new Conversation();

  let currentThought: string | null = null;

  onMount(() => {
    if (chatContainer) {
      plugin.registerDomEvent(chatContainer, 'click', handleLinkClick);
    }
  });

  async function handleLinkClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement;

    const link = target.closest(`.${Selector.MarkDownLink}`) as HTMLAnchorElement | null;
    if (!link) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#/page/')) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    const encodedPath = href.replace('#/page/', '');
    const notePath = decodeURIComponent(encodedPath);
    await workSpaceService.openNote(notePath);
  }

  function handleNoApiKey(): boolean {
    hasNoApiKey = plugin.settings.apiKey.trim() == "";
    if (hasNoApiKey) {
      openPluginSettings(plugin);
    }
    return hasNoApiKey;
  }

  async function handleSubmit() {
    if (!await semaphore.wait()) {
      return;
    }

    try {
      if (handleNoApiKey()) {
        return;
      }

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
          currentThought = functionCall.arguments.user_message
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
      currentThought = null;
      isSubmitting = false;
      semaphore.release();
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
        await conversationService.saveConversation(conversation);
        break;
      }

      if (chunk.content) {
        currentThought = null;
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
        // If there's a function call, remove the placeholder message
        if (capturedFunctionCall) {
          conversation.contents = conversation.contents.filter((_, messageIndex) => messageIndex !== aiMessageIndex);
        } else if (accumulatedContent.trim() !== "") {
          // Only save the message if it has content and no function call
          conversation.contents = conversation.contents.map((msg, messageIndex) =>
            messageIndex === aiMessageIndex
              ? { ...msg, content: accumulatedContent }
              : msg
          );
        } else {
          // Remove the empty placeholder message
          conversation.contents = conversation.contents.filter((_, messageIndex) => messageIndex !== aiMessageIndex);
        }
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
    <ChatArea messages={conversation.contents} bind:currentThought bind:isStreaming bind:isSubmitting bind:chatContainer={chatContainer}/>
  </div>
  
  <div id="input-container">
    <textarea
      id="input"
      class:error={hasNoApiKey}
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
    grid-template-rows: 1fr auto var(--size-2-1);
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
    max-height: 30vh;
    border-radius: var(--input-radius);
    font-weight: var(--input-font-weight);
    border-width: var(--input-border-width);
    resize: none;
    overflow-y: auto;
    scroll-behavior: smooth;
    color: var(--font-interface-theme);
    transition: border-color 0.3s ease-out;
  }

  #input:focus {
    border-color: var(--color-accent);
    transition: border-color 0.3s ease-out;
  }

  #input.error,
  #input.error:focus {
    border-color: var(--color-red);
  }

  #input::-webkit-scrollbar {
    display: none;
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
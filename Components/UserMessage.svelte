<script lang="ts">
  import { setElementIcon } from "Helpers/ElementHelper";
  import type { ConversationContent } from "Conversations/ConversationContent";
	import { Notice } from "obsidian";

  export let message: ConversationContent;

  $: content = message.getDisplayContent();

  let isScrolledToTop = true;
  let isScrolledToBottom = true;

  async function copyMessage() {
    if (message.displayContent) {
      await navigator.clipboard.writeText(message.displayContent);
      new Notice("Copied to clipboard");
    }
  }

  function updateScrollFade(element: HTMLElement) {
    const { scrollTop, scrollHeight, clientHeight } = element;
    isScrolledToTop = scrollTop < 1;
    isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;
  }

  function messageTextScrollAction(element: HTMLElement) {
    updateScrollFade(element);
    const handleScroll = () => updateScrollFade(element);
    element.addEventListener("scroll", handleScroll);
    return {
      destroy() {
        element.removeEventListener("scroll", handleScroll);
      }
    };
  }
</script>

<div class="user-message">
  <div class="user-message-container">
    <div class="user-message-bubble">
      <div class="message-text-user-wrapper">
        <div class="message-text-user-container" contenteditable="false" use:messageTextScrollAction>
          <div class="message-text-user">
            {@html content}
          </div>
        </div>
        <div class="message-text-fade top" class:hidden={isScrolledToTop}></div>
        <div class="message-text-fade bottom" class:hidden={isScrolledToBottom}></div>
      </div>
      {#if message.references.length > 0}
        <hr class="message-attachment-break"/>
        <div class="message-attachments-container">
          {#each message.references as reference}
            <div class="message-attachmanet" aria-label="{reference.fileName}">
              <div
                class="message-attachment-icon"
                use:setElementIcon={reference.getIconName()}
              ></div>
              <div class="message-attachment-info">
                <div class="message-attachment-name">{reference.fileName}</div>
                <div class="message-attachment-size">{reference.size}MB</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="user-message-ribbon">
      <button
        class="transparent-button user-message-ribbon-button"
        aria-label="Copy message"
        use:setElementIcon={"clipboard"}
        onclick={copyMessage}></button>
    </div>
  </div>
</div>

<style>
  .user-message {
    display: flex;
    flex-direction: column;
    margin-bottom: var(--size-4-2);
  }

  .user-message-container {
    display: flex;
    flex-direction: column;
    text-align: left;
    animation: fadeIn 0.5s ease-out forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .user-message-bubble {
    position: relative;
    margin-left: auto;
    word-wrap: break-word;
    max-width: 70%;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: 0px var(--size-4-2);
  }

  .message-text-user-container {
    max-height: 20vh;
    overflow: scroll;
    padding-top: var(--size-4-2);
    padding-bottom: var(--size-4-2);
    white-space: pre-wrap;
  }

  .message-text-user-container::-webkit-scrollbar {
    display: none;
  }

  .message-text-user-wrapper {
    position: relative;
  }

  .message-text-fade {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--size-4-8);
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.2s ease-out;
  }

  .message-text-fade.top {
    top: 0;
    background-image: linear-gradient(to top, transparent, var(--background-secondary));
  }

  .message-text-fade.bottom {
    bottom: 0;
    background-image: linear-gradient(to bottom, transparent, var(--background-secondary));
  }

  .message-text-fade.hidden {
    opacity: 0;
  }

  .message-attachment-break {
    color: var(--background-secondary-alt);
    margin: 0 0 var(--size-4-2) 0;
    opacity: 0.5;
  }

  .message-attachments-container {
		display: flex;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-behavior: smooth;
		gap: var(--size-4-2);
    margin-bottom: var(--size-4-2);
	}

  .message-attachments-container::-webkit-scrollbar {
		display: none;
	}

	.message-attachmanet {
		display: grid;
		grid-template-rows: var(--size-4-2) auto var(--size-4-2);
		grid-template-columns: var(--size-4-2) auto var(--size-4-2) auto var(--size-4-2);
    background-color: var(--background-secondary-alt);
		border: var(--border-width) solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		flex-shrink: 0;
	}

  .message-attachment-icon {
		grid-row: 2;
		grid-column: 2;
		display: flex;
		align-items: center;
		justify-content: center;
	}

  .message-attachment-info {
		grid-row: 2;
		grid-column: 4;
		min-width: 40px;
		overflow: hidden;
	}

  .message-attachment-name {
    display: inline-block;
    white-space: nowrap;
    width: 100%;
    padding: 0;
    font-size: var(--font-smaller);
  }

  .message-attachment-size {
    padding: 0;
    font-size: var(--font-smallest);
    color: var(--text-muted);
  }

  .user-message-bubble:focus {
    outline: none;
  }

  .user-message-ribbon {
    display: flex;
    margin-left: auto;
  }

  .user-message-ribbon-button {
    translate: 25% 0;
    color: var(--text-muted);
    transition: color 0.5s ease-out;
  }

  .user-message-ribbon-button:hover {
    translate: 25% 0;
    color: var(--text-normal);
    transition: color 0.5s ease-out;
  }
</style>

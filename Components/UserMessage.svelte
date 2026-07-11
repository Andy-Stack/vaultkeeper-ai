<script lang="ts">
  import { setElementIcon } from "Helpers/ElementHelper";
  import type { ConversationContent } from "Conversations/ConversationContent";

  export let message: ConversationContent;

  $: content = message.getDisplayContent();
</script>

<div class="message-container user">
  <div class="message-bubble user">
    <div class="message-text-user-container" contenteditable="false">
      <div class="message-text-user">
        {@html content}
      </div>
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
</div>

<style>
  .message-container {
    display: flex;
    text-align: left;
    margin: 0;
    justify-content: flex-end;
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

  .message-bubble {
    word-wrap: break-word;
    max-width: 70%;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: 0px var(--size-4-2);
  }

  .message-text-user-container {
    max-height: 15vh;
    overflow: scroll;
    padding-top: var(--size-4-2);
    padding-bottom: var(--size-4-2);
    white-space: pre-wrap;
  }

  .message-text-user-container::-webkit-scrollbar {
    display: none;
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
</style>

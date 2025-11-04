<script lang="ts">
  import { tick } from "svelte";
  import { setIcon } from "obsidian";
	import type { UserInputService } from "Services/UserInputService";
	import type { ISearchState, SearchStateStore } from "Stores/SearchStateStore";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import { SearchTrigger } from "Enums/SearchTrigger";
	import ChatSearchResults from "./ChatSearchResults.svelte";
	import type { Writable } from "svelte/store";
	import type { InputService } from "Services/InputService";
	import UserInstruction from "./UserInstruction.svelte";

  export let hasNoApiKey: boolean;
  export let isSubmitting: boolean;
  export let editModeActive: boolean;
  export let onsubmit: (userRequest: string, formattedRequest: string) => void;
  export let ontoggleeditmode: () => void;
  export let onstop: () => void;

  const inputService: InputService = Resolve<InputService>(Services.InputService);
  const userInputService: UserInputService = Resolve<UserInputService>(Services.UserInputService);
  const searchStateStore: SearchStateStore = Resolve<SearchStateStore>(Services.SearchStateStore);

  const searchState: Writable<ISearchState> = searchStateStore.searchState;

  let textareaElement: HTMLDivElement;
  let userInstructionButton: HTMLButtonElement;
  let submitButton: HTMLButtonElement;
  let editModeButton: HTMLButtonElement;

  let userInstructionActive = false;
  let userRequest = "";

  export function focusInput() {
    tick().then(() => {
      textareaElement?.focus();
    });
  }

  $: if (userInstructionButton) {
    setIcon(userInstructionButton, "user-round-pen");
  }

  $: if (submitButton) {
    setIcon(submitButton, isSubmitting ? "square" : "send-horizontal");
  }

  $: if (editModeButton) {
    setIcon(editModeButton, editModeActive ? "pencil" : "pencil-off");
  }

  function handleStop() {
    onstop();
  }

  function handleSubmit() {
    if (userRequest.trim() === "" || isSubmitting) {
      return;
    }

    const request = textareaElement.innerHTML;
    const formattedRequest = SearchTrigger.triggerToText(request);

    textareaElement.textContent = "";
    userRequest = "";

    onsubmit(request, formattedRequest);
  }

  function toggleEditMode() {
    ontoggleeditmode();
  }

  async function handleKeydown(e: KeyboardEvent) {
    userInstructionActive = false;
    if ($searchState.active) {
      await continueSearch(e);
      return;
    }

    if (e.key === "Backspace") {
      const position = inputService.getCursorPosition(textareaElement);
      
      if (position === 0) {
        return;
      }

      e.preventDefault();
      
      const elementBeforeCursor = inputService.getElementBeforeCursor(textareaElement);
      if (elementBeforeCursor && SearchTrigger.isSearchTriggerElement(elementBeforeCursor)) {
          elementBeforeCursor.remove();
          return;
      }
    
      inputService.deleteTextRange(position - 1, position, textareaElement);

      return;
    }

    if (e.key === "Enter") {
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();
      handleSubmit();
    }

    if (SearchTrigger.isSearchTrigger(e.key)) {
      e.preventDefault();

      const position = inputService.getCursorPosition(textareaElement);
      const trigger = SearchTrigger.fromInput(e.key);

      searchStateStore.initializeSearch(trigger, position);

      inputService.insertTextAtCursor(e.key, textareaElement);
    }
  }

  async function continueSearch(e: KeyboardEvent) {
    if (!$searchState.trigger) {
      searchStateStore.resetSearch();
      return;
    }

    if (e.key === "Escape") {
      searchStateStore.resetSearch();
      e.preventDefault();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchResultAcceptance();
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      return;
    }

    if (e.key.startsWith("Arrow")) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        searchStateStore.setSelectedResultToPrevious();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        searchStateStore.setSelectedResultToNext();
      }
      return;
    }

    // Only append printable characters to the query
    if (inputService.isPrintableKey(e.key, e.ctrlKey, e.metaKey)) {
      searchStateStore.appendToQuery(e.key);
      userInputService.performSearch();
    }
  }

  function handleSearchResultAcceptance() {
    if ($searchState.selectedResult !== "" && $searchState.position != null && $searchState.trigger != null) {
      const node = SearchTrigger.toNode($searchState.trigger, $searchState.selectedResult);

      inputService.deleteTextRange($searchState.position, inputService.getCursorPosition(textareaElement), textareaElement);
      inputService.insertElementAtCursor(node, textareaElement);
    }
    searchStateStore.resetSearch();
  }

  function handleInput() {
    if (textareaElement) {
      userRequest = textareaElement.textContent || "";

      if (textareaElement.innerHTML !== textareaElement.textContent) {
        if (inputService.hasUnauthorizedHTML(textareaElement)) {
          inputService.sanitizeToPlainText(textareaElement);
        }
      }

      // If in search mode, synchronize the query with actual text content
      if ($searchState.active && $searchState.position !== null) {
        const fullText = textareaElement.textContent || "";
        const triggerPos = $searchState.position;

        // Extract the query portion (everything after the trigger)
        const actualQuery = fullText.substring(triggerPos + 1);

        // Only update if the query has changed
        if (actualQuery !== $searchState.query) {
          searchStateStore.setQuery(actualQuery);
          userInputService.performSearch();
        }
      }
      
      if (userRequest.trim() === "") {
        textareaElement.textContent = "";
      }
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();

    const plainText = inputService.getPlainTextFromClipboard(e.clipboardData);

    if (!plainText) {
      return;
    }

    inputService.insertTextAtCursor(plainText);
    handleInput();
  }

  function handleCopy(e: ClipboardEvent) {
    e.preventDefault();

    const selection = window.getSelection();

    if (!selection) {
      return;
    }

    const selectedText = selection.toString();
    e.clipboardData?.setData("text/plain", selectedText);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();

    const plainText = e.dataTransfer?.getData("text/plain") || "";

    if (!plainText) {
      return;
    }

    inputService.insertTextAtCursor(plainText);
    handleInput();
  }

  function handleCursorPositionChange() {
    if (!$searchState.active || $searchState.position === null) {
      return;
    }

    const currentPosition = inputService.getCursorPosition(textareaElement);

    if (!inputService.isInSearchZone(currentPosition, $searchState.position)) {
      searchStateStore.resetSearch();
    }
  }

  function handleFocusOut() {
    searchStateStore.resetSearch();
  }
</script>

<div id="input-container" class:edit-mode={editModeActive}>
  <div id="input-search-results-container" style:padding-top={$searchState.results.length > 0 ? "var(--size-4-2)" : 0}>
    <ChatSearchResults searchState={$searchState} onResultAccept={handleSearchResultAcceptance}/>
  </div>

  <div id="user-instruction-container" style:padding-top={userInstructionActive ? "var(--size-4-2)" : 0}>
    <UserInstruction bind:userInstructionActive={userInstructionActive}/>
  </div>

  <button
    id="user-instruction-button"
    class:instruction-active={userInstructionActive}
    bind:this={userInstructionButton}
    on:click={() => { userInstructionActive = !userInstructionActive; searchStateStore.resetSearch() }}
    aria-label="User Instruction">
  </button>

  <div
    id="input-field"
    class:error={hasNoApiKey}
    class:edit-mode={editModeActive && !hasNoApiKey}
    bind:this={textareaElement}
    contenteditable="plaintext-only"
    on:keydown={handleKeydown}
    on:input={handleInput}
    on:paste={handlePaste}
    on:copy={handleCopy}
    on:drop={handleDrop}
    on:click={handleCursorPositionChange}
    on:keyup={handleCursorPositionChange}
    on:focusout={handleFocusOut}
    data-placeholder="Type a message..."
    role="textbox"
    aria-multiline="true"
    tabindex="0">
  </div>

  <button
    id="edit-mode-button"
    class:edit-mode={editModeActive}
    bind:this={editModeButton}
    on:click={() => { toggleEditMode() }}
    disabled={isSubmitting}
    aria-label={editModeActive ? "Turn off Agent Mode" : "Turn on Agent Mode"}>
  </button>

  <button
    id="submit-button"
    class:edit-mode={editModeActive}
    bind:this={submitButton}
    on:click={() => { isSubmitting ? handleStop() : handleSubmit() }}
    disabled={!isSubmitting && userRequest.trim() === ""}
    aria-label={isSubmitting ? "Cancel" : "Send Message"}>
  </button>
</div>

<style>
  #input-container {
    grid-row: 2;
    grid-column: 1;
    display: grid;
    grid-template-rows: auto var(--size-4-3) 1fr var(--size-4-3);
    grid-template-columns: var(--size-4-3) auto var(--size-4-2) 1fr var(--size-4-2) auto var(--size-4-2) auto var(--size-4-3);
    border-radius: var(--modal-radius);
    background-color: var(--background-primary);
  }

  #input-container.edit-mode {
    border-color: var(--alt-interactive-accent);
    transition: border-color 0.5s ease-out;
  }

  #input-search-results-container {
    grid-row: 1;
    grid-column: 2 / 9;
  }

  #user-instruction-container {
    grid-row: 1;
    grid-column: 2 / 9;
  }

  #user-instruction-button {
    grid-row: 3;
    grid-column: 2;
    border-radius: var(--button-radius);
    align-self: end;
    transition-duration: 0.5s;
  }

  :global(.is-mobile) #user-instruction-button {
    max-height: 2rem;
  }

  #user-instruction-button.instruction-active {
    box-shadow: 0px 0px 4px 1px var(--color-accent);
  }

  #input-field {
    grid-row: 3;
    grid-column: 4;
    height: 100%;
    max-height: 30vh;
    border-radius: var(--input-radius);
    font-weight: var(--input-font-weight);
    border-width: var(--input-border-width);
    border-style: solid;
    border-color: var(--background-modifier-border);
    padding: var(--size-2-2) var(--size-2-3);
    background-color: var(--background-primary);
    font-family: var(--font-interface-theme);
    resize: none;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
    color: var(--font-interface-theme);
    transition: border-color 0.5s ease-out;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  :global(.is-mobile) #input-field {
    align-content: end;
  }

  #input-field:focus {
    border-color: var(--color-accent);
    box-shadow: 0px 0px 4px 1px var(--color-accent);
    transition: border-color 0.5s ease-out;
  }

  #input-field.edit-mode:focus {
    border-color: var(--alt-interactive-accent);
    box-shadow: 0px 0px 3px 1px var(--alt-interactive-accent);
    transition: border-color 0.5s ease-out;
  }

  #input-field.error,
  #input-field.error:focus {
    border-color: var(--color-red);
    box-shadow: 0px 0px 4px 1px var(--color-red);
    transition: border-color 0.5s ease-out;
  }

  #input-field::-webkit-scrollbar {
    display: none;
  }

  #input-field:empty::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    opacity: 0.75;
    pointer-events: none;
  }

  #input-field[contenteditable]:focus {
    outline: none;
  }

  #edit-mode-button {
    grid-row: 3;
    grid-column: 6;
    border-radius: var(--button-radius);
    align-self: end;
    transition-duration: 0.5s;
  }

  :global(.is-mobile) #edit-mode-button {
    max-height: 2rem;
  }

  #submit-button {
    grid-row: 3;
    grid-column: 8;
    border-radius: var(--button-radius);
    padding-left: var(--size-4-5);
    padding-right: var(--size-4-5);
    align-self: end;
    transition-duration: 0.5s;
    background-color: var(--interactive-accent);
  }

  :global(.is-mobile) #submit-button {
    max-height: 2rem;
  }

  #submit-button:not(:disabled):hover {
    cursor: pointer;
    background-color: var(--interactive-accent-hover);
  }

  #submit-button.edit-mode {
    background-color: var(--alt-interactive-accent);
  }

  #submit-button.edit-mode:not(:disabled):hover {
    cursor: pointer;
    background-color: var(--alt-interactive-accent-hover);
  }
</style>

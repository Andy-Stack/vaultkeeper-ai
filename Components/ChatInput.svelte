<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { Platform, setIcon, type EventRef } from "obsidian";
	import type { UserInputService } from "Services/UserInputService";
	import type { ISearchState, SearchStateStore } from "Stores/SearchStateStore";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import { isSearchTrigger, fromInput, toNode, triggerToText } from "Enums/SearchTrigger";
	import ChatSearchResults from "./ChatSearchResults.svelte";
	import type { Writable } from "svelte/store";
	import type { InputService } from "Services/InputService";
	import UserInstruction from "./UserInstruction.svelte";
  import ChatModeSelector from "./ChatModeSelector.svelte";
	import DiffControls from "./DiffControls.svelte";
	import type { EventService } from "Services/EventService";
	import { Event } from "Enums/Event";
	import type { DiffService } from "Services/DiffService";
	import type { Attachment } from "Conversations/Attachment";
	import ChatAttachments from "./ChatAttachments.svelte";
	import InputDisplay from "./InputDisplay.svelte";
	import { InputMode } from "Enums/InputMode";
	import { Copy } from "Enums/Copy";
	import { HelpModal } from "Modals/HelpModal";
	import type { IPrompt } from "AIPrompts/IPrompt";
  import type { SettingsService } from "Services/SettingsService";
  import { ChatMode, chatModeAllowsEdits, iconForChatMode } from "Enums/ChatMode";
	import { hideDrawerElements, restoreDrawerElements } from "Helpers/ElementHelper";
	import { replaceCopy } from "Helpers/Helpers";
	import { AIProvider } from "Enums/ApiProvider";

  export let attachments: Attachment[] = [];

  export let hasNoApiKey: boolean;
  export let isSubmitting: boolean;
  export let onSubmit: (userRequest: string, formattedRequest: string) => void;
  export let onStop: () => void;

  const inputService: InputService = Resolve<InputService>(Services.InputService);
  const settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
  const userInputService: UserInputService = Resolve<UserInputService>(Services.UserInputService);
  const searchStateStore: SearchStateStore = Resolve<SearchStateStore>(Services.SearchStateStore);
  const diffService: DiffService = Resolve<DiffService>(Services.DiffService);
  const eventService: EventService = Resolve<EventService>(Services.EventService);
  const aiPrompt: IPrompt = Resolve<IPrompt>(Services.IPrompt);

  const searchState: Writable<ISearchState> = searchStateStore.searchState;

  let inputDisplay: InputDisplay;
  let textareaElement: HTMLDivElement;
  let userInstructionButton: HTMLButtonElement;
  let webSearchButton: HTMLButtonElement;
  let submitButton: HTMLButtonElement;
  let attachmentButton: HTMLButtonElement;
  let chatModeButton: HTMLButtonElement;

  let chatModeSelectionAreaActive: boolean = false;
  let userInstructionAreaActive: boolean = false;
  let userInstructionActive: boolean = true;
  let stacked: boolean = false;

  let userRequest: string = "";

  let chatMode: ChatMode = settingsService.settings.chatMode;
  let inputMode: InputMode = InputMode.Normal;
  let questionResolver: ((answer: string) => void) | null = null;

  let webSearchActive: boolean = settingsService.settings.enableWebSearch;
  let webSearchUnavailable: boolean = settingsService.settings.provider === AIProvider.Local;
  let editsAllowed: boolean = chatModeAllowsEdits(chatMode);

  let countdownIntervalId: ReturnType<typeof setInterval> | null = null;
  let countdownSecondsRemaining: number = 0;
  let inputInitialHeight: number = 0;

  const diffOpenedRef: EventRef = eventService.on(Event.DiffOpened, () => { inputMode = InputMode.Diff; focusInput(); });
  const diffClosedRef: EventRef = eventService.on(Event.DiffClosed, () => { inputMode = InputMode.Normal; focusInput(); });
  const rateLimitCountdownRef: EventRef = eventService.on(Event.RateLimitCountdown, (delayMs: number) => { startCountdown(delayMs); });

  const settingsSubscription: object = settingsService.subscribeToSettingsChanged(changed => {
    if (changed.includes("chatMode")) {
      chatMode = settingsService.settings.chatMode;
      editsAllowed = chatModeAllowsEdits(chatMode);
      if (chatModeButton) {
        setIcon(chatModeButton, iconForChatMode(chatMode));
      }
    }
    if (changed.includes("provider")) {
      webSearchUnavailable = settingsService.settings.provider === AIProvider.Local;
    }
  });

  onMount(async () => {
    userInstructionActive = (await aiPrompt.userInstruction()).trim() !== "";
    inputInitialHeight = textareaElement.innerHeight;
  });

  onDestroy(() => {
    eventService.offref(diffOpenedRef);
    eventService.offref(diffClosedRef);
    eventService.offref(rateLimitCountdownRef);
    settingsService.unsubscribe(settingsSubscription);
    stopCountdown();
  });

  function checkStacked() {
    // Mobile already uses the 'stacked' layout 
    if (Platform.isMobile || textareaElement.textContent.trim() === "") {
      stacked = false;
      return;
    }

    if (textareaElement.innerHeight > inputInitialHeight) {
      stacked = true;
      return;
    }
  }

  export function focusInput(force: boolean = false) {
    // Generally don't focus on mobile, it's annoying
    if (force || !Platform.isMobile) {
      tick().then(() => {
        textareaElement?.focus();
      });
    }
  }

  export function setDisplayItem(element: HTMLElement) {
    inputDisplay.setDisplayItem(element);
  }

  export function clearDisplayItem() {
    stopCountdown();
    inputDisplay.clearDisplayItem();
    inputMode = InputMode.Normal;
  }

  async function startCountdown(delayMs: number) {
    stopCountdown();

    countdownSecondsRemaining = Math.ceil(delayMs / 1000);
    updateCountdownDisplay();

    countdownIntervalId = setInterval(() => {
      countdownSecondsRemaining--;

      if (countdownSecondsRemaining <= 0) {
        clearDisplayItem();
      } else {
        updateCountdownDisplay();
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownIntervalId !== null) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  }

  function openTroubleshootingModal() {
    const modal = Resolve<HelpModal>(Services.HelpModal);
    modal.open(3); // 3 = Troubleshooting
  }

  function updateCountdownDisplay() {
    const countdownDisplay = createEl("div");
    countdownDisplay.addClass("rate-limit-container");

    const countdown = createEl("span");
    countdown.addClass("rate-limit-countdown");
    countdown.textContent = replaceCopy(Copy.RateLimitCountdown, [countdownSecondsRemaining.toString()]);

    const info1 = createEl("span");
    info1.addClass("rate-limit-info");
    info1.appendText(Copy.RateLimitInfo1);

    const link = createEl("span");
    link.addClass("rate-limit-link");
    link.textContent = Copy.RateLimitInfoLink;
    link.setAttribute("role", "link");
    link.setAttribute("tabindex", "-1");
    link.addEventListener("click", openTroubleshootingModal);
    info1.append(link);

    const info2 = createEl("span");
    info2.addClass("rate-limit-info");
    info2.appendText(Copy.RateLimitInfo2);
    info1.append(info2);

    countdownDisplay.append(countdown);
    countdownDisplay.append(createEl("br"));
    countdownDisplay.append(info1);
    inputDisplay.setDisplayItem(countdownDisplay);
  }

  export function enterQuestionMode(resolver: (answer: string) => void) {
    questionResolver = resolver;
    inputMode = InputMode.Question;
    focusInput();
  }

  $: if (userInstructionButton) {
    setIcon(userInstructionButton, "user-round-pen");
  }

  $: if (webSearchButton) {
    setIcon(webSearchButton, webSearchUnavailable ? "globe-lock" : "globe");
  }

  $: userInstructionAreaActive, (() => {
    tick().then(async () => {
      userInstructionActive = (await aiPrompt.userInstruction()).trim() !== "";
    });
  })();

  $: if (submitButton) {
    if (inputMode === InputMode.Question || inputMode === InputMode.Diff) {
      setIcon(submitButton, userRequest.trim() === "" ? "square" : "send-horizontal");
    } else {
      setIcon(submitButton, isSubmitting ? "square" : "send-horizontal");
    }
  }

  $: if (attachmentButton) {
    setIcon(attachmentButton, "paperclip");
  }

  $: if (chatModeButton) {
    setIcon(chatModeButton, iconForChatMode(chatMode));
  }

  $: inputPlaceholder = (() => {
    if (inputMode === InputMode.Question) return Copy.InputPlaceholderQuestion;
    if (inputMode === InputMode.Diff) return Copy.InputPlaceholderDiff;
    return Copy.InputPlaceholderNormal;
  })();

  $: submitDisabled = (() => {
    if (inputMode === InputMode.Diff || inputMode === InputMode.Question) {
      return false;
    }
    return !isSubmitting && userRequest.trim() === "";
  })();

  $: submitAriaLabel = (() => {
    if (inputMode === InputMode.Question) {
      return userRequest.trim() === "" ? Copy.ButtonCancel : Copy.ButtonSubmitAnswer;
    }
    if (inputMode === InputMode.Diff) {
      return userRequest.trim() === "" ? Copy.ButtonCancel : Copy.ButtonMakeSuggestion;
    }
    return isSubmitting ? Copy.ButtonCancel : Copy.ButtonSendMessage;
  })();

  function handleStop() {
    onStop();
  }

  function handleSubmit() {
    if (userRequest.trim() === "" || isSubmitting) {
      return;
    }
    const result = requestFromInput();
    onSubmit(result.request, result.formattedRequest);
  }

  function handleSuggestion() {
    if (userRequest.trim() === "" || inputMode !== InputMode.Diff) {
      return;
    }
    const suggestion = requestFromInput();
    diffService.onSuggest(suggestion.formattedRequest);
  }

  function handleAnswer() {
    if (userRequest.trim() === "" || inputMode !== InputMode.Question) {
      return;
    }
    const answer = requestFromInput();

    if (questionResolver) {
      questionResolver(answer.formattedRequest);
      questionResolver = null;
    }

    clearDisplayItem();
  }

  function requestFromInput() {
    const request = textareaElement.innerHTML;
    const formattedRequest = triggerToText(request);

    textareaElement.textContent = "";
    userRequest = "";
    checkStacked();

    if (Platform.isMobile) {
      textareaElement.blur();
    } else {
      focusInput();
    }

    return { request: request, formattedRequest: formattedRequest };
  }

  function toggleUserInstructionArea() {
    userInstructionAreaActive = !userInstructionAreaActive;
    searchStateStore.resetSearch();
  }

  function toggleWebSearch() {
    if (webSearchUnavailable) {
      return;
    }
    const newState = !settingsService.settings.enableWebSearch;
    settingsService.updateSettings(settings => {
      settings.enableWebSearch = newState;
    });
    webSearchActive = newState;
  }

  function toggleChatModeSelectionArea() {
    chatModeSelectionAreaActive = !chatModeSelectionAreaActive;

  }

  async function handleKeydown(e: KeyboardEvent) {
    userInstructionAreaActive = false;
    if ($searchState.active) {
      await continueSearch(e);
      return;
    }

    if (e.key === "Enter") {
      if (e.shiftKey || Platform.isMobile) {
        return;
      }
      e.preventDefault();
      if (inputMode === InputMode.Question) {
        handleAnswer();
      } else if (inputMode === InputMode.Diff) {
        handleSuggestion();
      } else {
        handleSubmit();
      }
    }
  }

  // Detect search triggers on character insertion
  function handleBeforeInput(e: InputEvent) {
    // This works reliably on both desktop and mobile (including virtual keyboards)
    if (e.inputType === "insertText" && e.data && isSearchTrigger(e.data)) {
      const position = inputService.getCursorPosition(textareaElement);
      const trigger = fromInput(e.data);
      searchStateStore.initializeSearch(trigger, position);
    }
    // Let the character insert, handleInput() will synchronize the search query
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

  function handleSearchResultAcceptance(e?: MouseEvent) {
    if ($searchState.selectedResult !== "" && $searchState.position != null && $searchState.trigger != null) {
      const node = toNode($searchState.trigger, $searchState.selectedResult);

      inputService.deleteTextRange($searchState.position, inputService.getCursorPosition(textareaElement), textareaElement);
      inputService.insertElementAtCursor(node, textareaElement);

      searchStateStore.resetSearch();
    }

    e?.preventDefault();
    focusInput(true);
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

        // Extract the query portion (from trigger to cursor position)
        const currentCursorPos = inputService.getCursorPosition(textareaElement);
        const actualQuery = fullText.substring(triggerPos + 1, currentCursorPos);

        // Only update if the query has changed
        if (actualQuery !== $searchState.query) {
          searchStateStore.setQuery(actualQuery);
          userInputService.performSearch();
        }
      }
      
      if (userRequest.trim() === "") {
        textareaElement.textContent = "";
      }

      checkStacked();
    }
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

  async function handleDataTransfer(e: ClipboardEvent | DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    const dataTransfer = e instanceof ClipboardEvent ? e.clipboardData : e.dataTransfer;

    const files = await inputService.getFilesFromDataTransfer(dataTransfer);
    const plainText = inputService.getTextFromDataTransfer(dataTransfer);

    const newAttachments = files.filter(file => !attachments.some(attachment => attachment.base64 === file.base64));
    attachments = [...attachments, ...newAttachments];

    if (!plainText || plainText.includes("obsidian:")) {
      return;
    }

    inputService.insertTextAtCursor(plainText);
    handleInput();
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
      e.dataTransfer.effectAllowed = "copy";
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleAttachments() {
    const input = document.createElement("input");
    input.multiple = true;
    input.type = "file";

    input.onchange = async () => {
      if (input.files) {
        const dataTransfer = new DataTransfer();

        for (let index = 0; index < input.files.length; index++) {
          dataTransfer.items.add(input.files[index]);
        }

        const files = await inputService.getFilesFromDataTransfer(dataTransfer);
        const newAttachments = files.filter(file => !attachments.some(a => a.base64 === file.base64));
        attachments = [...attachments, ...newAttachments];
      }
    };
    input.click();
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

  function handleFocusIn() {
    if (Platform.isMobile && settingsService.settings.hideDrawerElements) {
      hideDrawerElements();
    }
  }

  function handleFocusOut() {
    searchStateStore.resetSearch();
    if (Platform.isMobile && settingsService.settings.hideDrawerElements) {
      restoreDrawerElements();
    }
  }
</script>

<div id="input-container" class:stacked>
  <div id="input-display-container" style:padding-top={attachments.length > 0 ? "var(--size-4-2)" : 0}>
    <InputDisplay bind:this={inputDisplay}/>
  </div>

  <div id="input-attachments-container" style:padding-top={attachments.length > 0 ? "var(--size-4-2)" : 0}>
    <ChatAttachments bind:attachments={attachments}/>
  </div>

  <div id="diff-controls-container" style:padding-top={inputMode === InputMode.Diff ? "var(--size-4-2)" : 0}>
    <DiffControls diffOpen={inputMode === InputMode.Diff}/>
  </div>

  <div id="input-search-results-container" style:padding-top={$searchState.results.length > 0 ? "var(--size-4-2)" : 0}>
    <ChatSearchResults searchState={$searchState} onResultAccept={handleSearchResultAcceptance}/>
  </div>

  <div id="user-instruction-container" style:padding-top={userInstructionAreaActive ? "var(--size-4-2)" : 0}>
    <UserInstruction focusInput={focusInput} bind:userInstructionAreaActive={userInstructionAreaActive}/>
  </div>

  <div id="chat-mode-selector-container" style:padding-top={chatModeSelectionAreaActive ? "var(--size-4-2)" : 0}>
    <ChatModeSelector focusInput={focusInput} bind:chatModeSelectionAreaActive={chatModeSelectionAreaActive} />
  </div>

  <button
    id="user-instruction-button"
    class:input-button-highlight={userInstructionActive}
    bind:this={userInstructionButton}
    on:click={toggleUserInstructionArea}
    aria-label={Copy.ButtonUserInstruction}>
  </button>

  <button
    id="web-search-button"
    class:input-button-highlight={webSearchActive && !webSearchUnavailable}
    bind:this={webSearchButton}
    disabled={webSearchUnavailable}
    on:click={toggleWebSearch}
    aria-label={webSearchUnavailable ? Copy.ButtonWebSearchUnavailable : (webSearchActive ? Copy.ButtonTurnOffWebSearch : Copy.ButtonTurnOnWebSearch)}>
  </button>

  <div
    id="input-field"
    class:error={hasNoApiKey}
    bind:this={textareaElement}
    contenteditable="plaintext-only"
    on:keydown={handleKeydown}
    on:beforeinput={handleBeforeInput}
    on:input={handleInput}
    on:copy={handleCopy}
    on:paste={handleDataTransfer}
    on:drop={handleDataTransfer}
    on:dragover={handleDragOver}
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    on:click={handleCursorPositionChange}
    on:keyup={handleCursorPositionChange}
    on:focus={handleFocusIn}
    on:focusout={handleFocusOut}
    data-placeholder={inputPlaceholder}
    role="textbox"
    aria-multiline="true"
    tabindex="0">
  </div>

  <button
    id="chat-attachment-button"
    bind:this={attachmentButton}
    on:click={handleAttachments}
    disabled={isSubmitting}
    aria-label={Copy.ButtonAttachFiles}>
  </button>

  <button
    id="chat-mode-button"
    class:input-button-highlight={editsAllowed}
    bind:this={chatModeButton}
    on:click={toggleChatModeSelectionArea}
    disabled={isSubmitting}
    aria-label={Copy.ButtonChangeChatMode}>
  </button>

  <button
    id="submit-button"
    bind:this={submitButton}
    on:click={() => {
      if (inputMode === InputMode.Question) {
        userRequest.trim() === "" ? handleStop() : handleAnswer();
      } else if (inputMode === InputMode.Diff) {
        userRequest.trim() === "" ? handleStop() : handleSuggestion();
      } else {
        isSubmitting ? handleStop() : handleSubmit();
      }
    }}
    disabled={submitDisabled}
    aria-label={submitAriaLabel}>
  </button>
</div>

<style>
  #input-container {
    grid-row: 3;
    grid-column: 1;
    display: grid;
    grid-template-rows: auto auto auto auto auto var(--size-4-3) 1fr var(--size-4-3);
    grid-template-columns: var(--size-4-3) auto var(--size-4-2) auto var(--size-4-2) 1fr var(--size-4-2) auto var(--size-4-2) auto var(--size-4-2) auto var(--size-4-3);
    border-radius: var(--radius-l);
    background-color: var(--background-primary);
  }

  #input-display-container {
    grid-row: 1;
    grid-column: 2 / 13;
  }

  #input-attachments-container {
    grid-row: 2;
    grid-column: 2 / 13;
  }

  #diff-controls-container {
    grid-row: 3;
    grid-column: 2 / 13;
  }

  #input-search-results-container {
    grid-row: 4;
    grid-column: 2 / 13;
  }

  #user-instruction-container {
    grid-row: 4;
    grid-column: 2 / 13;
  }

  #chat-mode-selector-container {
    grid-row: 5;
    grid-column: 2 / 13;
  }

  #user-instruction-button {
    grid-row: 7;
    grid-column: 2;
    border-radius: var(--radius-xl);
    padding: var(--size-4-2);
    align-self: end;
    transition-duration: 0.5s;
  }

  :global(.is-mobile) #user-instruction-button {
    max-height: 2rem;
  }

  #web-search-button {
    grid-row: 7;
    grid-column: 4;
    border-radius: var(--radius-xl);
    padding: var(--size-4-2);
    align-self: end;
    transition-duration: 0.5s;
  }

  :global(.is-mobile) #web-search-button {
    max-height: 2rem;
  }

  #input-field {
    grid-row: 7;
    grid-column: 6;
    height: 100%;
    max-height: 30vh;
    border-radius: var(--radius-m);
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

  #chat-attachment-button {
    grid-row: 7;
    grid-column: 8;
    border-radius: var(--radius-xl);
    padding: var(--size-4-2);
    align-self: end;
    transition-duration: 0.5s;
  }

  :global(.is-mobile) #chat-attachment-button {
    max-height: 2rem;
  }

  #chat-mode-button {
    grid-row: 7;
    grid-column: 10;
    border-radius: var(--radius-xl);
    padding: var(--size-4-2);
    align-self: end;
    transition-duration: 0.5s;
  }

  :global(.is-mobile) #chat-mode-button {
    max-height: 2rem;
  }

  .input-button-highlight {
    box-shadow: 0px 0px 2px 1px var(--color-accent);
  }

  #submit-button {
    grid-row: 7;
    grid-column: 12;
    border-radius: var(--radius-xl);
    padding-left: var(--size-4-2);
    padding-right: var(--size-4-2);
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

  /* Stacked layout: input above, buttons below (desktop only, when content wraps) */
  #input-container.stacked {
    grid-template-rows: auto auto auto auto auto var(--size-4-3) 1fr var(--size-4-2) auto var(--size-4-3);
  }

  #input-container.stacked #input-field {
    grid-column: 2 / 13;
  }

  #input-container.stacked #user-instruction-button {
    grid-row: 9;
  }

  #input-container.stacked #web-search-button {
    grid-row: 9;
  }

  #input-container.stacked #chat-attachment-button {
    grid-row: 9;
  }

  #input-container.stacked #chat-mode-button {
    grid-row: 9;
  }

  #input-container.stacked #submit-button {
    grid-row: 9;
  }

  /* Narrow/mobile layout: input above, buttons below */
  :global(.is-mobile) #input-container {
    grid-template-rows: auto auto auto auto auto var(--size-4-3) 1fr var(--size-4-2) auto var(--size-4-3);
    grid-template-columns: var(--size-4-3) auto var(--size-4-2) auto 1fr auto var(--size-4-2) auto var(--size-4-2) auto var(--size-4-3);
  }

  :global(.is-mobile) #input-display-container,
  :global(.is-mobile) #input-attachments-container,
  :global(.is-mobile) #diff-controls-container,
  :global(.is-mobile) #input-search-results-container,
  :global(.is-mobile) #user-instruction-container,
  :global(.is-mobile) #chat-mode-selector-container {
    grid-column: 2 / 11;
  }

  :global(.is-mobile) #input-field {
    grid-row: 7;
    grid-column: 2 / 11;
  }

  :global(.is-mobile) #user-instruction-button {
    grid-row: 9;
    grid-column: 2;
  }

  :global(.is-mobile) #web-search-button {
    grid-row: 9;
    grid-column: 4;
  }

  :global(.is-mobile) #chat-attachment-button {
    grid-row: 9;
    grid-column: 6;
  }

  :global(.is-mobile) #chat-mode-button {
    grid-row: 9;
    grid-column: 8;
  }

  :global(.is-mobile) #submit-button {
    grid-row: 9;
    grid-column: 10;
  }
</style>

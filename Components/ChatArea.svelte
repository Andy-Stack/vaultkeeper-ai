<script lang="ts">
	import ThoughtIndicator from "./ThoughtIndicator.svelte";
	import ThoughtSteps, { type ThoughtStep } from "./ThoughtSteps.svelte";
	import { describeMessageSteps } from "Helpers/ToolCallThoughtHelper";
	import StreamingIndicator from "./StreamingIndicator.svelte";
	import StreamingLabel from "./StreamingLabel.svelte";
	import UserMessage from "./UserMessage.svelte";
	import AssistantMessage from "./AssistantMessage.svelte";
	import { Greeting } from "Enums/Greeting";
	import { Role } from "Enums/Role";
  import type { ConversationContent } from "Conversations/ConversationContent";
	import { tick, onDestroy } from "svelte";
	import { setIcon } from "obsidian";
	import { fade, slide } from "svelte/transition";
	import GraphAnimation from "./GraphAnimation.svelte";
	import StreamingThoughts from "./StreamingThoughts.svelte";

  export let messages: ConversationContent[] = [];
  export let isSubmitting: boolean = false;
  export let chatContainer: HTMLDivElement;
  export let isAwaitingUser: boolean = false;
  export let streamingThoughts: string = "";

  export function resetChatArea() {
    chatContainer.scroll({ top: 0, behavior: "instant" });
    tick().then(updateScrolledState);
  }

  export async function updateChatAreaLayout(behavior: ScrollBehavior | undefined = undefined) {
    await tick();

    requestAnimationFrame(() => {
      if (behavior) {
        scrollToBottom(behavior);
      }
      tick().then(updateScrolledState);
    });
  }

  function scrollToTop(behavior: ScrollBehavior) {
    isFollowingContent = false;
    chatContainer.scroll({ top: 0, behavior });
  }

  function scrollToBottom(behavior: ScrollBehavior) {
    isFollowingContent = true;
    chatContainer.scroll({ top: chatContainer.scrollHeight, behavior });
  }

  function updateScrolledState() {
    if (!chatContainer) {
      return;
    }
    const isScrollable = chatContainer.scrollHeight > chatContainer.clientHeight;
    scrolledToBottom = !isScrollable || Math.abs(chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < 100;
  }

  function handleScroll() {
    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 10;
    if (isAtBottom) {
      isFollowingContent = true;
    } else if (chatContainer.scrollTop < previousScrollTop) {
      isFollowingContent = false;
    }
    previousScrollTop = chatContainer.scrollTop;
    updateScrolledState();
  }

  const contentResizeObserver = new ResizeObserver(() => {
    if (isFollowingContent) {
      scrollToBottom("instant");
    }
  });

  // Observing each turn rather than one wrapper, since a wrapper would break the latest turn's min-height: 100%
  function followResizes(element: HTMLElement) {
    contentResizeObserver.observe(element);
    return { destroy: () => contentResizeObserver.unobserve(element) };
  }

  onDestroy(() => contentResizeObserver.disconnect());

  let scrolledToBottom: boolean = true;
  let isFollowingContent: boolean = true;
  let previousScrollTop: number = 0;

  let scrollToTopButton: HTMLButtonElement;
  let scrollToBottomButton: HTMLButtonElement;

  type Turn = { id: number, messages: ConversationContent[] };

  $: turns = groupTurns(messages);

  // A turn starts at each visible user message; hidden contents (tool
  // responses, planning notices, attachment stubs) stay attached to the
  // turn they belong to instead of starting phantom turns
  function groupTurns(messages: ConversationContent[]): Turn[] {
    const turns: Turn[] = [];
    for (const message of messages) {
      if ((message.role === Role.User && message.shouldDisplayContent) || turns.length === 0) {
        turns.push({ id: message.id, messages: [] });
      }
      turns[turns.length - 1].messages.push(message);
    }
    return turns;
  }

  // Messages are re-rendered on every streaming chunk, so avoid re-parsing stored tool calls each time
  const messageStepsCache = new WeakMap<ConversationContent, string[]>();

  function turnSteps(turn: Turn): ThoughtStep[] {
    return turn.messages.flatMap(message => {
      const messageSteps = messageStepsCache.get(message) ?? describeMessageSteps(message);
      // Tool calls are only stored once the message has finished streaming
      if (message.toolCalls) {
        messageStepsCache.set(message, messageSteps);
      }
      return messageSteps.map(thought => ({ thought, isComplete: true }));
    });
  }

  function isVisibleMessage(message: ConversationContent): boolean {
    return message.shouldDisplayContent && message.getDisplayContent().trim() !== "";
  }

  function visibleAssistantMessages(turn: Turn): ConversationContent[] {
    return turn.messages.filter(message => message.role !== Role.User && isVisibleMessage(message));
  }

  function getGreetingByTime(): string {
    const hour = new Date().getHours();

    // Morning: 5am - 11:59am
    if (hour >= 5 && hour < 12) {
      return Greeting.Morning;
    }
    // Midday: 12pm - 4:59pm
    else if (hour >= 12 && hour < 17) {
      return Greeting.Midday;
    }
    // Evening: 5pm - 8:59pm
    else if (hour >= 17 && hour < 21) {
      return Greeting.Evening;
    }
    // Night: 9pm - 4:59am
    else {
      return Greeting.Night;
    }
  }

  $: if (scrollToTopButton) {
    setIcon(scrollToTopButton, "chevron-up");
  }
  $: if (scrollToBottomButton) {
    setIcon(scrollToBottomButton, "chevron-down");
  }
</script>

<div class="chat-area-wrapper">
  {#if messages.length > 0}
    <div class="top-fade"></div>
  {/if}
  <div class="chat-area" bind:this={chatContainer} on:scroll={handleScroll}>
    {#each turns as turn, turnIndex (turn.id)}
      {@const isLatestTurn = turnIndex === turns.length - 1}
      {@const assistantMessages = visibleAssistantMessages(turn)}
      {@const isReplyComplete = !(isLatestTurn && isSubmitting)}
      <div class="message-group" class:latest={isLatestTurn} use:followResizes>
        {#each turn.messages as message, messageIndex (message.id)}
          {#if isVisibleMessage(message)}
            {#if message.role === Role.User}
              <UserMessage {message} />
            {:else}
              <!-- A reply can span several messages, so only its last one offers to copy all of them -->
              <AssistantMessage
                {message}
                {isSubmitting}
                copyText={isReplyComplete && message === assistantMessages.at(-1)
                  ? assistantMessages.map(assistantMessage => assistantMessage.getDisplayContent()).join("\n\n")
                  : undefined}/>
            {/if}
          {/if}

          <!-- Steps sit at the top of the turn so they stay put as the reply streams in below them -->
          {#if messageIndex === 0}
            {#if isLatestTurn && isSubmitting}
              <ThoughtIndicator/>
            {:else}
              <ThoughtSteps steps={turnSteps(turn)}/>
            {/if}
          {/if}
        {/each}

        {#if isLatestTurn}
          {#if isSubmitting}
            <StreamingThoughts streamingThoughts={streamingThoughts} isIdle={isAwaitingUser} isSubmitting={isSubmitting}/>
            <div class="streaming-status" transition:slide>
              <StreamingIndicator isIdle={isAwaitingUser}/>
              <StreamingLabel isIdle={isAwaitingUser}/>
            </div>
          {/if}
        {/if}
      </div>
    {/each}

    {#if messages.length === 0}
      <div class="conversation-empty-container">
        <div class="conversation-empty-animation">
          <GraphAnimation/>
        </div>
        <div class="conversation-empty-greeting">
          <div class="conversation-empty-greeting-backdrop"></div>
          <div class="conversation-empty-greeting-label">{getGreetingByTime()}</div>
        </div>
      </div>
    {/if}

  </div>

  {#if messages.length > 0}
    <div class="bottom-fade"></div>
  {/if}

  {#if !scrolledToBottom}
    <div class="scroll-to-bottom-container" transition:fade>
      <button
        id="scroll-to-top-button"
        bind:this={scrollToTopButton}
        on:click={() => scrollToTop("smooth")}
        aria-label="Scroll to top">
      </button>
      <button
        id="scroll-to-bottom-button"
        bind:this={scrollToBottomButton}
        on:click={() => scrollToBottom("smooth")}
        aria-label="Scroll to bottom">
      </button>
    </div>
  {/if}
</div>

<style>
  .streaming-status {
    display: flex;
    align-items: center;
    gap: var(--size-4-3);
    margin-top: var(--size-4-3);
  }

  .scroll-to-bottom-container {
    display: flex;
    background-color: var(--background-primary);
    border-radius: var(--radius-l);
    padding: var(--size-4-2);
    position: absolute;
    bottom: var(--size-4-2);
    right: 0px;
  }

  #scroll-to-top-button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  #scroll-to-bottom-button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .chat-area-wrapper {
    position: relative;
    height: 100%;
    width: 100%;
  }

  .top-fade {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: var(--size-4-4);
    background-image: linear-gradient(to bottom, var(--background-secondary), transparent);
    z-index: 10;
    pointer-events: none;
  }

  .bottom-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--size-4-4);
    background-image: linear-gradient(to top, var(--background-secondary), transparent);
    z-index: 10;
    pointer-events: none;
  }

  .chat-area {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    padding: var(--size-4-4) var(--size-4-3) var(--size-4-3) var(--size-4-3);
    gap: var(--size-4-2);
    scroll-behavior: smooth;
  }

  .chat-area::-webkit-scrollbar {
    display: none;
  }

  .message-group {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .message-group.latest {
    margin-top: var(--size-4-2);
    min-height: 100%;
  }

  .conversation-empty-container {
    display: grid;
    height: 100%;
    width: 100%;
  }

  .conversation-empty-animation {
    grid-row: 1;
    grid-column: 1;
    height: 100%;
    width: 100%;
  }

  .conversation-empty-greeting-backdrop {
    position: absolute;
    inset: -48px;
    background: radial-gradient(
      ellipse closest-side,
      var(--background-secondary) 0%,
      color-mix(in srgb, var(--background-secondary) 80%, transparent) 65%,
      transparent 100%
    );
  }

  .conversation-empty-greeting {
    grid-row: 1;
    grid-column: 1;
    position: relative;
    margin: auto;
    font-style: italic;
    font-size: var(--font-ui-medium);
    color: var(--text-muted);
    pointer-events: none;
  }

  .conversation-empty-greeting-label {
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    padding: var(--size-2-2);
  }
</style>
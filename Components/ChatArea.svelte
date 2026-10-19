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
	import { onDestroy, tick } from "svelte";
	import { setIcon, type EventRef } from "obsidian";
	import { fade, slide } from "svelte/transition";
	import GraphAnimation from "./GraphAnimation.svelte";
	import { EventService } from "Services/EventService";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import { Event } from "Enums/Event";
	import { AITool } from "Enums/AITool";
	import { SettingsService } from "Services/SettingsService";

  export let messages: ConversationContent[] = [];
  export let isSubmitting: boolean = false;
  export let chatContainer: HTMLDivElement;

  const eventService: EventService = Resolve<EventService>(Services.EventService);
  const settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);

  let isIdle = false;

  const toolCallStartedRef: EventRef = eventService.on(Event.ToolCallStarted, (toolName: AITool) => {
    switch (toolName) {
        case AITool.ReadMemories:
        case AITool.UpdateMemories:
        case AITool.ListVaultFiles:
        case AITool.SearchVaultFiles:
        case AITool.ReadVaultFiles:
        case AITool.GetWebViewerContent:
        case AITool.CreateVaultFolder:
        case AITool.ExecuteWorkflow:
        case AITool.RequestWebSearch:
        case AITool.CompleteTask:
        case AITool.CompleteStep:
        case AITool.SkipStep:
        case AITool.ReviseStep:
        case AITool.RevisePlan:
        case AITool.CompletePlan:
        case AITool.CancelPlan:
          isIdle = false;
          break;

        case AITool.WriteVaultFile:
        case AITool.PatchVaultFile:
        case AITool.DeleteVaultFiles:
        case AITool.MoveVaultFiles:
        case AITool.DeleteVaultFolder:
        case AITool.MoveVaultFolder:
          // Not idle if free edit is enabled
          isIdle = !settingsService.settings.freeEdit;
          break;

        case AITool.SubmitPlan:
        case AITool.AskUserQuestionPlanning:
        case AITool.AskUserQuestionExecution:
          isIdle = true;
          break;

        case AITool.Unknown:
          isIdle = false;
    }
  });

  const thoughtUpdateRef: EventRef = eventService.on(Event.ThoughtUpdate, (thought?: string) => isIdle = thought !== undefined);

  onDestroy(() => {
    eventService.offref(toolCallStartedRef);
    eventService.offref(thoughtUpdateRef);
  });

  export function resetChatArea() {
    chatContainer.scroll({ top: 0, behavior: "instant" });
    tick().then(updateScrolledState);
  }

  export async function updateChatAreaLayout(behavior: ScrollBehavior | undefined = undefined) {
    await tick();

    requestAnimationFrame(() => {
      if (behavior) {
        scrollToLatestTurn(behavior);
      }
      tick().then(updateScrolledState);
    });
  }

  function scrollToLatestTurn(behavior: ScrollBehavior) {
    const latestTurn = chatContainer.querySelector<HTMLElement>(".message-group.latest");
    if (!latestTurn) {
      return;
    }
    const paddingTop = parseFloat(getComputedStyle(chatContainer).paddingTop) || 0;
    chatContainer.scroll({ top: latestTurn.offsetTop - paddingTop, behavior });
  }

  function scrollToBottom(behavior: ScrollBehavior) {
    chatContainer.scroll({ top: chatContainer.scrollHeight, behavior });
  }

  function updateScrolledState() {
    if (!chatContainer) {
      return;
    }
    const isScrollable = chatContainer.scrollHeight > chatContainer.clientHeight;
    scrolledToBottom = !isScrollable || Math.abs(chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < 100;
  }

  let scrolledToBottom: boolean = true;

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

  $: if (scrollToBottomButton) {
    setIcon(scrollToBottomButton, "arrow-down");
  }
</script>

<div class="chat-area-wrapper">
  {#if messages.length > 0}
    <div class="top-fade"></div>
  {/if}
  <div class="chat-area" bind:this={chatContainer} on:scroll={updateScrolledState}>
    {#each turns as turn, turnIndex (turn.id)}
      {@const isLatestTurn = turnIndex === turns.length - 1}
      <div class="message-group" class:latest={isLatestTurn}>
        {#each turn.messages as message, messageIndex (message.id)}
          {@const content = message.getDisplayContent()}
          {#if message.shouldDisplayContent && content.trim() !== ""}
            {#if message.role === Role.User}
              <UserMessage {message} />
            {:else}
              <AssistantMessage {message} {isSubmitting} />
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
            <div class="streaming-status" transition:slide>
              <StreamingIndicator isIdle={isIdle}/>
              <StreamingLabel isIdle={isIdle}/>
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
    background-color: color-mix(in srgb, var(--background-primary) 70%, transparent);
    border-radius: var(--radius-l);
    padding: var(--size-4-2);
    position: absolute;
    bottom: var(--size-4-2);
    right: 0px;
  }

  #scroll-to-bottom-button {
    background-color: var(--interactive-accent);
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
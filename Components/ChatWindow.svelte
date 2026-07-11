<script lang="ts">
	import { ARTIFACT_ACTION_RANK, ArtifactAction } from "Enums/ArtifactAction";

  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import ChatArea from "./ChatArea.svelte";
  import ChatInput from "./ChatInput.svelte";
	import { tick, onMount } from "svelte";
  import { conversationStore } from "../Stores/ConversationStore";
  import { Conversation } from "Conversations/Conversation";
	import type VaultkeeperAIPlugin from "main";
	import { openPluginSettings } from "Helpers/Helpers";
	import type { WorkSpaceService } from "Services/WorkSpaceService";
  import type { ChatService } from "Services/ChatService";
  import type { ConversationFileSystemService } from "Services/ConversationFileSystemService";
	import type { SettingsService } from "Services/SettingsService";
	import { Copy } from "Enums/Copy";
	import { AbortService } from "Services/AbortService";
	import type { Attachment } from "Conversations/Attachment";
	import ChatPlanArea from "./ChatPlanArea.svelte";
	import type { ExecutionPlanStore } from "Stores/ExecutionPlanStore";
	import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import { AITool, fromString } from "Enums/AITool";
	import { AIProvider } from "Enums/ApiProvider";
	import type { PlanApprovalService } from "Services/PlanApprovalService";
	import { Artifact } from "Conversations/Artifact";
	import { ConversationContent } from "Conversations/ConversationContent";
	import { Role } from "Enums/Role";
	import { basename } from "path-browserify";

  const plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
  const executionPlanStore: ExecutionPlanStore = Resolve<ExecutionPlanStore>(Services.ExecutionPlanStore);
  const settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
  const chatService: ChatService = Resolve<ChatService>(Services.ChatService);
  const planApprovalService: PlanApprovalService = Resolve<PlanApprovalService>(Services.PlanApprovalService);
  const workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
  const conversationService: ConversationFileSystemService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
  const streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);
  const abortService: AbortService = Resolve<AbortService>(Services.AbortService);

  let collectedArtifacts: Artifact[] = [];

  let chatContainer: HTMLDivElement;
  let chatArea: ChatArea;
  let chatInput: ChatInput;

  let hasNoApiKey = false;
  let isSubmitting = false;
  let busyPlanning = false;

  let conversation: Conversation = new Conversation();
  let attachments: Attachment[] = [];

  let currentThought: string | null = null;

  export function focusInput(force: boolean = false) {
    chatInput?.focusInput(force);
  }

  export function resetChatArea() {
    chatArea.resetChatArea();
  }

  onMount(() => {
    if (chatContainer) {
      plugin.registerDomEvent(chatContainer, 'click', handleLinkClick);
    }
  });

  async function handleLinkClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement;

    const link = target.closest('.internal-link') as HTMLAnchorElement | null;
    if (!link) {
      return;
    }

    const notePath = link.getAttribute('data-href');
    if (!notePath) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    await workSpaceService.openNote(notePath);
  }

  function handleNoApiKey(): boolean {
    hasNoApiKey = settingsService.settings.provider !== AIProvider.Local
      && settingsService.getApiKeyForCurrentProvider().trim() == "";
    
    if (hasNoApiKey) {
      openPluginSettings(plugin);
    }

    return hasNoApiKey;
  }

  function handleStop() {
    chatService.stop();
    currentThought = null;
  }

  async function handleSubmit(userRequest: string, formattedRequest: string) {
    if (handleNoApiKey()) {
      return;
    }
    collectedArtifacts = [];

    const currentRequest = userRequest;

    await chatService.submit(conversation, settingsService.settings.chatMode, currentRequest, formattedRequest, attachments, {
      onSubmit: () => {
        isSubmitting = true;
        attachments = [];
        chatArea.updateChatAreaLayout("smooth");
      },
      onStreamingUpdate: () => {
        conversation = conversation;
        chatArea.updateChatAreaLayout();
      },
      onThoughtUpdate: (thought) => {
        if (thought !== Copy.AIThoughtMessage) {
          currentThought = thought;
        } else if (currentThought !== null) {
          // we are in-between thoughts so use generic copy
          currentThought = thought;
        }
      },
      onToolCallStarted: (toolName: string) => {
        const tool = fromString(toolName);
        switch(tool) {
          case AITool.WriteVaultFile:
          case AITool.PatchVaultFile:
            currentThought = Copy.AIThoughtGeneratingNote;
            break;
          case AITool.AskUserQuestionPlanning:
          case AITool.AskUserQuestionExecution:
            currentThought = Copy.AIThoughtPreparingQuery;
            break;
        }
      },
      onArtifactProduced: (artifact: Artifact) => {
        const collectedArtifact = collectedArtifacts.find(a => a.filePath === artifact.filePath);
        if (!collectedArtifact) {
          collectedArtifacts.push(artifact);
          return;
        }
        collectedArtifact.updatedContent = artifact.updatedContent;
      },
      onPlanningStarted: () => {
        busyPlanning = true;
      },
      onPlanningFinished: () => {
        busyPlanning = false;
      },
      onUserQuestion: async (question) => {
        const displayEl = createEl("div");
        await streamingMarkdownService.render(question, displayEl, true);
        chatInput.setDisplayItem(displayEl);
        return new Promise<string>((resolve) => {
          chatInput.enterQuestionMode(resolve);
        });
      },
      onPlanApprovalRequest: async (plan) => {
        return planApprovalService.requestApproval(plan);
      },
      onPlanUpdate: (executionPlan) => {
        executionPlanStore.setPlan(executionPlan);
      },
      onPlanStepUpdate: (currentStepIndex) => {
        executionPlanStore.setCurrentStepIndex(currentStepIndex);
      },
      onPlanReset: () => {
        executionPlanStore.clearPlan();
      },
      onComplete: async () => {
        saveCollectedArtifects(conversation);
        conversation = conversation;
        conversationService.saveConversation(conversation);
        isSubmitting = false;
        busyPlanning = false;
        currentThought = null;
        executionPlanStore.clearPlan();
        chatInput.clearDisplayItem();
        abortService.reset();
        chatArea.updateChatAreaLayout();
      },
    });
  }

  function saveCollectedArtifects(conversation: Conversation): void {
    let lastMessage = conversation.contents.last();

    if (lastMessage?.role !== Role.Assistant || !lastMessage.shouldDisplayContent) {
      lastMessage = new ConversationContent({ role: Role.Assistant });
      conversation.contents.push(lastMessage);
    }

    lastMessage.artifacts = Artifact.sort(collectedArtifacts);
  }

  $: if ($conversationStore.shouldReset) {
    conversation = new Conversation();
    conversationService.resetCurrentConversation();

    isSubmitting = false;
    currentThought = null;

    chatArea?.resetChatArea();

    chatService.onNameChanged?.("");
    conversationStore.clearResetFlag();
  }

  $: if ($conversationStore.conversationToLoad) {
    conversation.contents = [];

    isSubmitting = false;
    currentThought = null;

    chatArea.resetChatArea();

    tick().then(() => {
      if ($conversationStore.conversationToLoad) {
        const { conversation: loadedConversation, filePath } = $conversationStore.conversationToLoad;
        conversation = loadedConversation;
        conversationService.setCurrentConversationPath(filePath);
        chatService.onNameChanged?.(loadedConversation.title);
        conversationStore.clearLoadFlag();
        chatArea.updateChatAreaLayout("instant");
      }
    });
  }

</script>

<main class="container">
  <ChatPlanArea executionPlanState={executionPlanStore.executionPlanState} {busyPlanning}/>

  <div id="chat-container">
    <ChatArea messages={conversation.contents} bind:this={chatArea} bind:currentThought bind:isSubmitting bind:chatContainer/>
  </div>

  <ChatInput
    bind:this={chatInput}
    bind:attachments
    {hasNoApiKey}
    {isSubmitting}
    onSubmit={handleSubmit}
    onStop={handleStop}
  />
</main>

<style>
  .container {
    display: grid;
    grid-template-rows: auto 1fr auto var(--size-2-1);
    grid-template-columns: 1fr;
    height: calc(100% - var(--size-4-16));
    border-radius: var(--radius-m);
    color: var(--font-interface-theme);
  }

  #chat-container {
    height: 100%;
    width: 100%;
    max-width: 1000px;
    justify-self: center;
    user-select: text;
    grid-row: 2;
    grid-column: 1;
    overflow: hidden;
  }
</style>
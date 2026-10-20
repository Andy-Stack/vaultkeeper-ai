export enum Copy {
    // General Copy
    UserInstructions1 = "You can create custom ",
    UserInstructions2 = "instructions",
    UserInstructions3 = " that the AI will follow.",
    NoUserInstruction = "No custom instructions",

    // Model Display Names
    ClaudeFable_5_1 = "Claude Fable 5.1",
    ClaudeSonnet_5_5 = "Claude Sonnet 5.5",
    ClaudeOpus_5_5 = "Claude Opus 5.5",
    ClaudeHaiku_5_5 = "Claude Haiku 5.5",

    GeminiArgon_4 = "Gemini 4 Argon",
    GeminiFlash_3_5_Lite = "Gemini 3.5 Flash-Lite",
    GeminiFlash_3_8_Flash = "Gemini 3.8 Flash",
    GeminiPro_3_1_Preview = "Gemini 3.1 Pro Preview",

    GPT_6_1_Sol = "GPT-6.1 Sol",
    GPT_6_Luna = "GPT-6 Luna",
    GPT_6_Astra = "GPT-6 Astra",

    MistralLarge = "Mistral Large 4",
    MistralMedium = "Mistral Medium 3.5",
    MistralSmall = "Mistral Small 4",

    // AI Provider Groups
    CloudProvider = "Cloud Provider",
    LocalProvider = "Self Hosted",
    ProviderClaude = "Claude",
    ProviderOpenAI = "OpenAI",
    ProviderGemini = "Gemini",
    ProviderMistral = "Mistral",
    ProviderLocal = "Local",

    // Settings Copy
    SettingProvider = "Provider",
    SettingModel = "Model",
    SettingPlanningModel = "Planning model",
    SettingQuickActionModel = "Quick actions model",
    SettingApiKey = "API key",
    SettingLocalUrl = "Local URL",
    SettingLocalUrlDesc = "Enter the URL for the local server",
    SettingApiKeyLocalDesc = "Enter your API key if authentication is required - optional.",
    SettingExclusionsHeading = "Exclusions",
    SettingFileExclusions = "File exclusions",
    SettingContext = "Context",
    SettingSearchTimeLimit = "Search time limit - (Default: {DEFAULT})",
    SettingSearchResultsLimit = "Search results limit - (Default: {DEFAULT})",
    SettingSnippetSizeLimit = "Snippet size limit - (Default: {DEFAULT})",
    SettingContextSizeLimit = "Context size limit - (Default: {DEFAULT})",
    SettingFileMonitoringHeading = "File monitoring guidelines",
    SettingMemories = "Memories",
    SettingEnableMemories = "Enable memories",
    SettingEnableMemoriesDesc = "Allow the AI to recall memories from previous conversations.",
    SettingAllowUpdatingMemories = "Allow updating memories",
    SettingAllowUpdatingMemoriesDesc = "Allow the AI to save and update memories during conversations.",

    SettingWebViewerAccess = "Web viewer access",
    SettingEnableWebViewer = "Enable web viewer access",
    SettingEnableWebViewerDesc = "Allow the AI to read content from pages open in the Obsidian web viewer (Obsidian core plugin). This is not the same as general web access which can be toggled using the chat controls.",

    // Settings Descriptions
    SettingProviderDesc = "Select the AI provider to use.",
    SettingModelDesc = "Select the AI model to use.",
    SettingLocalModelDesc = "For best results a local model that supports vision capabilities and a minimum of a 32K context window is recommended.",
    SettingPlanningModelDesc = "Select the AI model to use when planning complex tasks.",
    SettingLocalPlanningModelDesc = "For best results a local model that supports vision capabilities and a minimum of a 64K context window is recommended.",
    SettingPlanningModelTip = "Tip: You can reduce cost by using a more powerful model for planning and a cheaper model for the regular agent.",
    SettingQuickActionModelDesc = "Select the AI model to use for quick actions. A fast, lightweight model is recommended.",
    SettingLocalQuickActionModelDesc = "For best results a smaller local model with a minimum of an 8K context window is recommended.",
    SettingLocalModelTemplateWarning = "Note that some models may have very strict templates that require exact 'user' -> 'agent' turns. VaultKeeper AI may chain multiple tool calls and results, so you may find that some models need their Jinja templates adjusting, see: ",
    SettingLocalModelTemplateWarningLinkText = "LM Studio prompt template docs (external link)",
    SettingApiKeyDesc = "Enter your API key here.",
    SettingFileExclusionsDesc = "Set which directories and files the AI should ignore. Enter one path per line - supports glob patterns like folder/**, *.md",
    SettingSearchTimeLimitDesc = "Set the maximum time limit per search in milliseconds. Higher values give the AI more time to collect results per search attempt. Typically a higher search time limit benefits from a higher search result limit.",
    SettingSearchResultsLimitDesc = "Set the maximum number of results provided to the AI when it searches through files in your vault. Higher values provide more context but increase search time.",
    SettingSnippetSizeLimitDesc = "Set the character limit of search previews provided to the AI when it searches through files in your vault. Higher values provide more context per result.",
    SettingContextSizeLimitDesc = "Set the maximum number of characters the AI can read at once, whether from a file, a web page, or a search result. Larger content is automatically split across multiple reads, so nothing is left inaccessible - lower values just mean more, smaller reads. A lower limit can actually improve performance by keeping the AI's context focused, while higher values reduce the number of reads needed for large files.",
    SettingFileMonitoringGemini = "Files uploaded to Gemini are automatically deleted after 48 hours and will be re-uploaded during conversations as needed. No manual cleanup is typically required. ",
    SettingFileMonitoringClaude = "Files uploaded to Claude remain stored indefinitely. Periodically check the Anthropic Console to review and remove old files that are no longer needed. ",
    SettingFileMonitoringOpenAI = "Files uploaded to OpenAI remain stored indefinitely. Periodically check the OpenAI Platform to review and remove old files that are no longer needed. ",
    SettingFileMonitoringMistral = "Documents uploaded to Mistral are stored on their platform. Images are sent inline and not stored. Periodically check the Mistral Console to review and remove old files that are no longer needed. ",
    SettingFileMonitoringLinkText = "See the plugin guide for more information.",
    SettingAccessMemories = "Memories let the AI retain preferences and context across conversations. You can view and edit them at any time.",

    // Settings Placeholders
    PlaceholderEnterApiKey = "Enter your API key",
    PlaceholderFileExclusions = "Examples:\n\nprivate/**\n*.secret.md\njournal/personal/**",
    PlaceholderLocalUrl = "http://localhost:1234/v1/chat/completions",
    PlaceholderApiKey = "Enter API key",
    PlaceholderModelName = "Model name",

    // Settings Tooltips
    TooltipShowApiKey = "Show API Key",
    TooltipHideApiKey = "Hide API Key",
    TooltipAccessMemories = "View Memories",

    SettingAdvancedSettings = "Advanced Settings",
    SettingHideDrawerElements = "Hide Drawer Elements",
    SettingHideDrawerElementsDesc = "Hide side drawer elements on mobile when typing. This provides more space when an on screen keyboard is used. The elements will reappear when the chat input is unfocused.",

    SettingQuickActions = "Quick Actions",
    SettingEnableContextMenuActions = "Enable Context Menu Actions",
    SettingEnableContextMenuActionsDesc = "Show quick actions in the right-click editor context menu.",
    SettingEnableToolbarActions = "Enable Toolbar Actions",
    SettingEnableToolbarActionsDesc = "Show a quick actions button in the editor toolbar (mobile friendly).",

    AIThoughtMessage = "Thinking...",
    PlanningInProgress = "Planning in progress...",
    FinalizingPlanWorkflow = "Finalizing plan workflow",

    // Rate Limit Countdown
    RateLimitCountdown = "Rate limit exceeded retrying in {seconds}...",
    RateLimitInfo1 = "Tip: See info on ",
    RateLimitInfoLink = "API tiers",
    RateLimitInfo2 = " if you often exceed your rate limit.",

    SafeContinue= "Continue",

    // Chat Mode Selector
    ChatModeReadOnlyTitle = "Read-only",
    ChatModeReadOnlyDesc = "The AI can search and read your vault but cannot make any changes.",
    ChatModeEditTitle = "Allow Edits",
    ChatModeEditDesc = "The AI can create, edit, move, and delete files in your vault.",
    ChatModePlanningTitle = "Planning",
    ChatModePlanningDesc = "The AI plans its approach before executing tasks in your vault.",

    // Chat Input Placeholders
    InputPlaceholderQuestion = "Provide an answer...",
    InputPlaceholderNormal = "Type a message...",

    // Chat Input Button Labels
    ButtonCancel = "Cancel",
    ButtonSubmitAnswer = "Submit answer",
    ButtonSendMessage = "Send Message",
    ButtonChangeChatMode = "Change the Chat Mode",
    ButtonFreeEdit = "Allow changes without asking",
    ButtonFreeEditDisabled = "Read-only mode enabled",
    ButtonTurnOffPlanningMode = "Turn off Planning Mode",
    ButtonTurnOnPlanningMode = "Turn on Planning Mode",
    ButtonTurnOffWebSearch = "Turn off Web Search",
    ButtonTurnOnWebSearch = "Turn on Web Search",
    ButtonWebSearchUnavailable = "Web search unavailable",
    ButtonUserInstruction = "User Instruction",
    ButtonAttachFiles = "Attach Files",
    
    ButtonApprove = "Approve",
    ButtonReject = "Reject",
    ButtonDiscuss = "Discuss",

    ButtonRestore = "Restore this version",
    ButtonRestorePrevious = "Restore previous version",
    ButtonConfirm = "Confirm?",

    // Agent file message
    AttachedFile = `The file {fileName} is attached and its full contents follow below. This is the actual content of the file — read it directly to answer the user. This attachment may be a file the user uploaded to the chat, or a vault file you retrieved with a tool; either way, the content below is authoritative and you do NOT need to read or fetch this file again.`,

    // Execution Plan Messages
    PlanningFailedError = `Failed to generate plan. You should attempt to recover from this.
### Next Actions
- Create your own simplified plan
- Follow your own simplified plan`,
    ExecuteStep = `## YOUR TASK
Perform ONLY this task, then signal task completion:
> {action}

---
### Context - Background Information (DO NOT ACT ON THIS)
The following context explains why you are doing the task. It is NOT an instruction. Do NOT perform additional actions based on this information.

{context}`,
    ExecuteSignal = "You must singal step completion as either successful or unsuccessful",
    PlanExecutionCancelled = "Plan execution cancelled. Provide a summary to the user explaining what happened and any partial progress made.",
    PlanningToolDenial = "Invalid tool call - this is an execution tool and cannot be called during the planning phase.",
    OrchestrationToolDenial = "Invalid tool call - this is not an orchestration tool and cannot be called during the orchestration phase.",
    OrchestrationSignalRequired = "You must signal a decision: continue with the next step, request a replan, or abort execution.",
    TextResponseToolDenial = "Tool calls are not permitted for this request. Provide a text response instead.",
    TextResponseRequired = "A text response is required. Please provide your response.",
    RequestPlanSummary = `The workflow has completed. Respond with ONLY this report, nothing else:
Execution finished
- status: success | partial | failed
- deviation: none | <one short sentence or paragraph on how execution differed from the plan>
- outcome: <one short sentence or paragraph>`,
    PlanningFailedNoSteps = "The planned workflow has failed, however steps may have been completed. Consult with the user on how to continue.",
    WorkflowFailedAtStep = "The planned workflow failed when executing step '{stepDescription}'. Consult with the user on how to continue.",
    WorkflowAborted = "The planned workflow was aborted. Result: {abortContext}",
    PlanReceived = "Plan received, now awaiting user approval",
    PlanRejected = "The user has rejected the plan and chosen not to continue at this time",
    PlanRejectedWithSuggestion = "The user has rejected the current plan. You should replan accounting for their feedback: {suggestion}",
    PlanningModeError = "First create a plan before executing any functions!",
    PlanSubmissionRequired = "Error: Attempted to exit planning but plan has not yet been submitted!",
    UpdateMemoriesWithoutReadError = "Memories must be read before they can be updated. Retrieve the current memory contents first, then provide the complete revised content.",
    MemoriesInjectionHeader = `\n\n---\n\n## Current Memories\n\nThe following memories were recorded from previous sessions. Use them as context for this conversation.\n\n{memories}`,
    MemoriesEmpty = "No memories have been created yet.",
    MemoriesMaxLengthError = "Exceeded maximum memories length. Memories have a maximum length of {lines} and {words} words per line.",
    MemoriesUpdatedSuccess = "Memories have been updated successfully.",
    MemoriesDisabledError = "Illegal tool call, memories have been disabled by the user.",
    MemoriesUpdatingDisabledError = "Illegal tool call, updating memories has been disabled by the user.",
    WebViewerNoMatchingUrl = "No open web view was found matching the URL '{urlHint}'. Ensure the correct page is open in the web viewer.",
    WebViewerNoOpenView = "No open web view was found. Ask the user to open a page in the web viewer and try again.",
    NoContinuityIssues = "No continuity issues detected",

    // Apply Template
    ApplyTemplateTemplateSeparator = "---TEMPLATE---",
    ApplyTemplateContentSeparator = "---CONTENT---",
    ApplyTemplateCancelled = "APPLY_TEMPLATE_CANCELLED",


    // Active Capabilities
    ActiveCapabilitiesHeader = `\n\n---\n\n## Active Capabilities\n\nThe following reflects your current configuration. Follow these directives exactly.\n\n{directives}`,
    DirectiveChatModeReadOnly = "- **Chat Mode**: READ-ONLY — you can read and search the vault but cannot create, edit, move, or delete files; if the user asks you to make changes, inform them that edit mode is currently off",
    DirectiveChatModeEdit = "- **Chat Mode**: EDIT — you may create, edit, move, and delete files in the vault",
    DirectiveChatModePlanning = "- **Chat Mode**: PLANNING — you should request a planned workflow before executing tasks in the vault",
    DirectiveMemoriesDisabled = "- **Memory**: DISABLED — all memory tools are currently unavailable",
    DirectiveMemoriesEnabled = "- **Memory**: ENABLED — memories are injected above; you must always read and update them",
    DirectiveMemoriesReadOnly = "- **Memory**: ENABLED (read-only) — memories are injected above; you must read them but updating them is not possible",
    DirectiveWebSearchEnabled = "- **Web Search**: ENABLED — you should always prefer to call the web search tool to retrieve current information from the web",
    DirectiveWebSearchDisabled = "- **Web Search**: DISABLED — the web search tool is unavailable; if the user requests it, inform them it is currently turned off in settings",
    DirectiveWebViewerEnabled = "- **Web Viewer**: ENABLED — you may call the web viewer tool to read the content of the page currently open in the Obsidian web viewer; call it proactively when the user asks about a web page",
    DirectiveAgentContinuityEnabled = "- **Continuity Checks**: ENABLED — vault changes return a continuity report listing open problems that nothing has fixed yet; the user has consented to you fixing them without asking, so edit the notes to resolve them, then tell the user which issues you fixed and which you couldn't",
    DirectiveAgentContinuityDisabled = "- **Continuity Checks**: DISABLED — vault changes don't return a continuity report; if the user asks about checking their changes for broken links or similar issues, tell them it can be turned on with \"Enable agent continuity resolution\" in settings",
    DirectiveWebViewerDisabled ="- **Web Viewer**: DISABLED — the web viewer tool is unavailable; if the user requests it, inform them it is currently turned off in settings",

    ContinuityReportPreamble = "CONTINUITY ISSUES FOUND. These are open problems your changes caused. None of them have been fixed. Fix them with further edits, or report any you leave.",

    MaxExecutionDepthReached = "Exceeded maximum plan execution attempts - consult with the user on how to continue.",

    // Execution Plan Request Templates
    ContextTags = `
### New planning request
<CONTEXT>
{context}
</CONTEXT>`,
    ReplanRequestTemplate = `Plan execution has encountered an unexpected issue. Replan based on the following.

### Original Goal
{originalGoal}

### Completed Steps
{completedSteps}

### Issue Encountered
{issueEncountered}

### Additional Context
{context}`,
    IncompleteExecutionRequestTemplate = `Plan execution stopped before all steps were completed. Review the execution history and create a revised plan to complete the remaining work.

{completedSection}

{remainingSection}`,

    // About Modal Copy
    AboutModalAboutTitle = "About",
    AboutModalAboutContent = `Vaultkeeper AI is an assistant that knows your vault. It searches and reads your notes, answers questions about them, and proposes changes that you review before they're applied.

It began as a plugin built for a friend and is now shared with the wider Obsidian community.

Found a bug or have an idea? Raise it on GitHub:`,

    AboutModalWhatsNewTitle = "What's new",
    AboutModalWhatsNewContent = `- **New diff review**: Review every proposed change side by side, then accept it, reject it, or send it back with feedback.
- **Continuity checks**: Broken links and out-of-date block quotes caused by an edit are flagged in the diff view, and the AI can fix them itself.
- **Mobile support**: The chat and diff view now have layouts built for phones.
- **Faster, clearer agent**: The AI can now run several tools at once, and you can follow each step live as it works.
- **Smarter planning**: Plans are sized to the task, and plan approval happens in one place.
- **New AI models**: Updated defaults for every provider.
- **Bug fixes**: Various UI, performance and stability fixes.

See the [release notes](https://github.com/Andy-Stack/vaultkeeper-ai/releases) for full details.

Found a bug or have an idea? [Raise it on GitHub](https://github.com/Andy-Stack/vaultkeeper-ai/issues).`,

    AboutModalGettingStartedTitle = "Getting started",
    AboutModalGettingStartedContent = `1. **Add a provider**: In the plugin settings, add an API key for Claude, Gemini, OpenAI or Mistral. Or choose **Local** and point it at your own server, with no key needed.
2. **Choose a model**: Select a model from the dropdown in settings.
3. **Open the chat**: Click the Vaultkeeper icon in the left sidebar and start asking.

> [!tip]
> The chat starts in **Read-only** mode, so the AI can explore your vault but can't change anything. Switch to **Allow Edits** when you want it to make changes.`,

    AboutModalChatModesTitle = "Chat modes",
    AboutModalChatModesContent = `Switch modes at any time from the input toolbar.

##### Read-only (default)
The AI can explore your vault without changing anything:
- Search notes, including PDFs and Office/ODF documents
- Read files, including PDFs, Office documents and images
- List folders

##### Allow Edits
Everything in Read-only, plus:
- Create new notes
- Edit existing content
- Move, rename and delete notes and folders

Each proposed change opens in a side-by-side diff where you can accept it, reject it, or send it back with feedback. To apply changes immediately instead, turn on **Allow changes without asking**.

##### Planning
For larger, multi-step tasks:
1. A planning agent explores your vault, asks clarifying questions if needed, and writes a step-by-step plan.
2. You approve the plan, reject it, or suggest changes.
3. An execution agent carries out each step.
4. An orchestration agent checks each result and adjusts the plan if something unexpected comes up.`,

    AboutModalReferenceTitle = "Using references",
    AboutModalReferenceContent = `Give the AI context straight away by typing one of these in your message:

- \`@filename\`: a specific file
- \`#tag\`: every note with that tag
- \`/folder\`: an entire folder

Autocomplete supports fuzzy search and keyboard navigation.`,

    AboutModalCustomInstructionsTitle = "Custom instructions",
    AboutModalCustomInstructionsContent = `Tailor the AI's behaviour to a particular workflow, such as a research assistant or a writing partner:

1. Create Markdown files in \`Vaultkeeper AI/User Instructions/\`.
2. Click the **User Instructions** button in the chat.
3. Select an instruction set.
4. The AI follows those instructions in its responses.

The folder location can be changed in settings. See [[Vaultkeeper AI/User Instructions/EXAMPLE_INSTRUCTIONS|the example template]] to get started.`,

    AboutModalQuickActionsTitle = "Quick actions",
    AboutModalQuickActionsContent = `Quick actions are one-click AI edits for the note you're working on. Right-click in the editor, or use the editor toolbar button, and pick an action.

**Proofread**, **Beautify** and **Apply links** work on your selection if you have one, otherwise on the whole note. The other actions always use the whole note.

##### Proofread
Corrects spelling, grammar, punctuation and typos without rewriting for style or changing your voice.

##### Beautify
Improves clarity, flow and readability, and adds Markdown formatting (headings, bold, lists, blockquotes) where it helps.

##### Apply template
Restructures the note to match a template you choose, fitting your content to the template's headings while preserving the information. If the file you pick doesn't look like a template, no changes are made.

##### Apply links
Wraps mentions of pages that already exist in your vault in wikilinks. It never links to pages that don't exist.

##### Apply tags
Chooses tags for the note from those already used in your vault and merges them into the frontmatter. It never creates new tags.

##### Suggest tags
Like **Apply tags**, but can suggest new tags as well as reuse existing ones.

##### Generate frontmatter
Infers YAML frontmatter (aliases, tags, title, summary and created date) from the note's content and merges it into any existing frontmatter.`,

    AboutModalUploadedFilesTitle = "Uploaded files",
    AboutModalUploadedFilesContent = `When you attach files such as PDFs or images to a conversation, they're uploaded to your AI provider. The plugin deletes them automatically when you delete the conversation, but this can occasionally fail because of network issues or rate limits.

> [!tip]
> Check your provider's dashboard from time to time and remove any files you no longer need. Provider-specific details are in the plugin settings.

##### Provider dashboards
- **Claude**: [Anthropic Console](https://console.anthropic.com/)
- **Gemini**: [Google AI Studio](https://aistudio.google.com/)
- **OpenAI**: [OpenAI Platform](https://platform.openai.com/)
- **Mistral**: [Mistral Console](https://console.mistral.ai/)

> [!note] Local models
> Files are sent inline with your message directly to your own server, so there's nothing to clean up.`,

    AboutModalTroubleshootTitle = "Troubleshooting",
    AboutModalTroubleshootContent = `##### Invalid API key or authentication errors
**Fix**:
- Copy the key again from your provider's console and paste it without extra spaces.
- Check the key is saved under the correct provider. Keys are provider-specific, so a Claude key only works with Claude models.

##### Error 429: Rate limit exceeded
**Cause**: Too many requests in a short period. This is separate from your token usage or billing limits.

**Fix**:
- Wait for the limit to reset (see below).
- Lower the **Search results limit** and **Snippet size limit** in settings to make each request smaller.

> [!info] Rate limits by provider
> - **Claude**: Resets within a few hours. Limits rise as your cumulative spend passes each threshold. [Rate limits](https://docs.claude.com/en/api/rate-limits)
> - **Gemini**: Resets within a few minutes for per-minute limits, or at midnight Pacific Time for daily quotas. Enabling billing moves you to the paid tier, which has much higher limits. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
> - **Mistral**: Resets within seconds for per-second limits, within a minute for per-minute token limits, or at the start of the next month for monthly token quotas. The free tier has restrictive limits; upgrading to the Scale plan raises them, and they rise further as your cumulative spend passes each threshold. [Rate limits](https://docs.mistral.ai/deployment/ai-studio/tier)
> - **OpenAI**: Resets within a few minutes to an hour. Limits rise as you move up usage tiers. [Rate limits](https://platform.openai.com/docs/guides/rate-limits)

##### Error 503: Service unavailable
**Cause**: The provider's servers are temporarily overloaded or unavailable. This is outside the plugin's control and is more common with Gemini.

**Fix**:
- Wait a few minutes and try again.
- If it persists, check the provider's status page for ongoing incidents.

##### Can't connect to a local server
**Fix**:
- Make sure your local server (LM Studio, Ollama, vLLM, etc.) is running.
- Check the **Local URL** in settings, including the port and path (e.g. \`/v1/chat/completions\`).
- If your server requires authentication, fill in the API key field.

##### Local model tool calls fail or loop
**Cause**: Not every local model handles multi-turn tool calling reliably. This is a model or chat template limitation rather than a plugin bug.

**Fix**:
- Adjust your server's chat template for tool calling (e.g. LM Studio's prompt template).
- Try a model known to support tool/function calling well.`,

    AboutModalPrivacyTitle = "Privacy",
    AboutModalPrivacyContent = `##### Your data, your rules
**No middleman servers**: With a cloud provider, the content you share goes directly from Obsidian to that provider. Nothing is sent to any other third party, no telemetry is collected, and the full source code is available on GitHub.

> [!note] Local models
> With a local model, nothing leaves your machine.

##### Stored in your vault
- **API keys**: in the plugin settings
- **Conversation history**: in \`Vaultkeeper AI/Conversations/\`
- **Custom instructions**: in \`Vaultkeeper AI/User Instructions/\`
- **Memories**: in \`Vaultkeeper AI/Memories.md\`
- **Plugin settings**: in \`.obsidian/plugins/vaultkeeper-ai/\`

##### Sent to your provider
- Your messages and the contents of any files you reference or attach
- Files the AI reads while working, including PDFs, Office documents and images
- File and folder names returned by the AI's searches and folder listings
- Earlier messages in the conversation, for context
- Your memories, if enabled

Excluded files, other plugins' data and your API keys are never sent, apart from each key going to its own provider.

##### File exclusions
Keep sensitive notes private by adding glob patterns in settings. Excluded files are completely invisible to the AI: they won't appear in searches or folder listings and can't be read or modified.

- \`private/**\`: an entire folder
- \`journal/personal/**\`: a nested folder
- \`*.secret.md\`: any file matching a pattern
- \`.obsidian/workspace.json\`: a single file

##### Provider privacy policies
- [Anthropic (Claude)](https://www.anthropic.com/privacy)
- [Google (Gemini)](https://policies.google.com/privacy)
- [OpenAI](https://openai.com/privacy)
- [Mistral AI](https://legal.mistral.ai/terms/privacy-policy)`,

    // Conversation Modal Copy
    NoConversationsFound = "No conversations match your search.",

    // Artifact Copy
    ArtifactActionCreated = "CREATED",
    ArtifactActionModified = "MODIFIED",
    ArtifactActionDeleted = "DELETED",
    ArtifactActionMoved = "MOVED",

    // About Modal Additional Copy
    AboutModalCloseAriaLabel = "Close About Modal",
    PluginVersionPrefix = "Plugin version: ",

    // GitHub
    GitHubLinkText = "View on GitHub",
    GitHubIconAriaLabel = "GitHub",

    // Coffee/Support
    CoffeeLinkIntroText = "If you enjoy using the plugin or find it useful and want to contribute, you can buy me a Coffee using the link below:",
    CoffeeIcon = "☕",
    CoffeeLinkText = "Buy me a coffee",

    // Thank You Message
    ThankYouMessage = "Thanks for using the Vaultkeeper AI plugin!",

    // SVG Icons
    GitHubIconPath = "M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z",

    // Example Content
    EXAMPLE_USER_INSTRUCTION = `### TL;DR

**My recommendation would be to write down in your own words what you would like the AI to specialise in and how you would like it to manage your vault. Then ask an AI to write a system prompt using the latest best practices from your description.**

---

# System Prompt Template for LLMs (2025)

A clear, structured system prompt template following the latest best practices for effective LLM interactions.

---

## Template Structure

### 1. Role & Identity
**Define who the AI should be.**

\`\`\`
You are [role/persona with specific expertise].
\`\`\`

**Example:**
\`\`\`
You are an experienced technical writer who specializes in creating clear documentation for software developers.
\`\`\`

**Why this matters:** Role-playing guides the model's tone and depth, helping it understand the appropriate level of expertise and communication style.

---

### 2. Core Objective
**State the primary purpose clearly and directly.**

\`\`\`
Your main goal is to [specific objective].
\`\`\`

**Example:**
\`\`\`
Your main goal is to help users write bug-free Python code by providing clear explanations and suggesting best practices.
\`\`\`

**Why this matters:** Being specific and concise helps the model understand exactly what you want without overloading it with unnecessary information.

---

### 3. Key Behaviors & Guidelines
**List the most important rules the AI should follow.**

\`\`\`
Always:
- [Behavior 1]
- [Behavior 2]
- [Behavior 3]

Never:
- [Restriction 1]
- [Restriction 2]
\`\`\`

**Example:**
\`\`\`
Always:
- Explain concepts in simple terms before diving into technical details
- Provide working code examples when suggesting solutions
- Ask clarifying questions when requirements are ambiguous

Never:
- Make assumptions about the user's skill level without asking
- Suggest deprecated or insecure coding practices
- Provide code without explaining what it does
\`\`\`

**Why this matters:** Clear instructions with both positive and negative examples help establish consistent response patterns.

---

### 4. Output Format (Optional)
**Specify how responses should be structured.**

\`\`\`
Format your responses as follows:
[structure description]
\`\`\`

**Example:**
\`\`\`
Format your responses as follows:
1. Brief summary (1-2 sentences)
2. Detailed explanation
3. Code example (if applicable)
4. Common pitfalls to avoid
\`\`\`

**Why this matters:** Defining the expected format helps the model stay focused and produces outputs that are easier to read and use.

---

### 5. Context & Constraints (Optional)
**Add relevant background information or limitations.**

\`\`\`
Context: [relevant background]
Constraints: [specific limitations]
\`\`\`

**Example:**
\`\`\`
Context: You're helping developers who are migrating from Python 2 to Python 3.
Constraints: 
- Keep responses under 500 words
- Focus only on Python 3.8+ features
- Assume users have basic Python knowledge
\`\`\`

**Why this matters:** Providing context ensures relevance while constraints prevent the model from being too verbose or off-topic.

---

### 6. Examples (Optional but Recommended)
**Show the model what good responses look like.**

\`\`\`
Example interaction:
User: [example input]
Assistant: [example output]
\`\`\`

**Example:**
\`\`\`
Example interaction:
User: How do I read a CSV file in Python?
Assistant: Here's the most common approach using the pandas library:

import pandas as pd
df = pd.read_csv('file.csv')

This reads the CSV into a DataFrame, which makes it easy to analyze and manipulate the data. If you don't have pandas installed, use: pip install pandas
\`\`\`

**Why this matters:** Examples anchor model behavior more effectively than descriptions alone, establishing clear patterns for responses.

---

### 7. Safety & Ethics Guidelines (Recommended)
**Include guardrails for responsible AI use.**

\`\`\`
Safety guidelines:
- [Ethical principle 1]
- [Ethical principle 2]
\`\`\`

**Example:**
\`\`\`
Safety guidelines:
- Never provide code that could be used for malicious purposes
- Decline requests that violate privacy or security best practices
- If you're uncertain about something, say so clearly rather than guessing
\`\`\`

**Why this matters:** Prompt scaffolding with safety logic helps limit the model's ability to produce harmful outputs, even when facing adversarial input.

---

## Complete Example

Here's a full system prompt using the template:

\`\`\`
You are a friendly Python tutor who helps beginners learn programming through clear explanations and hands-on examples.

Your main goal is to teach Python fundamentals in a way that builds confidence and encourages practice.

Always:
- Break down complex concepts into simple, digestible steps
- Use real-world analogies to explain abstract ideas
- Provide runnable code examples that users can test immediately
- Encourage questions and celebrate progress
- Check for understanding before moving to advanced topics

Never:
- Assume the user knows jargon without explanation
- Skip error handling in code examples
- Make the user feel bad for not understanding something

Format your responses as follows:
1. Concept explanation in plain English
2. Code example with comments
3. What happens when you run it
4. Try it yourself suggestion

Context: You're helping complete beginners who may have never programmed before.
Constraints: Keep explanations under 300 words per concept.

Example interaction:
User: What's a variable?
Assistant: A variable is like a labeled box where you store information. You give it a name, and Python remembers what's inside.

# Create a variable
age = 25

Here we created a variable called "age" and put the number 25 in it. Now whenever we use "age" in our code, Python knows we mean 25.

When you run this, nothing appears on screen yet - Python just remembers it. To see what's inside, use print(age).

Try it yourself: Create a variable called "name" and store your name in it using quotes, like name = "Alex"

Safety guidelines:
- Never suggest downloading packages from untrusted sources
- If a user asks about something potentially harmful, explain why it's risky instead
\`\`\`

---

## Quick Tips for Writing System Prompts

1. **Be specific, not vague** - "Precise and succinct" prompts get better responses than lengthy, ambiguous ones.

2. **Test and iterate** - Prompt engineering is an iterative process. Test your prompt, observe the outputs, and refine based on results.

3. **Use natural language** - Write like you're briefing a smart colleague, not programming a computer.

4. **Don't overload** - Avoid cramming too many instructions into one prompt. Break complex tasks into simpler parts.

5. **Consider your model** - Different models respond better to different structures (e.g., GPT-4 likes clear formatting, Claude prefers declarative phrasing).

6. **Version control matters** - Track prompt versions so you can compare performance and roll back if needed.

---

## Variables for Dynamic Prompts

For reusable templates, use variables for content that changes:

\`\`\`
User's question: {{user_question}}
User's experience level: {{experience_level}}
Preferred programming language: {{language}}
\`\`\`

**Why this matters:** Variables make prompts flexible and reusable across different contexts without rewriting the entire prompt.

---

## Common Mistakes to Avoid

❌ **Too vague:** "Help the user with code"
✅ **Specific:** "Help the user debug Python errors by identifying the issue, explaining why it occurred, and suggesting a fix"

❌ **Conflicting instructions:** "Be brief but explain everything in detail"
✅ **Clear priorities:** "Provide concise summaries, with the option to elaborate if the user asks"

❌ **No examples:** Just describing what you want
✅ **With examples:** Showing exactly what good output looks like

---

**Remember:** A good system prompt is clear, dense, and easy to understand, leaving no room for misinterpretation. Start simple, test thoroughly, and refine based on real results.`
}
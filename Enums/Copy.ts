export enum Copy {
    // General Copy
    UserInstructions1 = "You can create custom ",
    UserInstructions2 = "instructions",
    UserInstructions3 = " that the AI will follow.",
    NoUserInstruction = "No custom instructions",

    // Model Display Names
    ClaudeFable_5 = "Claude Fable 5",
    ClaudeSonnet_5 = "Claude Sonnet 5",
    ClaudeOpus_4_8 = "Claude Opus 4.8",
    ClaudeHaiku_4_5 = "Claude Haiku 4.5",

    GeminiFlash_3_1_Lite = "Gemini 3.1 Flash-Lite",
    GeminiFlash_3_Flash = "Gemini 3 Flash",
    GeminiFlash_3_5_Flash = "Gemini 3.5 Flash",
    GeminiPro_3_1_Preview = "Gemini 3.1 Pro Preview",

    GPT_5_6_Sol = "GPT-5.6 Sol",
    GPT_5_6_Terra = "GPT-5.6 Terra",
    GPT_5_6_Luna = "GPT-5.6 Luna",

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
    SettingSearchResultsLimit = "Search results limit",
    SettingSnippetSizeLimit = "Snippet size limit",
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
    SettingSearchResultsLimitDesc = "Set the maximum number of results provided to the AI when it searches through files in your vault. Higher values provide more context but increase search time.",
    SettingSnippetSizeLimitDesc = "Set the character limit of search previews provided to the AI when it searches through files in your vault. Higher values provide more context per result.",
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
    AIThoughtGeneratingNote = "Generating note contents...",
    AIThoughtPreparingQuery = "Preparing user query...",
    PlanningInProgress = "Planning in progress...",

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
    InputPlaceholderDiff = "Make a suggestion...",
    InputPlaceholderPlanApproval = "Suggest a change to the plan...",
    InputPlaceholderNormal = "Type a message...",

    // Chat Input Button Labels
    ButtonCancel = "Cancel",
    ButtonSubmitAnswer = "Submit answer",
    ButtonMakeSuggestion = "Make Suggestion",
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
    ContinuePlanExecution = "Tools and context restored. You may continue working on the current step.",
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
    RequestPlanSummary = "The workflow has completed. Provide a concise summary for the user that covers: (1) what was originally planned, (2) what was actually accomplished, and (3) any notable outcomes or issues. Reference the execution agent outputs and step results for context.",
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
    DirectiveWebViewerDisabled = "- **Web Viewer**: DISABLED — the web viewer tool is unavailable; if the user requests it, inform them it is currently turned off in settings",

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

    // Help Modal Copy
    HelpModalAboutTitle = "About",
    HelpModalAboutContent = `#### About Vaultkeeper AI

This plugin was originally created for a friend who found it useful, so I have decided to release it to the Obsidian community.

If you find any issues or have a feature request, please feel free to raise them on GitHub:`,

    HelpModalGettingStartedTitle = "Getting started",
    HelpModalGettingStartedContent = `#### Getting started

1. **Add an API key**: Go to Settings and add at least one API key (Claude, Gemini, OpenAI, or Mistral) — or select **Local** to connect a self-hosted server instead, no API key required
2. **Select a model**: Choose your preferred AI model from the dropdown
3. **Open the chat**: Click the plugin icon in the sidebar to start chatting`,

    HelpModalChatModesTitle = "Chat modes",
    HelpModalChatModesContent = `#### Chat modes

**Read-only (default)** - The AI can safely explore your vault:
- Search through your notes (including PDFs and Office/ODF documents)
- Read file contents (including binary files like PDFs, Office documents, and images)
- List directory structures
- Cannot modify anything

**Allow Edits** - Switch on when you need the AI to make changes:
- Create new notes
- Edit existing content
- Delete or move files
- Rename files

**Planning** - Have the AI plan before acting:
- A planning agent analyzes your vault and creates a strategy
- An execution agent carries out the given plan`,

    HelpModalReferenceTitle = "Using references",
    HelpModalReferenceContent = `#### Using references

Quickly provide context to the AI:

- **@filename** - Reference specific files
- **&#35;tag** - Reference all notes with a tag
- **/folder** - Reference entire directories

The autocomplete dropdown supports keyboard navigation.`,

    HelpModalCustomInstructionsTitle = "Custom instructions",
    HelpModalCustomInstructionsContent = `#### Custom instructions

Customize AI behavior for specific workflows:

1. Create markdown files in **Vaultkeeper AI/User Instructions/**
2. Click the "User Instructions" button in chat
3. Select your instruction set
4. The AI follows these instructions for all interactions

See [[Vaultkeeper AI/User Instructions/EXAMPLE_INSTRUCTIONS|Example Template]] for help getting started.`,

    HelpModalQuickActionsTitle = "Quick actions",
    HelpModalQuickActionsContent = `#### Quick actions

Quick actions are one-click AI edits you run on the note you're currently editing. Open the editor menu (right-click, or the command palette) and pick an action. Some actions work on your current selection if you have text selected, otherwise they apply to the whole note.

##### Proofread
Corrects spelling, grammar, punctuation, and typos without rewriting for style or changing your voice. Works on the selection if you have one, otherwise the whole note.

##### Beautify
Improves clarity, flow, and readability and adds Markdown formatting (headings, bold, lists, blockquotes) where it helps. Works on the selection if you have one, otherwise the whole note.

##### Apply template
Restructures the note to match a template you choose, fitting your content to the template's headings and structure while preserving the information. If the file you pick doesn't look like a template, no changes are made.

##### Apply links
Scans the note for mentions of pages that already exist in your vault and wraps them in wikilinks. It only links existing pages and never invents new ones. Works on the selection if you have one, otherwise the whole note.

##### Apply tags
Chooses tags for the note from the tags that already exist in your vault and merges them into the frontmatter. It won't create new tags — only ones already in use elsewhere.

##### Suggest tags
Like Apply tags, but free to suggest new tags as well as reuse existing ones. Suggested tags are merged into the note's frontmatter.

##### Generate frontmatter
Infers YAML frontmatter for the note (aliases, tags, title, summary, created) from its content and merges it into any existing frontmatter.`,

    HelpModalUploadedFilesTitle = "Uploaded files",
    HelpModalUploadedFilesContent = `#### Uploaded files

When you upload files (PDFs, images) to conversations, they are stored by your AI provider. The plugin automatically attempts to delete these files when you delete conversations, but this may occasionally fail due to network issues or API rate limits.

**What to do:**
- Periodically check your provider's dashboard for uploaded files
- Remove any old files that are no longer needed
- Provider-specific details can be found in the plugin settings

**Provider dashboards:**
- Claude: [Anthropic Console](https://console.anthropic.com/)
- Gemini: [Google AI Studio](https://aistudio.google.com/)
- OpenAI: [OpenAI Platform](https://platform.openai.com/)
- Mistral: [Mistral Console](https://console.mistral.ai/)

**Local**: Files aren't uploaded anywhere - they're sent inline with your message directly to your local server, so there's nothing to clean up on a dashboard.`,

    HelpModalTroubleshootTitle = "Troubleshooting",
    HelpModalTroubleshootContent = `#### Common issues & solutions

##### API key issues

**Problem**: "Invalid API key" or authentication errors

**Solutions**:
- Verify your API key is correct (copy fresh from provider console)
- Check you've added the key for the correct provider
- Ensure no extra spaces when pasting
- API keys are provider-specific - Claude keys only work with Claude models

##### Error code 429: Rate limit exceeded

This error means you've made too many API requests in a given time period. This is separate from your token usage limits.

**How to resolve:**
- Wait for your rate limit to reset (see provider-specific details below)
- Lower the search result and snippet size limits in the plugin settings to reduce request size
- Understand that rate limits typically increase automatically as you use the API more

###### Claude
- **Wait time:** A few hours
- **Long-term solution:** Rate limits increase significantly after reaching cumulative spending thresholds
- [Claude Rate Limits Documentation](https://docs.claude.com/en/api/rate-limits)

###### OpenAI
- **Wait time:** A few minutes to an hour
- **Long-term solution:** Rate limits automatically increase as you progress through usage tiers with higher spending
- [OpenAI Rate Limits Documentation](https://platform.openai.com/docs/guides/rate-limits)

###### Gemini
- **Wait time:** A few minutes (per-minute limits) or until midnight Pacific Time (daily quotas)
- **Long-term solution:** Enable billing to move from free tier to paid tier for significantly higher limits. Paid tier limits increase automatically with cumulative Google Cloud spending
- [Gemini API Rate Limits Documentation](https://ai.google.dev/gemini-api/docs/rate-limits)

##### Error code 503: Service unavailable

This error indicates a temporary issue with the AI provider's servers.

**What it means:**
- The provider's service is temporarily unavailable or overloaded
- This occurs more frequently with Gemini than other providers

**How to resolve:**
- Wait a few minutes and try again
- There is no action you can take to prevent this error - it's on the provider's side
- If the issue persists, check the provider's status page for any ongoing incidents

##### Local model issues

**Problem**: Can't connect to the local server

**Solutions**:
- Make sure your local server (LM Studio, Ollama, vLLM, etc.) is actually running
- Double-check the **Local URL** in settings, including the path (e.g. \`/v1/chat/completions\`) and port
- If your server requires authentication, make sure the API key field is filled in

**Problem**: Tool calls fail, loop, or the AI ignores tool results

**Solutions**:
- Not all local models support multi-turn tool calling reliably - this is a model/template limitation, not a plugin bug
- Check your server's chat template settings (e.g. LM Studio's prompt template) and adjust it for tool-calling if needed
- Try a model known to support tool/function calling well`,

    HelpModalPrivacyTitle = "Privacy",
    HelpModalPrivacyContent = `#### Privacy & security

##### Data storage

**Everything stays local** - This plugin does NOT send data to any third-party services except the AI providers you choose. It also doesn't collect any telemetry data and you can review the full source code on GitHub.

**What's stored locally**:
- API keys (stored in your vault's plugin settings)
- Conversation history (stored in \`Vaultkeeper AI/Conversations/\`)
- Custom instructions (stored in \`Vaultkeeper AI/User Instructions/\`)
- Plugin settings (stored in \`.obsidian/plugins/vaultkeeper-ai/\`)

##### API communication

**Direct connections only** - The plugin communicates directly with your chosen AI provider:

- **Claude**: Anthropic's API
- **Gemini**: Google's API
- **OpenAI**: OpenAI's API
- **Mistral**: Mistral AI's API
- **Local**: Your own self-hosted server - no cloud provider is involved at all, so nothing leaves your machine

**What gets sent**:
- Your messages and referenced file contents (including binary files like PDFs, Office documents, and images)
- Conversation context (for continuity)
- File names and directory structures (when AI searches)

**What does NOT get sent**:
- Files excluded in settings
- Other plugins' data
- Your vault structure (unless explicitly requested)
- API keys to anyone except the respective provider

##### File exclusions

**Protect sensitive information** using glob patterns in settings:

**Examples**:
- \`private/**\` - Exclude entire directories
- \`*.secret.md\` - Exclude specific file patterns
- \`journal/personal/**\` - Exclude nested directories
- \`.obsidian/workspace.json\` - Exclude specific files

**How exclusions work**:
- Excluded files are completely invisible to the AI
- The AI cannot read, search, modify, or even list excluded files
- Exclusions apply to all operations

##### AI provider policies

Each AI provider has their own data policies:

- [Anthropic (Claude)](https://www.anthropic.com/privacy)
- [Google (Gemini)](https://policies.google.com/privacy)
- [OpenAI (ChatGPT)](https://openai.com/privacy)
- [Mistral AI](https://legal.mistral.ai/terms/privacy-policy)`,

    // Conversation Modal Copy
    NoConversationsFound = "No conversations match your search.",

    // Artifact Copy
    ArtifactActionCreated = "CREATED",
    ArtifactActionModified = "MODIFIED",
    ArtifactActionDeleted = "DELETED",

    // Help Modal Additional Copy
    HelpModalCloseAriaLabel = "Close Help Modal",
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
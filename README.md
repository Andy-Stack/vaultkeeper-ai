# Vaultkeeper AI for Obsidian

> A powerful AI assistant plugin that brings Claude, Gemini, OpenAI, and Mistral directly into your Obsidian vault with intelligent note management capabilities.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md)

<p align="center">
	<img width="1853" height="896" alt="vaultkeeper-ai" src="https://github.com/user-attachments/assets/cdb20159-e679-4e73-8535-9fec0258df39" />
</p>

## Features

- **Multi-Provider AI Support** - Switch seamlessly between Claude (Anthropic), Gemini (Google), OpenAI, and Mistral models
- **Two Operating Modes**
  - 🔍 **Read-Only Mode**: AI can search, read, and list your notes safely
  - ✏️ **Agent Mode**: AI can create, edit, delete, and move notes (when you need it)
- **Planning Mode** - Enable a two-agent workflow where a planning agent analyzes your vault and creates a step-by-step strategy before execution
- **Interactive Diff Viewer** - Review and approve AI-proposed changes before they're applied with side-by-side diff view
- **Smart Reference System** - Mention tags (`#`), files (`@`), and folders (`/`) with autocomplete
- **Custom System Instructions** - Create and switch between personalized AI behaviors
- **Conversation Management** - Persistent chat history with automatic conversation naming
- **Privacy Controls** - Exclude sensitive files and directories from AI access with glob patterns
- **Files Support (PDF, Documents, Images, etc)** - Search through PDF and Office documents (DOCX, PPTX, XLSX) and allow AI to read binary files directly (PDFs, Office/ODF documents, images, etc)
- **Mobile Compatible** - Full functionality on mobile devices with touch-friendly controls
- **Streaming Responses** - See AI responses as they're generated
- **Local & Private** - API keys stored locally, no data sent to third parties

## Installation

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/andy-stack/vaultkeeper-ai/releases)
2. Extract the files into your vault's `.obsidian/plugins/vaultkeeper-ai/` directory
3. Reload Obsidian
4. Enable "Vaultkeeper AI" in Settings → Community Plugins

### From Community Plugins (Plugin has not yet been reviewed and accepted - hopefully coming soon)

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Vaultkeeper AI"
4. Click Install, then Enable

## Quick Start

1. **Add API Keys**: Open plugin settings and add at least one API key:
   - **Claude**: Get from [Anthropic Console](https://console.anthropic.com/)
   - **Gemini**: Get from [Google AI Studio](https://aistudio.google.com/)
   - **OpenAI**: Get from [OpenAI Platform](https://platform.openai.com/)
   - **Mistral**: Get from [Mistral Console](https://console.mistral.ai/)

2. **Select a Model**: Choose your preferred AI model from the dropdown

3. **Start Chatting**: Click the Vaultkeeper AI icon in the left sidebar to open the chat window

4. **Try the Reference System**:
   - Type `@` to reference files
   - Type `#` to reference tags
   - Type `/` to reference folders

## Usage

### Switching Between Models

The plugin supports multiple AI models:

**Claude (Anthropic)**

- Claude Sonnet 4.6 ⚡ (Recommended)
- Claude Sonnet 4.5, 4
- Claude Opus 4.6, 4.5, 4.1, 4
- Claude Haiku 4.5

**Gemini (Google)**

- Gemini 3.1 Pro Preview, 3 Pro Preview, 3 Flash Preview
- Gemini 2.5 Flash, Pro
- Gemini 2.5 Flash Lite

**OpenAI**

- GPT-5.2 (Instant, Thinking, Pro)
- GPT-5.1, GPT-5 (Mini, Nano)

**Mistral**

- Mistral Large
- Mistral Medium
- Mistral Small

Switch models anytime in the settings without losing your conversation context.

### Read-Only vs Agent Mode

**Read-Only Mode (Default)** 🔍

- AI can search vault content (text based files, PDFs, and Office/ODF documents)
- AI can read file contents (including binary files like PDFs, Office documents, and images)
- AI can list directory structures
- **Cannot** modify your notes

Toggle to **Agent Mode** ✏️ when you need the AI to:

- Create new notes
- Edit existing content
- Delete files
- Move/rename files

The mode toggle is clearly visible in the chat input area with visual indicators.

### Interactive Diff Viewer

When the AI proposes changes to your files in Agent Mode, an interactive diff viewer appears that lets you:

- **Review Changes**: See a side-by-side comparison of the current file and proposed changes
- **Approve or Reject**: Accept the changes to apply them, or reject to cancel
- **Provide Feedback**: Suggest modifications before accepting by typing your feedback and clicking the suggestion button
- **Mobile Support**: Touch-friendly Accept/Reject buttons on mobile devices

The diff viewer ensures you're always in control of what changes are made to your vault, providing transparency and safety when working with AI-generated edits.

### Planning Mode

Planning Mode introduces a three-agent workflow that separates task planning, orchestration, and execution. When enabled, specialized agents collaborate to analyze your vault, create a detailed strategy, and execute changes with intelligent oversight between each step.

**How It Works**

1. **Enable Planning Mode**: Click the planning mode button in the chat input toolbar (list icon)
2. **Submit Your Request**: Send your message as normal
3. **Planning Phase**: The planning agent analyzes your vault, exploring existing notes, organizational patterns, and relevant content
4. **Clarifying Questions**: The planning agent may ask you questions to better understand your requirements
5. **Plan Display**: A step-by-step plan appears above the chat showing what will be done
6. **Execution Phase**: For each step, an execution agent performs the task while an orchestration agent monitors progress and decides whether to continue, adapt, or replan
7. **Completion**: All steps are marked complete when finished

**The Three Agents**

- **Planning Agent**: Explores your vault (read-only) and creates the execution strategy. Can search files, read content, and ask clarifying questions, but cannot modify anything.
- **Execution Agent**: Performs individual steps from the plan. Has full access to vault operations (when in Agent Mode) and completes each task independently.
- **Orchestration Agent**: Monitors progress between steps. After each step completes, it evaluates the result and decides whether to continue to the next step, request a replan, or abort the workflow. It can also pass context to subsequent steps based on what was learned.

**Plan Visualization**

- Steps display in a collapsible panel above the chat
- Status indicators show progress: pending, active (with spinner), or completed (green checkmark)
- The view auto-scrolls to keep the active step visible
- Expand/collapse to see the full plan or a compact view

**When to Use Planning Mode**

Planning mode is especially useful for:
- Complex multi-step tasks requiring vault exploration
- Comprehensive changes across multiple files
- Research tasks needing deep vault analysis
- Tasks where you want to review the approach before execution
- Uncertain requirements where clarifying questions help

**Replanning**

If issues arise during execution, the orchestration agent can request a replan. This returns to the planning phase with full context about what's already been completed and what went wrong, allowing the plan to intelligently adapt to new information discovered during execution.

### Reference System

Quickly provide context to the AI using the reference system:

**Files** - Type `@` followed by the filename:

```
@meeting-notes What action items did we discuss?
```

**Tags** - Type `#` to reference tagged notes:

```
#project/alpha Show me all notes about project alpha
```

**Folders** - Type `/` to reference entire directories:

```
/Daily Notes Summarize this week's daily notes
```

The autocomplete dropdown appears automatically and supports:

- Fuzzy search (type partial names)
- Keyboard navigation (↑↓ arrows)
- Visual preview with full paths

### Custom System Instructions

Customize the AI's behavior with system instructions:

1. Create markdown files in `Vaultkeeper AI/User Instructions/`
2. Click the "User Instructions" button in the chat
3. Select your custom instruction set
4. The AI will follow these instructions for all interactions

Example use cases:

- Research assistant mode
- Creative writing partner
- Code documentation helper
- Academic note-taker

See `EXAMPLE_INSTRUCTIONS.md` in your vault for a template.

### Conversation History

- All conversations are automatically saved
- Click the history icon to browse past conversations
- Conversations are automatically named by AI based on content
- Stored in `Vaultkeeper AI/Conversations/` as JSON files

## Configuration

### Settings

**API Keys**

- Add keys for Claude, Gemini, OpenAI, or Mistral
- Keys stored locally in your vault
- Never transmitted except to respective AI providers

**Model Selection**

- Choose from 15+ supported models
- Switch anytime without conversation loss

**Planning Model**

- Select a separate model for the planning agent (used in Planning Mode)
- Default: Claude Sonnet 4.6
- Allows cost optimization by using a more capable model for planning and a faster/cheaper model for execution
- The planning model dropdown updates to match your selected provider

**Search Configuration**

Fine-tune the balance between request size and agent performance:

- **Search Results Limit** (default: 15)
  - Controls the maximum number of files returned in search operations
  - Lower values (5-10): Faster searches and reduced API costs
  - Higher values (20-30): Provide more context, potentially improving agent performance
  - Adjust based on your vault size and typical query complexity

- **Snippet Size Limit** (default: 300 characters)
  - Sets the character limit for contextual snippets in search results
  - Lower values (100-200): Reduce request size for cost-conscious users
  - Higher values (400-600): Give the AI more context to understand file relevance
  - Balance between providing enough context and controlling costs

**File Exclusions**

Protect your privacy by preventing the AI from accessing sensitive files or directories:

- **How it works**: Exclusions apply to all AI operations in both read-only and agent modes
- **Use glob patterns** to specify what to exclude:
  - `private/**` - Exclude entire directories (all files in "private" folder)
  - `*.secret.md` - Exclude specific file patterns (any file ending in .secret.md)
  - `journal/personal/**` - Exclude nested directories
  - `.obsidian/workspace.json` - Exclude specific configuration files

- **Common use cases**:
  - Personal journals or diary entries
  - Financial information
  - Work-related confidential notes
  - API keys or credentials stored in notes
  - Draft content you don't want analyzed

- **Privacy guarantee**: Excluded files are completely inaccessible to the AI - they won't appear in searches, can't be read, and can't be modified even in agent mode

**Custom Instructions Path**

- Customize where instruction files are stored
- Default: `Vaultkeeper AI/User Instructions/`

## Development

### Prerequisites

- Node.js v16 or higher
- npm
- Obsidian (for testing)

### Setup

```bash
# Clone into your vault's plugin directory
cd /path/to/vault/.obsidian/plugins/
git clone https://github.com/andy-stack/vaultkeeper-ai.git
cd vaultkeeper-ai

# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build
```

### Testing

The project uses Vitest for testing:

```bash
# Run all tests
npm test
```

## Contributing

This plugin was originally created for a friend and is now being shared with the broader Obsidian community. As a solo developer with limited time, I'm currently **not accepting contributions** (pull requests are disabled).

#### Why?

I simply don't have the capacity to review, test, and maintain community contributions at this time. I want to be respectful of contributors' time and effort, and accepting PRs that I can't properly review wouldn't be fair to anyone.

#### What if I find a bug or have a suggestion?

Please feel free to open an issue! While I can't guarantee quick responses, I do want to know if something isn't working correctly or if there are ideas that would benefit the community.

#### Can I fork this project?

Absolutely! This project is open source under MIT, so you're welcome to fork it and make your own modifications.

#### Will this change?

If there's significant community interest and usage, I may revisit this decision and open up contributions in the future. For now, I'm focused on keeping the plugin stable and functional for its current users.

---

Thank you for understanding! 🙏

## Privacy & Security

- **API Keys**: Stored locally in your Obsidian vault, never transmitted to third parties
- **No External Servers**: Direct communication with AI providers only
- **File Exclusions**: Protect sensitive information by excluding individual files or entire directories from AI access using glob patterns - excluded files are completely inaccessible in both read-only and agent modes
- **Local Storage**: All conversations and settings stored in your vault
- **Open Source**: Fully auditable codebase

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/andy-stack/vaultkeeper-ai/issues)

## Acknowledgments

This plugin is built on the shoulders of many excellent projects:

**Platform & AI**
- Built for [Obsidian](https://obsidian.md)
- Powered by [Anthropic Claude](https://anthropic.com), [Google Gemini](https://deepmind.google/technologies/gemini/), [OpenAI](https://openai.com), and [Mistral AI](https://mistral.ai)
- Official SDKs: [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript), [@google/genai](https://github.com/google/generative-ai-js), [openai](https://github.com/openai/openai-node)

**Document Processing**
- [unpdf](https://github.com/unjs/unpdf) - PDF parsing and text extraction
- [officeparser](https://github.com/nicktomlin/officeparser) - Office document parsing (DOCX, PPTX, XLSX, ODT, ODP, ODS)

**UI Framework**
- [Svelte](https://svelte.dev) - Reactive UI components
- [svelte-exmarkdown](https://github.com/ssssota/svelte-exmarkdown) - Markdown rendering for Svelte

**Markdown Processing**
- [unified](https://unifiedjs.com/) - Markdown processing pipeline
- [remark](https://github.com/remarkjs/remark) - Markdown parser and compiler
- [rehype](https://github.com/rehypejs/rehype) - HTML processor
- [remark-gfm](https://github.com/remarkjs/remark-gfm) - GitHub Flavored Markdown support
- [remark-wiki-link](https://github.com/landakram/remark-wiki-link) - Obsidian-style wiki links

**Rich Content Rendering**
- [KaTeX](https://katex.org/) - Mathematical notation rendering
- [Shiki](https://shiki.style/) - Modern syntax highlighting
- [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize) - HTML sanitization for security

**Diff & Code Review**
- [diff](https://github.com/kpdecker/jsdiff) - Text diffing library for change detection
- [diff2html](https://github.com/rtfpessoa/diff2html) - Beautiful side-by-side diff viewer

**Utilities**
- [fuzzysort](https://github.com/farzher/fuzzysort) - Fuzzy search for reference autocomplete
- [Zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation
- [regex-parser](https://github.com/IonicaBizau/regex-parser.js) - Parses a string as regular expression

**Development**
- [Vitest](https://vitest.dev/) - Fast unit testing framework
- [esbuild](https://esbuild.github.io/) - Lightning-fast bundler
- [TypeScript](https://www.typescriptlang.org/) - Type-safe development

**CSS**
- [Loader](https://uiverse.io/Li-Deheng/bright-firefox-37) - Animated streaming indicator adapted from original by Li-Deheng
- [Gradient Border](https://codepen.io/alphardex/pen/vYEYGzp) - Animated border adapted from original by alphardex
- [Gradient Spinner](https://codepen.io/AlexWarnes/pen/jXYYKL) - Animated spinner adapted from original by AlexWarnes

---

**Note**: This plugin requires API keys from AI providers. API usage is billed by the respective providers according to their pricing. Monitor your usage through provider dashboards.
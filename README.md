# AI Agent for Obsidian

> A powerful AI assistant plugin that brings Claude, Gemini, and OpenAI directly into your Obsidian vault with intelligent note management capabilities.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md)

## Features

- **Multi-Provider AI Support** - Switch seamlessly between Claude (Anthropic), Gemini (Google), and OpenAI models
- **Two Operating Modes**
  - 🔍 **Read-Only Mode**: AI can search, read, and list your notes safely
  - ✏️ **Agent Mode**: AI can create, edit, delete, and move notes (when you need it)
- **Smart Reference System** - Mention tags (`#`), files (`@`), and folders (`/`) with autocomplete
- **Custom System Instructions** - Create and switch between personalized AI behaviors
- **Conversation Management** - Persistent chat history with automatic conversation naming
- **Privacy Controls** - Exclude sensitive files and directories from AI access with glob patterns
- **Token Tracking** - Real-time monitoring of API usage with configurable search limits
- **Mobile Compatible** - Full functionality on mobile devices
- **Streaming Responses** - See AI responses as they're generated
- **Local & Private** - API keys stored locally, no data sent to third parties

## Installation

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/yourusername/ai-agent-plugin/releases)
2. Extract the files into your vault's `.obsidian/plugins/ai-agent-plugin/` directory
3. Reload Obsidian
4. Enable "AI Agent" in Settings → Community Plugins

### From Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "AI Agent"
4. Click Install, then Enable

## Quick Start

1. **Add API Keys**: Open plugin settings and add at least one API key:
   - **Claude**: Get from [Anthropic Console](https://console.anthropic.com/)
   - **Gemini**: Get from [Google AI Studio](https://aistudio.google.com/)
   - **OpenAI**: Get from [OpenAI Platform](https://platform.openai.com/)

2. **Select a Model**: Choose your preferred AI model from the dropdown

3. **Start Chatting**: Click the AI Agent icon in the left sidebar to open the chat window

4. **Try the Reference System**:
   - Type `@` to reference files
   - Type `#` to reference tags
   - Type `/` to reference folders

## Usage

### Switching Between Models

The plugin supports multiple AI models:

**Claude (Anthropic)**

- Claude Sonnet 4.5 ⚡ (Recommended)
- Claude Opus 4.1, 4
- Claude Haiku 4.5

**Gemini (Google)**

- Gemini 2.5 Flash, Pro
- Gemini 2.5 Flash Lite

**OpenAI**

- GPT-5 (Pro, Mini, Nano)
- GPT-4o, GPT-4.1

Switch models anytime in the settings without losing your conversation context.

### Read-Only vs Agent Mode

**Read-Only Mode (Default)** 🔍

- AI can search vault content
- AI can read file contents
- AI can list directory structures
- **Cannot** modify your notes

Toggle to **Agent Mode** ✏️ when you need the AI to:

- Create new notes
- Edit existing content
- Delete files
- Move/rename files

The mode toggle is clearly visible in the chat input area with visual indicators.

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

1. Create markdown files in `AI Agent/User Instructions/`
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
- Stored in `AI Agent/Conversations/` as JSON files

## Configuration

### Settings

**API Keys**

- Add keys for Claude, Gemini, or OpenAI
- Keys stored locally in your vault
- Never transmitted except to respective AI providers

**Model Selection**

- Choose from 15+ supported models
- Switch anytime without conversation loss

**Search Configuration**

Fine-tune the balance between token usage and agent performance:

- **Search Results Limit** (default: 15)
  - Controls the maximum number of files returned in search operations
  - Lower values (5-10): Conserve tokens and reduce API costs
  - Higher values (20-30): Provide more context, potentially improving agent performance
  - Adjust based on your vault size and typical query complexity

- **Snippet Size Limit** (default: 300 characters)
  - Sets the character limit for contextual snippets in search results
  - Lower values (100-200): Minimize token usage for cost-conscious users
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
- Default: `AI Agent/User Instructions/`

## Development

### Prerequisites

- Node.js v16 or higher
- npm
- Obsidian (for testing)

### Setup

```bash
# Clone into your vault's plugin directory
cd /path/to/vault/.obsidian/plugins/
git clone https://github.com/yourusername/ai-agent-plugin.git
cd ai-agent-plugin

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

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/yourusername/ai-agent-plugin/issues)

## Acknowledgments

This plugin is built on the shoulders of many excellent projects:

**Platform & AI**
- Built for [Obsidian](https://obsidian.md)
- Powered by [Anthropic Claude](https://anthropic.com), [Google Gemini](https://deepmind.google/technologies/gemini/), and [OpenAI](https://openai.com)
- Official SDKs: [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript), [@google/genai](https://github.com/google/generative-ai-js)

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

**Utilities**
- [fuzzysort](https://github.com/farzher/fuzzysort) - Fuzzy search for reference autocomplete
- [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) - Token counting and usage tracking

**Development**
- [Vitest](https://vitest.dev/) - Fast unit testing framework
- [esbuild](https://esbuild.github.io/) - Lightning-fast bundler
- [TypeScript](https://www.typescriptlang.org/) - Type-safe development

**CSS**
- [Loader](https://uiverse.io/Li-Deheng/bright-firefox-37) - Animated streaming indicator adapted from original by Li-Deheng
- [Gradient Border](https://codepen.io/alphardex/pen/vYEYGzp) - Animated border adapted from original by alphardex

---

**Note**: This plugin requires API keys from AI providers. API usage is billed by the respective providers according to their pricing. Monitor your usage through the token counter and provider dashboards.
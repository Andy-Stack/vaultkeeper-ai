<p align="center">
	<img width="1280" height="640" alt="Vaultkeeper AI" src="https://github.com/user-attachments/assets/a4c4e96f-1a5e-4dbd-865b-d3c943611035" />
</p>

<h3 align="center">An AI assistant that actually knows your vault, and never changes a note without showing you first.</h3>

<p align="center">
Claude · Gemini · OpenAI · Mistral · or your own local model
</p>

<p align="center">
	<a href="https://obsidian.md/plugins?id=vaultkeeper-ai"><img src="https://img.shields.io/badge/Obsidian-Install%20plugin-7c3aed?logo=obsidian&logoColor=white" alt="Install in Obsidian"></a>
	<a href="https://github.com/andy-stack/vaultkeeper-ai/releases"><img src="https://img.shields.io/github/v/release/andy-stack/vaultkeeper-ai?color=7c3aed" alt="Latest release"></a>
	<a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
</p>

---

Vaultkeeper AI lives in your sidebar and works *with* your notes. Ask it questions about your vault, have it write new notes in the same style as your existing ones, reorganise folders, tag and link things, or plan out big multi-step changes. You stay in control: every edit is shown as a diff you can accept, reject, or send back with feedback, and anything it touches can be restored later.

<p align="center">
	<img width="800" alt="Asking Vaultkeeper AI to update DND campaign notes" src="https://github.com/user-attachments/assets/a1f44b3a-f8cf-463f-aa6e-f106aff47420" />
</p>

## Why Vaultkeeper?

- **It reads your vault, not just your prompt.** It searches, reads and lists your notes (including PDFs, Word, PowerPoint, Excel and images) so its answers and new notes fit what's already there.
- **Nothing changes behind your back.** Proposed edits appear in a side-by-side diff. Accept, reject, or tell it what to fix. Changed your mind later? Restore any file to its previous or original version.
- **Use the AI you want.** Bring a key for Claude, Gemini, OpenAI or Mistral, or run it fully offline against LM Studio, Ollama or vLLM.
- **Your private notes stay private.** Exclude folders or files with simple patterns and the AI can't see, search, or touch them.

## What people use it for

> *"Add a new item card to `/Campaign 1 Items` for 'Alchemy Jug'. Match the format used by `@Staff of Healing`."*

> *"Summarise this week's `/Daily Notes` and pull out any action items I haven't finished."*

> *"Find every note tagged `#project/alpha` and build a single overview page linking to them."*

> *"Go through my `/Inbox` folder, file each note into the right place, and add tags we already use."*

> *"Read the PDF I just dropped into `/Papers` and write a literature note in my usual template."*

## See it in action

### ✅ Review every change before it happens

When the AI wants to create, edit, move or delete something, you get a clear side-by-side diff. Accept it, reject it, or click **Suggest changes** to send it back with notes. Working on lots of files at once? Review them one by one or accept/reject the rest in bulk.

<p align="center">
	<img width="1142" height="771" alt="Diff viewer for a proposed new note" src="https://github.com/user-attachments/assets/7b569edf-9798-4aed-8538-0823425fdb68" />
</p>

### 🔗 Catches broken links before they land

Vaultkeeper checks proposed changes for continuity problems, like wikilinks pointing at notes that don't exist, and flags them right in the review screen so your vault doesn't fill up with dead links.

<p align="center">
	<img width="1142" height="777" alt="Continuity check flagging broken wikilinks in a proposed note" src="https://github.com/user-attachments/assets/b589a5c3-ca1d-499e-a9f8-86336870ba38" />
</p>

### ↩️ Undo anything

Every note the AI creates, edits or deletes (even PDFs and images) can be restored to its previous or original version, straight from the diff viewer.

<p align="center">
	<img width="552" height="161" alt="Tracked list of created and changed files" src="https://github.com/user-attachments/assets/a1997adc-3a4a-48d8-8d1b-2b94c78b5ba9" />
</p>

### 📋 Planning Mode for the big jobs

For larger tasks, a planning agent explores your vault first, asks clarifying questions if it needs to, and proposes a step-by-step plan. You approve it, reject it, or suggest changes. Then it works through the steps one at a time, with a supervising agent checking each result and adjusting the plan if something unexpected comes up.

<p align="center">
	<img width="571" height="163" alt="Planning mode execution" src="https://github.com/user-attachments/assets/8c7642a0-5b9f-4d88-be1f-429d902c2b56" />
</p>

### ⚡ Quick Actions on any note

Right-click (or use the editor toolbar button) for one-click helpers that work on your selection or the whole note:

| Action | What it does |
| --- | --- |
| **Proofread** | Fixes spelling, grammar and typos without changing your voice |
| **Beautify** | Improves flow and adds helpful Markdown formatting |
| **Apply template** | Restructures the note to fit a template you pick |
| **Apply links** | Wikilinks mentions of pages that already exist in your vault |
| **Apply tags** / **Suggest tags** | Tags the note using your existing tags (or suggests new ones) |
| **Generate frontmatter** | Infers aliases, tags, title, summary and created date |

### 🧠 It remembers how you work

Tell it your conventions once ("daily notes go in `/Journal`, use `#status/` tags") and it remembers across conversations. Memories live in a plain Markdown file you can read and edit yourself.

### 🌐 Web search and web pages

Flip on web search per message when you need current information, or let it read a URL you paste and turn it into a note.

### 📱 Works on mobile

Full functionality on phone and tablet, with touch-friendly approve/reject controls.

## Get started in 2 minutes

1. **Install:** In Obsidian, go to **Settings → Community plugins → Browse**, search for **Vaultkeeper AI**, then **Install** and **Enable**.
2. **Pick a model:** In the plugin settings, paste an API key from [Anthropic](https://console.anthropic.com/), [Google AI Studio](https://aistudio.google.com/), [OpenAI](https://platform.openai.com/) or [Mistral](https://console.mistral.ai/). Or choose **Local** and point it at your LM Studio / Ollama server (no key needed).
3. **Open the chat:** Click the Vaultkeeper icon in the left sidebar and start asking.

**Tip:** Type `@` to mention a file, `#` for a tag, or `/` for a folder, and the AI gets that context straight away.

It starts in **Read-only mode**, so it can explore but can't change anything. Switch to **Edit mode** (pencil icon) when you want it to make changes.

## Your data, your rules

- **You choose where your notes go.** With a cloud provider, the content you share goes directly from Obsidian to that provider, with no middleman server. With a local model, nothing leaves your machine.
- **API keys stay in your vault.**
- **Exclude anything sensitive.** Patterns like `journal/**` or `*.secret.md` make files completely invisible to the AI: they won't appear in searches and can't be read or modified.
- **Conversations are saved locally** in your vault.
- **Open source** and fully auditable.

**Cost:** The plugin is free. Cloud providers bill you directly for usage at their normal API rates. Local models cost nothing to run.

---

## Full guide

<details>
<summary><b>Chat modes</b></summary>

Switch modes at any time from the input toolbar.

**🔍 Read-only (default):** search vault content (text, PDFs, Office/ODF documents), read files including images and binary documents, and list folders. Cannot modify anything.

**✏️ Edit:** everything in read-only, plus create, edit, delete, move and rename notes and folders.

**📋 Planning:** a three-agent workflow for complex tasks:

1. **Planning agent** explores your vault (read-only), asks clarifying questions, and writes a step-by-step plan.
2. **You review the plan:** approve, reject, or suggest a change (it replans with your feedback rather than starting over).
3. **Execution agent** carries out each step.
4. **Orchestration agent** checks each result and decides to continue, adapt, replan, or stop. It passes what it learned on to later steps.

Progress shows in a collapsible panel above the chat, with pending / active / complete indicators.

</details>

<details>
<summary><b>Reviewing changes & skipping approval</b></summary>

In Edit and Planning mode, proposed changes open in the diff viewer where you can:

- See a side-by-side comparison
- **Accept** or **Reject** each file, or use **Accept remaining** / **Reject remaining**
- **Suggest changes** to send feedback before accepting
- See continuity warnings such as broken wikilinks
- Restore any previously changed file to its previous or original version

If you trust it with a task, you can toggle **skip approval** so changes are applied immediately. Turn it off any time to go back to reviewing every change.

</details>

<details>
<summary><b>Reference system</b></summary>

```
@meeting-notes What action items did we discuss?
#project/alpha Show me all notes about project alpha
/Daily Notes Summarise this week's daily notes
```

Autocomplete supports fuzzy search, arrow-key navigation, and shows full paths.

</details>

<details>
<summary><b>Custom instructions</b></summary>

Create Markdown files in `Vaultkeeper AI/User Instructions/`, then pick one from the **User Instructions** button in the chat. Great for switching between a research assistant, a writing partner, a D&D campaign scribe, and so on. See `EXAMPLE_INSTRUCTIONS.md` in your vault for a template. The folder location can be changed in settings.

</details>

<details>
<summary><b>Memory</b></summary>

Memories are stored in `Vaultkeeper AI/memories.md`. The AI reads it at the start of each conversation and can update it as you go.

- **Enable Memories:** turn memory on or off
- **Read-only Memories:** the AI can use memories but not change them, so you manage the file yourself

</details>

<details>
<summary><b>Web search & web viewer</b></summary>

- **Web search:** toggle per message with the globe button. Works with Claude, Gemini, OpenAI and Mistral (not local models). Can be disabled entirely in settings.
- **Web viewer:** lets the AI fetch and read a web page. Can be toggled in settings.

</details>

<details>
<summary><b>Local models</b></summary>

Run entirely against a self-hosted, OpenAI-compatible server (LM Studio, Ollama, vLLM, and others).

1. Choose **Local** from the provider dropdown (under "Self Hosted")
2. **Local URL:** your chat completions endpoint, e.g. `http://localhost:1234/v1/chat/completions` (LM Studio's default)
3. **API key:** only if your server requires one
4. **Model:** the model name exactly as your server expects it
5. Optionally set separate **Planning Model** and **Quick Action Model** names

**Supported:** streaming, tool calling, Quick Actions, image attachments, PDF and Office attachments (PDFs are rasterised to images), text file attachments.

**Limitations:** no web search. Some local models need their chat template adjusted to handle multi-turn tool calling reliably; check your server's docs if tool use misbehaves.

</details>

<details>
<summary><b>All settings</b></summary>

- **Provider & model:** 15+ cloud models or your own local model. Switch any time without losing the conversation.
- **Planning model:** use a stronger model for planning and a faster, cheaper one for execution.
- **Quick Actions:** toggle the context menu entry and the editor toolbar button independently.
- **Search results limit** (default 15): lower is faster and cheaper, higher gives more context.
- **Snippet size limit** (default 300 characters): how much of each search hit the AI sees.
- **File exclusions:** glob patterns, e.g. `private/**`, `*.secret.md`, `journal/personal/**`.
- **Memory**, **web search**, **web viewer** toggles.
- **Custom instructions path** (default `Vaultkeeper AI/User Instructions/`).

</details>

<details>
<summary><b>Manual installation</b></summary>

1. Download the latest release from the [Releases page](https://github.com/andy-stack/vaultkeeper-ai/releases)
2. Extract into `.obsidian/plugins/vaultkeeper-ai/` in your vault
3. Reload Obsidian and enable **Vaultkeeper AI** under Community plugins

</details>

<details>
<summary><b>Development</b></summary>

Requires Node.js 16+, npm, and Obsidian.

```bash
cd /path/to/vault/.obsidian/plugins/
git clone https://github.com/andy-stack/vaultkeeper-ai.git
cd vaultkeeper-ai
npm install
npm run dev     # watch mode
npm run build   # production build
npm test        # Vitest
```

</details>

## Feedback & support

Found a bug or have an idea? [Open an issue](https://github.com/andy-stack/vaultkeeper-ai/issues). I read all of them. Pull requests are currently closed (see [CONTRIBUTING.md](CONTRIBUTING.md)).

**If Vaultkeeper saves you time, a ⭐ on GitHub really helps other people find it.**

<details>
<summary><b>Acknowledgments</b></summary>

- **Platform & AI:** [Obsidian](https://obsidian.md), [Anthropic Claude](https://anthropic.com), [Google Gemini](https://deepmind.google/technologies/gemini/), [OpenAI](https://openai.com), [Mistral AI](https://mistral.ai); SDKs [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript), [@google/genai](https://github.com/google/generative-ai-js), [openai](https://github.com/openai/openai-node)
- **Documents:** [fflate](https://github.com/101arrowz/fflate), Obsidian's bundled [PDF.js](https://mozilla.github.io/pdf.js/)
- **UI:** [Svelte](https://svelte.dev), [KaTeX](https://katex.org/), [Shiki](https://shiki.style/)
- **Diffs:** [diff](https://github.com/kpdecker/jsdiff), [diff2html](https://github.com/rtfpessoa/diff2html)
- **Utilities:** [fuzzysort](https://github.com/farzher/fuzzysort), [Zod](https://github.com/colinhacks/zod), [regex-parser](https://github.com/IonicaBizau/regex-parser.js)
- **Development:** [Vitest](https://vitest.dev/), [esbuild](https://esbuild.github.io/), [TypeScript](https://www.typescriptlang.org/)
- **CSS:** [Loader](https://uiverse.io/Li-Deheng/bright-firefox-37) by Li-Deheng, [Gradient Spinner](https://codepen.io/AlexWarnes/pen/jXYYKL) by AlexWarnes

</details>

## License

[MIT](LICENSE)

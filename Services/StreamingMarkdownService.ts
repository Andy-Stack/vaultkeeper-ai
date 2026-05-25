import { Component, MarkdownRenderer } from "obsidian";
import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";

interface RenderState {
    frozenContainer: HTMLElement;
    liveContainer: HTMLElement;
    frozenUpTo: number;
    frozenText: string;
    component: Component;
}

export class StreamingMarkdownService {
    private readonly plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    private readonly states = new WeakMap<HTMLElement, RenderState>();

    public async render(markdown: string, container: HTMLElement, isFinal: boolean = false): Promise<void> {
        if (isFinal) {
            const existing = this.states.get(container);
            if (existing) {
                existing.component.unload();
                this.states.delete(container);
            }
            const component = new Component();
            component.load();
            container.empty();
            await MarkdownRenderer.render(this.plugin.app, markdown, container, "", component);
            component.unload();
            return;
        }

        const state = this.getOrCreateState(container);
        const splitPoint = this.findSplitPoint(markdown);
        const frozenCandidate = markdown.slice(0, splitPoint);
        const liveTail = markdown.slice(splitPoint);

        if (frozenCandidate.length > state.frozenUpTo) {
            const newSlice = frozenCandidate.slice(state.frozenUpTo);
            const tempDiv = activeDocument.createElement("div");
            await MarkdownRenderer.render(this.plugin.app, newSlice, tempDiv, "", state.component);
            while (tempDiv.firstChild) {
                state.frozenContainer.appendChild(tempDiv.firstChild);
            }
            state.frozenUpTo = frozenCandidate.length;
            state.frozenText = frozenCandidate;
        }

        state.liveContainer.empty();
        if (liveTail.trim()) {
            await MarkdownRenderer.render(this.plugin.app, liveTail, state.liveContainer, "", state.component);
        }
    }

    private getOrCreateState(container: HTMLElement): RenderState {
        if (this.states.has(container)) {
            return this.states.get(container)!;
        }

        container.empty();
        const frozenContainer = activeDocument.createElement("div");
        const liveContainer = activeDocument.createElement("div");
        container.appendChild(frozenContainer);
        container.appendChild(liveContainer);

        const component = new Component();
        component.load();
        const state: RenderState = { frozenContainer, liveContainer, frozenUpTo: 0, frozenText: "", component };
        this.states.set(container, state);
        return state;
    }

    // Returns the char index at which the "live tail" begins.
    // Everything before this index is safe to freeze (complete blocks).
    private findSplitPoint(text: string): number {
        const lastDoubleNewline = text.lastIndexOf("\n\n");
        if (lastDoubleNewline === -1) {
            return 0;
        }

        const candidate = text.slice(0, lastDoubleNewline);

        // Count unmatched opening code fences in the candidate.
        // If odd, there's an open fence — walk back to before it.
        const fenceRegex = /^```/gm;
        let fenceCount = 0;
        let lastOpenFenceIndex = -1;

        for (const match of candidate.matchAll(fenceRegex)) {
            fenceCount++;
            if (fenceCount % 2 === 1) {
                lastOpenFenceIndex = match.index!;
            }
        }

        if (fenceCount % 2 === 1) {
            // Odd number of fences — open code block, back up to before it
            return lastOpenFenceIndex > 0 ? lastOpenFenceIndex : 0;
        }

        return lastDoubleNewline;
    }
}
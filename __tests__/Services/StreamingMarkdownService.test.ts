import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StreamingMarkdownService } from '../../Services/StreamingMarkdownService';
import * as DependencyService from '../../Services/DependencyService';
import { Services } from '../../Services/Services';

const mockPlugin = { app: {} };

vi.mock('obsidian', async (importOriginal) => {
    const original = await importOriginal<typeof import('obsidian')>();
    return {
        ...original,
        MarkdownRenderer: {
            render: vi.fn(async (_app: unknown, markdown: string, container: HTMLElement) => {
                const blocks = markdown.split(/\n{2,}/).filter(b => b.length > 0);
                container.innerHTML = blocks.map(block => {
                    if (block.startsWith('# ')) return `<h1>${block.slice(2)}</h1>`;
                    if (block.startsWith('```')) {
                        const lines = block.split('\n');
                        const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
                        return `<pre><code>${code}</code></pre>`;
                    }
                    return `<p>${block}</p>`;
                }).join('');
            })
        }
    };
});

describe('StreamingMarkdownService', () => {
    let service: StreamingMarkdownService;

    beforeEach(() => {
        vi.spyOn(DependencyService, 'Resolve').mockImplementation((serviceId: symbol) => {
            if (serviceId === Services.VaultkeeperAIPlugin) return mockPlugin as any;
            throw new Error(`Unexpected service request: ${serviceId.toString()}`);
        });
        service = new StreamingMarkdownService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // --- Existing contract (isFinal=true behaviour matches old render) ---

    it('clears container and renders markdown when final', async () => {
        const container = document.createElement('div');
        container.innerHTML = '<span>old</span>';
        await service.render('hello world', container, true);
        expect(container.innerHTML).not.toContain('old');
        expect(container.innerHTML).toContain('hello world');
    });

    it('replaces previous content on each final call', async () => {
        const container = document.createElement('div');
        await service.render('first', container, true);
        await service.render('first\n\nsecond', container, true);
        const paragraphs = container.querySelectorAll('p');
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[0].textContent).toBe('first');
        expect(paragraphs[1].textContent).toBe('second');
    });

    // --- Incremental rendering ---

    it('renders single incomplete block in live tail only', async () => {
        const container = document.createElement('div');
        // No \n\n yet — everything is live tail
        await service.render('Hello world', container);
        expect(container.textContent).toContain('Hello world');
    });

    it('freezes completed blocks and only re-renders live tail', async () => {
        const { MarkdownRenderer } = await import('obsidian');
        const renderSpy = vi.mocked(MarkdownRenderer.render);

        const container = document.createElement('div');

        // First chunk: one complete paragraph + live tail
        await service.render('First paragraph\n\nLive tail', container);
        const callsAfterFirst = renderSpy.mock.calls.length;

        // Second chunk: same frozen block, live tail grows
        await service.render('First paragraph\n\nLive tail continues', container);
        const callsAfterSecond = renderSpy.mock.calls.length;

        // The frozen block should NOT have been re-rendered (only live tail re-renders)
        // So calls added == 1 (just the live tail), not 2
        expect(callsAfterSecond - callsAfterFirst).toBe(1);
        expect(container.textContent).toContain('First paragraph');
        expect(container.textContent).toContain('Live tail continues');
    });

    it('does not split an open code fence into frozen content', async () => {
        const container = document.createElement('div');

        // The \n\n is inside an open code block — should NOT freeze anything
        await service.render('```js\nconst x = 1;\n\nconst y = 2;', container);

        // Split point should be 0 (nothing frozen), all in live tail
        const children = Array.from(container.children);
        const frozenDiv = children[0] as HTMLElement;
        expect(frozenDiv.innerHTML).toBe('');
    });

    it('freezes content before a code block and keeps open fence in live tail', async () => {
        const container = document.createElement('div');
        const text = 'Intro paragraph\n\n```js\nconst x = 1;';
        await service.render(text, container);

        // "Intro paragraph" should be frozen, code block stays in live tail
        const children = Array.from(container.children);
        const frozenDiv = children[0] as HTMLElement;
        const liveDiv = children[1] as HTMLElement;
        expect(frozenDiv.textContent).toContain('Intro paragraph');
        expect(liveDiv.textContent).toContain('const x = 1;');
    });

    it('freezes a complete code block once closing fence arrives', async () => {
        const { MarkdownRenderer } = await import('obsidian');
        const renderSpy = vi.mocked(MarkdownRenderer.render);

        const container = document.createElement('div');

        // Open fence — nothing frozen yet
        await service.render('Before\n\n```js\ncode here', container);
        const callsWithOpenFence = renderSpy.mock.calls.length;

        // Close the fence with a following \n\n — now the whole block is freezable
        await service.render('Before\n\n```js\ncode here\n```\n\nAfter content', container);

        expect(container.textContent).toContain('Before');
        expect(container.textContent).toContain('code here');
        expect(container.textContent).toContain('After content');
        // Render was called again (live tail updated)
        expect(renderSpy.mock.calls.length).toBeGreaterThan(callsWithOpenFence);
    });

    it('isFinal=true resets state and does a clean full render', async () => {
        const container = document.createElement('div');

        // Simulate streaming
        await service.render('Paragraph one\n\nLive', container);
        // Finalize
        await service.render('Paragraph one\n\nLive tail complete', container, true);

        // After finalize, container should have clean output (no frozen/live divs)
        const paragraphs = container.querySelectorAll('p');
        expect(paragraphs.length).toBeGreaterThanOrEqual(1);
        expect(container.textContent).toContain('Paragraph one');
        expect(container.textContent).toContain('Live tail complete');
    });
});

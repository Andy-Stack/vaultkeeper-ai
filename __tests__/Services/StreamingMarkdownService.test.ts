import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StreamingMarkdownService } from '../../Services/StreamingMarkdownService';
import * as DependencyService from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import type { FileSystemService } from '../../Services/FileSystemService';
import type { HTMLService } from '../../Services/HTMLService';

describe('StreamingMarkdownService', () => {
	let service: StreamingMarkdownService;
	let mockFileSystemService: Partial<FileSystemService>;
	let mockHTMLService: Partial<HTMLService>;

	beforeEach(() => {
		// Mock FileSystemService to avoid dependency injection issues
		mockFileSystemService = {
			getVaultFileListForMarkDown: vi.fn().mockReturnValue(['file1', 'file2', 'folder/file3'])
		};

		// Mock HTMLService
		mockHTMLService = {
			clearElement: vi.fn((element: HTMLElement) => {
				while (element.firstChild) {
					element.removeChild(element.firstChild);
				}
			}),
			setHTMLContent: vi.fn((container: HTMLElement, htmlString: string) => {
				// Clear the container
				while (container.firstChild) {
					container.removeChild(container.firstChild);
				}
				// Parse and append HTML
				const parser = new DOMParser();
				const doc = parser.parseFromString(htmlString, 'text/html');
				while (doc.body.firstChild) {
					container.appendChild(doc.body.firstChild);
				}
			}),
			parseHTMLString: vi.fn(),
			parseHTMLToContainer: vi.fn()
		};

		// Mock DependencyService.Resolve to return our mocks
		vi.spyOn(DependencyService, 'Resolve').mockImplementation((serviceId: symbol) => {
			if (serviceId === Services.FileSystemService) {
				return mockFileSystemService as FileSystemService;
			}
			if (serviceId === Services.HTMLService) {
				return mockHTMLService as HTMLService;
			}
			throw new Error(`Unexpected service request: ${serviceId.toString()}`);
		});

		service = new StreamingMarkdownService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('formatText', () => {
		it('should convert basic markdown to HTML', () => {
			const markdown = '# Hello World\n\nThis is a test.';
			const result = service.formatText(markdown);

			expect(result).toContain('<h1>');
			expect(result).toContain('Hello World');
			expect(result).toContain('<p>');
			expect(result).toContain('This is a test.');
		});

		it('should handle bold text', () => {
			const markdown = '**bold text**';
			const result = service.formatText(markdown);

			expect(result).toContain('<strong>');
			expect(result).toContain('bold text');
		});

		it('should handle italic text', () => {
			const markdown = '*italic text*';
			const result = service.formatText(markdown);

			expect(result).toContain('<em>');
			expect(result).toContain('italic text');
		});

		it('should handle code blocks', () => {
			const markdown = '```javascript\nconst x = 1;\n```';
			const result = service.formatText(markdown);

			expect(result).toContain('<code');
			// rehype-highlight adds span tags for syntax highlighting
			expect(result).toContain('const');
			expect(result).toContain('x');
		});

		it('should handle inline code', () => {
			const markdown = 'Use `console.log()` to debug.';
			const result = service.formatText(markdown);

			expect(result).toContain('<code>');
			expect(result).toContain('console.log()');
		});

		it('should handle lists', () => {
			const markdown = '- Item 1\n- Item 2\n- Item 3';
			const result = service.formatText(markdown);

			expect(result).toContain('<ul>');
			expect(result).toContain('<li>');
			expect(result).toContain('Item 1');
			expect(result).toContain('Item 2');
		});

		it('should handle numbered lists', () => {
			const markdown = '1. First\n2. Second\n3. Third';
			const result = service.formatText(markdown);

			expect(result).toContain('<ol>');
			expect(result).toContain('<li>');
			expect(result).toContain('First');
		});

		it('should handle links', () => {
			const markdown = '[Google](https://google.com)';
			const result = service.formatText(markdown);

			expect(result).toContain('<a');
			expect(result).toContain('href="https://google.com"');
			expect(result).toContain('Google');
		});

		it('should handle LaTeX math with double dollar signs', () => {
			const markdown = '$$E = mc^2$$';
			const result = service.formatText(markdown);

			// rehype-katex converts LaTeX to HTML with math markup
			expect(result).toContain('E');
			expect(result).toContain('mc');
		});

		it('should handle inline LaTeX with parentheses notation', () => {
			const markdown = 'The formula \\(x^2 + y^2 = z^2\\) is correct.';
			const result = service.formatText(markdown);

			expect(result).toContain('formula');
			expect(result).toContain('correct');
		});

		it('should handle empty string', () => {
			const result = service.formatText('');
			expect(result).toBeDefined();
			expect(typeof result).toBe('string');
		});

		it('should handle plain text without markdown', () => {
			const text = 'Just plain text';
			const result = service.formatText(text);

			expect(result).toContain('Just plain text');
			expect(result).toContain('<p>');
		});

		it('should return fallback HTML on processing error', () => {
			// Mock processor to throw error
			const originalProcessor = (service as any).processor;
			(service as any).processor = {
				processSync: vi.fn().mockImplementation(() => {
					throw new Error('Processing failed');
				})
			};

			const result = service.formatText('test');

			// Should use fallback HTML generation
			expect(result).toBeDefined();
			expect(result).toContain('test');

			// Restore processor
			(service as any).processor = originalProcessor;
		});

		it('should handle special HTML characters in fallback', () => {
			// Force fallback by making processor fail
			const originalProcessor = (service as any).processor;
			(service as any).processor = {
				processSync: vi.fn().mockImplementation(() => {
					throw new Error('Processing failed');
				})
			};

			const result = service.formatText('<script>alert("xss")</script>');

			// Should escape HTML in fallback
			expect(result).not.toContain('<script>');
			expect(result).toContain('&lt;');
			expect(result).toContain('&gt;');

			// Restore processor
			(service as any).processor = originalProcessor;
		});
	});

	describe('preprocessContent', () => {
		it('should normalize line endings', () => {
			const content = 'Line 1\r\nLine 2\rLine 3\n';
			const result = (service as any).preprocessContent(content);

			// All line endings should be normalized to \n
			expect(result).not.toContain('\r');
			expect(result).toContain('Line 1\nLine 2\nLine 3');
		});

		it('should convert LaTeX bracket notation to dollar signs', () => {
			const content = 'Formula: \\[x^2 + y^2 = z^2\\]';
			const result = (service as any).preprocessContent(content);

			expect(result).toContain('$$');
			expect(result).toContain('x^2 + y^2 = z^2');
		});

		it('should convert LaTeX parentheses to inline math', () => {
			const content = 'Inline \\(a + b = c\\) formula';
			const result = (service as any).preprocessContent(content);

			// Converts \(...\) to $...$ (single dollar, not double)
			expect(result).toContain('$a + b = c$');
		});

		it('should add blank lines before headers', () => {
			const content = 'Paragraph\n# Header';
			const result = (service as any).preprocessContent(content);

			expect(result).toContain('Paragraph\n\n# Header');
		});

		it('should not add blank lines before headers at start', () => {
			const content = '# Header at start';
			const result = (service as any).preprocessContent(content);

			// Should not have extra blank line at the start
			expect(result.startsWith('# Header')).toBe(true);
		});

		it('should collapse excessive newlines', () => {
			const content = 'Line 1\n\n\n\n\nLine 2';
			const result = (service as any).preprocessContent(content);

			// Should reduce to max 3 newlines
			expect(result).not.toContain('\n\n\n\n');
			expect(result).toContain('Line 1');
			expect(result).toContain('Line 2');
		});

		it('should normalize list formatting', () => {
			const content = '-  Item with extra spaces\n*   Another item';
			const result = (service as any).preprocessContent(content);

			// Should normalize to single space after bullet
			expect(result).toContain('- Item with extra spaces');
			expect(result).toContain('* Another item');
		});

		it('should format task list checkboxes', () => {
			const content = '-  [x]  Done\n- [ ]Not done';
			const result = (service as any).preprocessContent(content);

			// Should normalize task list format
			expect(result).toContain('- [x]');
			expect(result).toContain('- [ ]');
		});
	});

	describe('getFallbackHTML', () => {
		it('should escape HTML entities', () => {
			const text = '<div>Test & "quotes"</div>';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('&lt;div&gt;');
			expect(result).toContain('&amp;');
			expect(result).toContain('&gt;');
		});

		it('should convert code blocks', () => {
			const text = '```\ncode here\n```';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('<pre>');
			expect(result).toContain('<code>');
			expect(result).toContain('code here');
		});

		it('should handle unordered lists', () => {
			const text = '* Item 1\n* Item 2';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('<ul>');
			expect(result).toContain('<li>');
			expect(result).toContain('Item 1');
		});

		it('should close unclosed code blocks', () => {
			const text = '```\ncode\nmore code';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('</code></pre>');
		});

		it('should close unclosed lists', () => {
			const text = '* Item 1\n* Item 2';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('</ul>');
		});

		it('should convert bold markdown', () => {
			const text = '**bold text**';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('<strong>');
			expect(result).toContain('bold text');
		});

		it('should convert italic markdown', () => {
			const text = '*italic text*';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('<em>');
			expect(result).toContain('italic text');
		});

		it('should convert inline code', () => {
			const text = 'Use `code` here';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('<code>');
			expect(result).toContain('code');
		});

		it('should wrap text in paragraphs', () => {
			const text = 'Line 1\nLine 2';
			const result = (service as any).getFallbackHTML(text);

			expect(result).toContain('<p>');
		});

		it('should not wrap empty lines in paragraphs', () => {
			const text = 'Line 1\n\nLine 2';
			const result = (service as any).getFallbackHTML(text);

			const paragraphCount = (result.match(/<p>/g) || []).length;
			expect(paragraphCount).toBe(2); // One for each non-empty line
		});
	});

	describe('streaming - initializeStream', () => {
		it('should create streaming state for message', () => {
			const container = document.createElement('div');
			container.innerHTML = '<p>Old content</p>';

			service.initializeStream('msg-1', container);

			expect(container.innerHTML).toBe('');

			// Verify state exists internally
			const state = (service as any).streamingStates.get('msg-1');
			expect(state).toBeDefined();
			expect(state.buffer).toBe('');
			expect(state.isComplete).toBe(false);
		});

		it('should clear existing content in container', () => {
			const container = document.createElement('div');
			container.innerHTML = '<p>Existing content</p>';

			service.initializeStream('msg-1', container);

			expect(container.innerHTML).toBe('');
		});

		it('should handle multiple stream initializations', () => {
			const container1 = document.createElement('div');
			const container2 = document.createElement('div');

			service.initializeStream('msg-1', container1);
			service.initializeStream('msg-2', container2);

			const states = (service as any).streamingStates;
			expect(states.get('msg-1')).toBeDefined();
			expect(states.get('msg-2')).toBeDefined();
		});
	});

	describe('streaming - streamChunk', () => {
		it('should update buffer with new content', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.streamChunk('msg-1', '# Title');

			const state = (service as any).streamingStates.get('msg-1');
			expect(state.buffer).toBe('# Title');
		});

		it('should render content after debounce', async () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.streamChunk('msg-1', '**bold**');

			// Wait for debounce (50ms + buffer)
			await new Promise(resolve => setTimeout(resolve, 100));

			expect(container.innerHTML).toContain('bold');
		});

		it('should handle multiple chunks for same message', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.streamChunk('msg-1', 'Part 1');
			service.streamChunk('msg-1', 'Part 1\nPart 2');
			service.streamChunk('msg-1', 'Part 1\nPart 2\nPart 3');

			const state = (service as any).streamingStates.get('msg-1');
			expect(state.buffer).toBe('Part 1\nPart 2\nPart 3');
		});

		it('should do nothing if message not initialized', () => {
			expect(() => {
				service.streamChunk('non-existent', 'test');
			}).not.toThrow();
		});

		it('should do nothing if stream already complete', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			const state = (service as any).streamingStates.get('msg-1');
			state.isComplete = true;

			service.streamChunk('msg-1', 'new content');

			// Buffer should not update
			expect(state.buffer).toBe('');
		});

		it('should refresh vault file list on each chunk', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.streamChunk('msg-1', 'test');

			expect(mockFileSystemService.getVaultFileListForMarkDown).toHaveBeenCalled();
		});
	});

	describe('streaming - finalizeStream', () => {
		it('should render final content immediately', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.finalizeStream('msg-1', '# Final Content');

			expect(container.innerHTML).toContain('Final Content');
		});

		it('should mark stream as complete', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.finalizeStream('msg-1', 'Done');

			const state = (service as any).streamingStates.get('msg-1');
			// State should be deleted after finalization
			expect(state).toBeUndefined();
		});

		it('should cleanup streaming state', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.finalizeStream('msg-1', 'Done');

			const states = (service as any).streamingStates;
			expect(states.has('msg-1')).toBe(false);
		});

		it('should cleanup render timeout', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.streamChunk('msg-1', 'test');
			service.finalizeStream('msg-1', 'Done');

			const timeouts = (service as any).renderTimeouts;
			expect(timeouts.has('msg-1')).toBe(false);
		});

		it('should do nothing if message not initialized', () => {
			expect(() => {
				service.finalizeStream('non-existent', 'test');
			}).not.toThrow();
		});

		it('should handle finalization with empty content', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.finalizeStream('msg-1', '');

			expect(container.innerHTML).toBeDefined();
		});
	});

	describe('streaming - debounce behavior', () => {
		it('should debounce rapid updates', async () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			// Send multiple rapid updates
			service.streamChunk('msg-1', 'v1');
			service.streamChunk('msg-1', 'v2');
			service.streamChunk('msg-1', 'v3');

			// Wait for debounce
			await new Promise(resolve => setTimeout(resolve, 100));

			// Should render final version
			expect(container.innerHTML).toContain('v3');
		});

		it('should clear pending timeout on new chunk', () => {
			const container = document.createElement('div');
			service.initializeStream('msg-1', container);

			service.streamChunk('msg-1', 'first');
			const timeouts = (service as any).renderTimeouts;
			const firstTimeout = timeouts.get('msg-1');

			service.streamChunk('msg-1', 'second');
			const secondTimeout = timeouts.get('msg-1');

			// Should have different timeout IDs
			expect(firstTimeout).not.toBe(secondTimeout);
		});
	});

	describe('constructor', () => {
		it('should initialize unified processor', () => {
			const testService = new StreamingMarkdownService();

			expect((testService as any).processor).toBeDefined();
			expect((testService as any).processor).not.toBeNull();
		});

		it('should cache permalink list from file system', () => {
			const testService = new StreamingMarkdownService();

			expect(mockFileSystemService.getVaultFileListForMarkDown).toHaveBeenCalled();
			expect((testService as any).cachedPermaLinks).toBeDefined();
			expect((testService as any).cachedPermaLinks).toEqual(['file1', 'file2', 'folder/file3']);
		});

		it('should initialize empty streaming states', () => {
			const testService = new StreamingMarkdownService();

			const states = (testService as any).streamingStates;
			expect(states).toBeInstanceOf(Map);
			expect(states.size).toBe(0);
		});
	});
});

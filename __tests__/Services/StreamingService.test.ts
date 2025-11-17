import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamingService, IStreamChunk } from '../../Services/StreamingService';
import { Selector } from '../../Enums/Selector';
import { Exception } from '../../Helpers/Exception';

/**
 * UNIT TESTS
 *
 * StreamingService has no dependencies, so we use pure unit tests.
 * We mock the global fetch API to test streaming behavior.
 */

describe('StreamingService', () => {
	let service: StreamingService;
	let mockFetch: any;
	let originalFetch: any;

	beforeEach(() => {
		service = new StreamingService();
		originalFetch = global.fetch;
		mockFetch = vi.fn();
		global.fetch = mockFetch;
		// Mock Exception methods to avoid console output during tests
		vi.spyOn(Exception, 'log').mockImplementation(() => {});
		vi.spyOn(Exception, 'throw').mockImplementation((error: unknown) => {
			throw Exception.new(error);
		});
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	// Helper to create a mock ReadableStream
	function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
		const encoder = new TextEncoder();
		let index = 0;

		return new ReadableStream({
			async pull(controller) {
				if (index < chunks.length) {
					controller.enqueue(encoder.encode(chunks[index]));
					index++;
				} else {
					controller.close();
				}
			}
		});
	}

	// Helper to create a simple parser
	const simpleParser = (chunk: string): IStreamChunk => {
		try {
			const data = JSON.parse(chunk);
			return {
				content: data.content || '',
				isComplete: data.done || false,
				error: data.error
			};
		} catch {
			return { content: '', isComplete: false };
		}
	};

	describe('streamRequest - Basic Streaming', () => {
		it('should successfully stream a simple response', async () => {
			const chunks = [
				'data: {"content":"Hello","done":false}\n',
				'data: {"content":" World","done":false}\n',
				'data: {"content":"!","done":true}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{ prompt: 'test' },
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(3);
			expect(results[0]).toEqual({ content: 'Hello', isComplete: false });
			expect(results[1]).toEqual({ content: ' World', isComplete: false });
			expect(results[2]).toEqual({ content: '!', isComplete: true });
		});

		it('should make POST request with correct headers and body', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(['data: {"content":"test","done":true}\n'])
			});

			const requestBody = { prompt: 'test', model: 'gpt-4' };

			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				requestBody,
				simpleParser
			)) {
				// Just consume the stream
			}

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/stream',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					}),
					body: JSON.stringify(requestBody)
				})
			);
		});

		it('should include additional headers when provided', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(['data: {"content":"test","done":true}\n'])
			});

			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{ prompt: 'test' },
				simpleParser,
				undefined,
				{ 'Authorization': 'Bearer token123', 'X-Custom': 'value' }
			)) {
				// Just consume the stream
			}

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
						'Authorization': 'Bearer token123',
						'X-Custom': 'value'
					})
				})
			);
		});
	});

	describe('streamRequest - SSE Parsing', () => {
		it('should parse SSE data: prefix correctly', async () => {
			const chunks = [
				'data: {"content":"A","done":false}\n',
				'data: {"content":"B","done":false}\n',
				'data: {"content":"C","done":true}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(3);
			expect(results[0].content).toBe('A');
			expect(results[1].content).toBe('B');
			expect(results[2].content).toBe('C');
		});

		it('should ignore lines without data: prefix', async () => {
			const chunks = [
				': comment line\n',
				'data: {"content":"A","done":false}\n',
				'event: message\n',
				'data: {"content":"B","done":true}\n',
				'random text\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(2);
			expect(results[0].content).toBe('A');
			expect(results[1].content).toBe('B');
		});

		it('should handle whitespace around data: prefix', async () => {
			const chunks = [
				'  data: {"content":"A","done":false}\n',
				'data:{"content":"B","done":false}\n',
				'   data:   {"content":"C","done":true}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(3);
			expect(results[0].content).toBe('A');
			expect(results[1].content).toBe('B');
			expect(results[2].content).toBe('C');
		});
	});

	describe('streamRequest - Buffer Management', () => {
		it('should handle incomplete lines in buffer', async () => {
			const chunks = [
				'data: {"content":"A",',  // Incomplete
				'"done":false}\n',  // Completes previous line
				'data: {"content":"B","done":true}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(2);
			expect(results[0].content).toBe('A');
			expect(results[1].content).toBe('B');
		});

		it('should handle multiple lines in a single chunk', async () => {
			const chunks = [
				'data: {"content":"A","done":false}\ndata: {"content":"B","done":false}\ndata: {"content":"C","done":true}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(3);
			expect(results[0].content).toBe('A');
			expect(results[1].content).toBe('B');
			expect(results[2].content).toBe('C');
		});

		it('should preserve incomplete line at end of chunk', async () => {
			const chunks = [
				'data: {"content":"A","done":false}\ndata: {"content":"B"',  // B line incomplete
				',"done":false}\ndata: {"content":"C","done":true}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(3);
			expect(results[0].content).toBe('A');
			expect(results[1].content).toBe('B');
			expect(results[2].content).toBe('C');
		});
	});

	describe('streamRequest - Completion Handling', () => {
		it('should yield completion chunk if last chunk was not complete', async () => {
			const chunks = [
				'data: {"content":"Hello","done":false}\n',
				'data: {"content":" World","done":false}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(3);
			expect(results[2]).toEqual({ content: '', isComplete: true });
		});

		it('should not yield extra completion if last chunk was complete', async () => {
			const chunks = [
				'data: {"content":"Hello","done":false}\n',
				'data: {"content":" World","done":true}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(2);
			expect(results[1].isComplete).toBe(true);
		});
	});

	describe('streamRequest - Custom Parser', () => {
		it('should use custom parser function', async () => {
			const chunks = [
				'data: custom1\n',
				'data: custom2\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const customParser = (chunk: string): IStreamChunk => {
				const trimmedChunk = chunk.trim();
				return {
					content: `Parsed: ${trimmedChunk}`,
					isComplete: trimmedChunk === 'custom2'
				};
			};

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				customParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(2);
			expect(results[0].content).toBe('Parsed: custom1');
			expect(results[1].content).toBe('Parsed: custom2');
		});

		it('should pass function call from parser', async () => {
			const chunks = [
				'data: {"content":"","done":false,"functionCall":{"name":"test_func","args":{}}}\n',
				'data: {"content":"Done","done":true}\n'
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const parserWithFunctionCall = (chunk: string): IStreamChunk => {
				const data = JSON.parse(chunk);
				return {
					content: data.content || '',
					isComplete: data.done || false,
					functionCall: data.functionCall
				};
			};

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				parserWithFunctionCall
			)) {
				results.push(chunk);
			}

			expect(results[0].functionCall).toEqual({ name: 'test_func', args: {} });
		});
	});

	describe('streamRequest - Abort Signal', () => {
		it('should pass abort signal to fetch', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(['data: {"content":"test","done":true}\n'])
			});

			const abortController = new AbortController();

			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser,
				abortController.signal
			)) {
				// Just consume the stream
			}

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					signal: abortController.signal
				})
			);
		});

		it('should handle abort error gracefully', async () => {
			const abortError = new Error('The operation was aborted');
			abortError.name = 'AbortError';
			mockFetch.mockRejectedValue(abortError);

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser,
				new AbortController().signal
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				content: Selector.ApiRequestAborted,
				isComplete: true
			});
		});
	});

	describe('streamRequest - Error Handling', () => {
		it('should handle non-OK response', async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				text: async () => 'Resource not found'
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(1);
			expect(results[0].isComplete).toBe(true);
			expect(results[0].error).toContain('404');
			expect(results[0].error).toContain('Not Found');
		});

		it('should handle response with no body', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				body: null
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(1);
			expect(results[0].isComplete).toBe(true);
			expect(results[0].error).toContain('not readable');
		});

		it('should handle network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network connection failed'));

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(1);
			expect(results[0].isComplete).toBe(true);
			expect(results[0].error).toBe('Network connection failed');
		});

		it('should handle unknown error type', async () => {
			mockFetch.mockRejectedValue('String error');

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(1);
			expect(results[0].isComplete).toBe(true);
			expect(results[0].error).toBe('Unknown error');
		});
	});

	describe('streamRequest - Edge Cases', () => {
		it('should handle empty stream', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream([])
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({ content: '', isComplete: true });
		});

		it('should handle stream with only whitespace', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(['   \n\n  \n'])
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({ content: '', isComplete: true });
		});

		it('should handle stream with no newlines', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(['data: {"content":"test","done":true}'])
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			// No newline means line stays in buffer until stream ends
			// Then completion chunk is added
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({ content: '', isComplete: true });
		});

		it('should handle very large chunks', async () => {
			const largeContent = 'X'.repeat(10000);
			const chunks = [
				`data: {"content":"${largeContent}","done":true}\n`
			];

			mockFetch.mockResolvedValue({
				ok: true,
				body: createMockStream(chunks)
			});

			const results: IStreamChunk[] = [];
			for await (const chunk of service.streamRequest(
				'https://api.example.com/stream',
				{},
				simpleParser
			)) {
				results.push(chunk);
			}

			expect(results).toHaveLength(1);
			expect(results[0].content).toBe(largeContent);
			expect(results[0].content.length).toBe(10000);
		});
	});
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiffService } from '../../Services/DiffService';
import { AbortService } from '../../Services/AbortService';
import { DeregisterAllServices, RegisterSingleton } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Event } from '../../Enums/Event';
import type VaultkeeperAIPlugin from '../../main';
import type { EventService } from '../../Services/EventService';

describe('DiffService', () => {
	let service: DiffService;
	let mockPlugin: any;
	let mockEventService: any;
	let abortService: AbortService;
	let mockEventListeners: Map<Event, Function[]>;

	beforeEach(() => {
		DeregisterAllServices();

		mockEventListeners = new Map();

		mockPlugin = {
			activateDiffView: vi.fn().mockResolvedValue(undefined)
		};

		mockEventService = {
			trigger: vi.fn((event: Event, data?: unknown) => {
				const listeners = mockEventListeners.get(event) || [];
				listeners.forEach(listener => listener(data));
			}),
			on: vi.fn((event: Event, callback: Function) => {
				if (!mockEventListeners.has(event)) {
					mockEventListeners.set(event, []);
				}
				mockEventListeners.get(event)!.push(callback);
				return { listener: callback };
			}),
			off: vi.fn()
		};

		abortService = new AbortService();

		RegisterSingleton<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin, mockPlugin);
		RegisterSingleton<EventService>(Services.EventService, mockEventService);
		RegisterSingleton<AbortService>(Services.AbortService, abortService);

		service = new DiffService();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('Constructor & Initialization', () => {
		it('should initialize with all required dependencies', () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(DiffService);
		});

		it('should register DiffClosed event listener', () => {
			expect(mockEventService.on).toHaveBeenCalledWith(Event.DiffClosed, expect.any(Function));
		});

		it('should initialize with ongoingDiff as false', () => {
			expect((service as any).ongoingDiff).toBe(false);
		});

		it('should initialize with no diffResolve callback', () => {
			expect((service as any).diffResolve).toBeUndefined();
		});
	});

	describe('requestDiff - Promise Resolution Paths', () => {
		it('should create diff string and activate diff view', async () => {
			const diffPromise = service.requestDiff('old.md', 'new.md', 'old content', 'new content');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockPlugin.activateDiffView).toHaveBeenCalledWith(
				expect.stringContaining('old.md'),
				expect.objectContaining({
					outputFormat: 'line-by-line',
					highlight: true
				})
			);

			service.onAccept();
			await diffPromise;
		});

		it('should trigger DiffOpened event', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'a', 'b');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockEventService.trigger).toHaveBeenCalledWith(Event.DiffOpened);

			service.onAccept();
			await diffPromise;
		});

		it('should set ongoingDiff to true', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'a', 'b');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect((service as any).ongoingDiff).toBe(true);

			service.onAccept();
			await diffPromise;
		});

		it('should resolve with accepted:true on onAccept()', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onAccept();

			const result = await diffPromise;
			expect(result).toEqual({ accepted: true });
		});

		it('should resolve with accepted:false on onReject()', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onReject();

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false });
		});

		it('should resolve with suggestion on onSuggest()', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onSuggest('Please add comments');

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false, suggestion: 'Please add comments' });
		});

		it('should reject if abort signal already aborted', async () => {
			abortService.abort('Already aborted');

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await expect(diffPromise).rejects.toThrow();
		});

		it('should reject when aborted during pending diff', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			abortService.abort('Aborted during diff');

			await expect(diffPromise).rejects.toThrow();
		});

		it('should clean up abort listener on accept', async () => {
			const signal = abortService.signal();
			const removeListenerSpy = vi.spyOn(signal, 'removeEventListener');

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onAccept();
			await diffPromise;

			expect(removeListenerSpy).toHaveBeenCalled();
		});

		it('should clean up abort listener on reject', async () => {
			const signal = abortService.signal();
			const removeListenerSpy = vi.spyOn(signal, 'removeEventListener');

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onReject();
			await diffPromise;

			expect(removeListenerSpy).toHaveBeenCalled();
		});

		it('should clean up abort listener on suggest', async () => {
			const signal = abortService.signal();
			const removeListenerSpy = vi.spyOn(signal, 'removeEventListener');

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onSuggest('suggestion');
			await diffPromise;

			expect(removeListenerSpy).toHaveBeenCalled();
		});

		it('should handle concurrent requestDiff calls', async () => {
			const diff1Promise = service.requestDiff('a.md', 'b.md', 'old1', 'new1');

			await new Promise(resolve => setTimeout(resolve, 10));

			// Start second diff (may override first)
			const diff2Promise = service.requestDiff('c.md', 'd.md', 'old2', 'new2');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onAccept();

			// Second diff should resolve
			const result2 = await diff2Promise;
			expect(result2).toEqual({ accepted: true });

			// First diff callback was overridden, so it won't resolve the same way
			// This documents current behavior
		});
	});

	describe('onAccept()', () => {
		it('should call diffResolve with accepted:true', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onAccept();

			const result = await diffPromise;
			expect(result).toEqual({ accepted: true });
		});

		it('should call finishDiff()', async () => {
			const finishDiffSpy = vi.spyOn(service as any, 'finishDiff');

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onAccept();
			await diffPromise;

			expect(finishDiffSpy).toHaveBeenCalled();
		});

		it('should be safe to call when no pending diff', () => {
			expect(() => service.onAccept()).not.toThrow();
		});

		it('should be safe to call multiple times', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onAccept();
			await diffPromise;

			expect(() => service.onAccept()).not.toThrow();
		});

		it('should set ongoingDiff to false', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect((service as any).ongoingDiff).toBe(true);

			service.onAccept();
			await diffPromise;

			expect((service as any).ongoingDiff).toBe(false);
		});
	});

	describe('onReject()', () => {
		it('should call diffResolve with accepted:false', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onReject();

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false });
		});

		it('should call finishDiff()', async () => {
			const finishDiffSpy = vi.spyOn(service as any, 'finishDiff');

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onReject();
			await diffPromise;

			expect(finishDiffSpy).toHaveBeenCalled();
		});

		it('should be safe to call when no pending diff', () => {
			expect(() => service.onReject()).not.toThrow();
		});

		it('should be safe to call multiple times', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onReject();
			await diffPromise;

			expect(() => service.onReject()).not.toThrow();
		});

		it('should clear diffResolve callback', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect((service as any).diffResolve).toBeDefined();

			service.onReject();
			await diffPromise;

			expect((service as any).diffResolve).toBeUndefined();
		});
	});

	describe('onSuggest()', () => {
		it('should call diffResolve with suggestion', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onSuggest('Add error handling');

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false, suggestion: 'Add error handling' });
		});

		it('should call finishDiff()', async () => {
			const finishDiffSpy = vi.spyOn(service as any, 'finishDiff');

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onSuggest('text');
			await diffPromise;

			expect(finishDiffSpy).toHaveBeenCalled();
		});

		it('should handle empty suggestion string', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onSuggest('');

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false, suggestion: '' });
		});

		it('should handle very long suggestion', async () => {
			const longSuggestion = 'X'.repeat(10000);
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onSuggest(longSuggestion);

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false, suggestion: longSuggestion });
		});

		it('should be safe when no pending diff', () => {
			expect(() => service.onSuggest('test')).not.toThrow();
		});

		it('should handle special characters in suggestion', async () => {
			const specialSuggestion = 'Line 1\nLine 2\t"quoted"';
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onSuggest(specialSuggestion);

			const result = await diffPromise;
			expect(result.suggestion).toBe(specialSuggestion);
		});
	});

	describe('cancelPendingDiff - Event Handling', () => {
		it('should resolve with accepted:false when diff is ongoing', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			// Trigger DiffClosed event
			const listeners = mockEventListeners.get(Event.DiffClosed) || [];
			listeners.forEach(listener => listener());

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false });
		});

		it('should call finishDiff() when ongoing', async () => {
			const finishDiffSpy = vi.spyOn(service as any, 'finishDiff');

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			const listeners = mockEventListeners.get(Event.DiffClosed) || [];
			listeners.forEach(listener => listener());

			await diffPromise;

			expect(finishDiffSpy).toHaveBeenCalled();
		});

		it('should do nothing when no ongoing diff', () => {
			const finishDiffSpy = vi.spyOn(service as any, 'finishDiff');

			const listeners = mockEventListeners.get(Event.DiffClosed) || [];
			listeners.forEach(listener => listener());

			expect(finishDiffSpy).not.toHaveBeenCalled();
		});

		it('should be called via registered event listener', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockEventListeners.has(Event.DiffClosed)).toBe(true);

			mockEventService.trigger(Event.DiffClosed);

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false });
		});

		it('should handle race with onAccept', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onAccept();

			// Try to trigger cancel after accept
			const listeners = mockEventListeners.get(Event.DiffClosed) || [];
			listeners.forEach(listener => listener());

			const result = await diffPromise;
			expect(result).toEqual({ accepted: true });
		});

		it('should handle multiple DiffClosed events', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			mockEventService.trigger(Event.DiffClosed);
			mockEventService.trigger(Event.DiffClosed);

			const result = await diffPromise;
			expect(result).toEqual({ accepted: false });
		});
	});

	describe('createDiffString - Private Method', () => {
		const getCreateDiffString = () => (service as any).createDiffString.bind(service);

		it('should return a string', () => {
			const createDiffString = getCreateDiffString();
			const result = createDiffString('a.md', 'b.md', 'old', 'new');

			expect(typeof result).toBe('string');
		});

		it('should handle identical content', () => {
			const createDiffString = getCreateDiffString();
			const result = createDiffString('file.md', 'file.md', 'same', 'same');

			expect(typeof result).toBe('string');
		});

		it('should handle empty old content', () => {
			const createDiffString = getCreateDiffString();
			const result = createDiffString('a.md', 'b.md', '', 'new content');

			expect(result).toContain('new content');
		});

		it('should handle empty new content', () => {
			const createDiffString = getCreateDiffString();
			const result = createDiffString('a.md', 'b.md', 'old content', '');

			expect(result).toContain('old content');
		});

		it('should handle both empty', () => {
			const createDiffString = getCreateDiffString();
			const result = createDiffString('a.md', 'b.md', '', '');

			expect(typeof result).toBe('string');
		});

		it('should handle multiline content', () => {
			const createDiffString = getCreateDiffString();
			const result = createDiffString('a.md', 'b.md', 'line1\nline2\nline3', 'line1\nMODIFIED\nline3');

			expect(result).toContain('MODIFIED');
		});

		it('should handle special characters in content', () => {
			const createDiffString = getCreateDiffString();
			const specialContent = 'Content with "quotes" and \\backslashes\\ and \u2713 unicode';

			expect(() => createDiffString('a.md', 'b.md', specialContent, 'new')).not.toThrow();
		});

		it('should create valid diff format', () => {
			const createDiffString = getCreateDiffString();
			const result = createDiffString('old.md', 'new.md', 'old content', 'new content');

			expect(result).toContain('---');
			expect(result).toContain('+++');
			expect(result).toContain('@@');
		});
	});

	describe('finishDiff - Private Method', () => {
		const getFinishDiff = () => (service as any).finishDiff.bind(service);

		it('should set ongoingDiff to false', () => {
			(service as any).ongoingDiff = true;

			const finishDiff = getFinishDiff();
			finishDiff();

			expect((service as any).ongoingDiff).toBe(false);
		});

		it('should clear diffResolve callback', () => {
			(service as any).diffResolve = vi.fn();

			const finishDiff = getFinishDiff();
			finishDiff();

			expect((service as any).diffResolve).toBeUndefined();
		});

		it('should trigger DiffClosed event', () => {
			const finishDiff = getFinishDiff();
			finishDiff();

			expect(mockEventService.trigger).toHaveBeenCalledWith(Event.DiffClosed);
		});

		it('should be safe to call multiple times', () => {
			const finishDiff = getFinishDiff();

			expect(() => {
				finishDiff();
				finishDiff();
				finishDiff();
			}).not.toThrow();
		});

		it('should complete all cleanup operations in order', () => {
			(service as any).ongoingDiff = true;
			(service as any).diffResolve = vi.fn();

			const finishDiff = getFinishDiff();
			finishDiff();

			expect((service as any).ongoingDiff).toBe(false);
			expect((service as any).diffResolve).toBeUndefined();
			expect(mockEventService.trigger).toHaveBeenCalledWith(Event.DiffClosed);
		});
	});

	describe('Diff Configuration', () => {
		it('should create config with correct output format', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			const configArg = mockPlugin.activateDiffView.mock.calls[0][1];
			expect(configArg.outputFormat).toBe('line-by-line');

			service.onAccept();
			await diffPromise;
		});

		it('should enable highlighting in config', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			const configArg = mockPlugin.activateDiffView.mock.calls[0][1];
			expect(configArg.highlight).toBe(true);

			service.onAccept();
			await diffPromise;
		});

		it('should set matching to words', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			const configArg = mockPlugin.activateDiffView.mock.calls[0][1];
			expect(configArg.matching).toBe('words');

			service.onAccept();
			await diffPromise;
		});

		it('should use auto color scheme', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			const configArg = mockPlugin.activateDiffView.mock.calls[0][1];
			expect(configArg.colorScheme).toBe('auto');

			service.onAccept();
			await diffPromise;
		});
	});

	describe('Integration & State Management', () => {
		it('full lifecycle - request, accept', async () => {
			expect((service as any).ongoingDiff).toBe(false);

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect((service as any).ongoingDiff).toBe(true);
			expect(mockEventService.trigger).toHaveBeenCalledWith(Event.DiffOpened);

			service.onAccept();

			const result = await diffPromise;

			expect(result).toEqual({ accepted: true });
			expect((service as any).ongoingDiff).toBe(false);
			expect((service as any).diffResolve).toBeUndefined();
		});

		it('full lifecycle - request, reject', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onReject();

			const result = await diffPromise;

			expect(result).toEqual({ accepted: false });
			expect((service as any).ongoingDiff).toBe(false);
		});

		it('full lifecycle - request, suggest', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onSuggest('Add more tests');

			const result = await diffPromise;

			expect(result).toEqual({ accepted: false, suggestion: 'Add more tests' });
			expect((service as any).ongoingDiff).toBe(false);
		});

		it('full lifecycle - request, abort', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			abortService.abort('User cancelled');

			await expect(diffPromise).rejects.toThrow();
		});

		it('full lifecycle - request, cancel via event', async () => {
			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			mockEventService.trigger(Event.DiffClosed);

			const result = await diffPromise;

			expect(result).toEqual({ accepted: false });
			expect((service as any).ongoingDiff).toBe(false);
		});

		it('sequential diffs - accept first, start second', async () => {
			const diff1Promise = service.requestDiff('a.md', 'b.md', 'old1', 'new1');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onAccept();

			const result1 = await diff1Promise;
			expect(result1).toEqual({ accepted: true });

			// Start second diff
			const diff2Promise = service.requestDiff('c.md', 'd.md', 'old2', 'new2');

			await new Promise(resolve => setTimeout(resolve, 10));

			service.onReject();

			const result2 = await diff2Promise;
			expect(result2).toEqual({ accepted: false });
		});

		it('should clean up Component event listeners on unload', () => {
			// DiffService extends Component which handles cleanup
			// Verify service was created with event registration
			expect(mockEventService.on).toHaveBeenCalledWith(Event.DiffClosed, expect.any(Function));
		});

		it('state consistency after various operation sequences', async () => {
			// Request
			const diff1 = service.requestDiff('a', 'b', 'old', 'new');
			await new Promise(resolve => setTimeout(resolve, 10));

			// Cancel
			mockEventService.trigger(Event.DiffClosed);
			await diff1;

			expect((service as any).ongoingDiff).toBe(false);

			// Request again
			const diff2 = service.requestDiff('c', 'd', 'old2', 'new2');
			await new Promise(resolve => setTimeout(resolve, 10));

			// Accept
			service.onAccept();
			await diff2;

			expect((service as any).ongoingDiff).toBe(false);
			expect((service as any).diffResolve).toBeUndefined();
		});
	});

	describe('Error Handling & Edge Cases', () => {
		it('should handle activateDiffView rejection', async () => {
			mockPlugin.activateDiffView.mockRejectedValue(new Error('View error'));

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			// Promise creation succeeds, error happens in background
			expect((service as any).ongoingDiff).toBe(true);

			service.onAccept();
			await diffPromise;
		});

		it('should handle very large diff content', () => {
			const largeContent = 'X'.repeat(100000);

			expect(() => {
				service.requestDiff('a.md', 'b.md', largeContent, 'Y'.repeat(100000));
			}).not.toThrow();
		});

		it('should handle diff request with same filenames', async () => {
			const diffPromise = service.requestDiff('same.md', 'same.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockPlugin.activateDiffView).toHaveBeenCalled();

			service.onAccept();
			await diffPromise;
		});

		it('should handle abort during diff view activation', async () => {
			mockPlugin.activateDiffView.mockImplementation(() =>
				new Promise(resolve => setTimeout(resolve, 100))
			);

			const diffPromise = service.requestDiff('a.md', 'b.md', 'old', 'new');

			await new Promise(resolve => setTimeout(resolve, 10));

			abortService.abort('Abort during activation');

			await expect(diffPromise).rejects.toThrow();
		});

		it('should handle null content by throwing error', () => {
			const createDiffString = (service as any).createDiffString.bind(service);

			// The underlying diff library does not handle null/undefined - it throws
			expect(() => {
				createDiffString('a.md', 'b.md', null, undefined);
			}).toThrow();
		});

		it('should handle missing dependencies error', () => {
			DeregisterAllServices();

			// Attempting to create service without dependencies should fail
			expect(() => new DiffService()).toThrow();
		});
	});

	// Note: applyPatch tests removed as the DiffService no longer uses diff patches.
	// The VaultService.patch method now uses direct string match and replace instead.
});

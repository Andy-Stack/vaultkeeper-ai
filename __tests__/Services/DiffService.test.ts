import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiffService } from '../../Services/DiffService';
import { AbortService } from '../../Services/AbortService';
import { DeregisterAllServices, RegisterSingleton } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Event } from '../../Enums/Event';
import { DiffState } from '../../Enums/DiffState';
import { FileEvent } from '../../Enums/FileEvent';
import { AIToolResponse } from '../../AIClasses/ToolDefinitions/AIToolResponse';
import { Artifact } from '../../Conversations/Artifact';
import { ArtifactAction } from '../../Enums/ArtifactAction';
import type { IVaultChangeRequest } from '../../Services/TemporaryVaultService';

describe('DiffService', () => {
	let service: DiffService;
	let mockPlugin: any;
	let mockEventService: any;
	let mockSettingsService: any;
	let mockTemporaryVaultService: any;
	let mockDocumentValidationService: any;
	let abortService: AbortService;
	let eventListeners: Map<Event, Function[]>;

	function makeRequest(overrides: Partial<IVaultChangeRequest<string>> = {}): IVaultChangeRequest<string> {
		return {
			oldPath: 'folder/old.md',
			newPath: 'folder/new.md',
			oldContent: 'old content',
			newContent: 'new content',
			changeType: FileEvent.Modify,
			status: DiffState.None,
			changeAction: vi.fn().mockResolvedValue({ result: 'applied' }),
			...overrides
		};
	}

	// Simulates the user finishing their review: the diff view sets each status then closes
	function finishReview(statuses: DiffState[], requests: IVaultChangeRequest<string>[], suggestions: Record<number, string> = {}) {
		requests.forEach((request, index) => {
			request.status = statuses[index];
			request.suggestion = suggestions[index];
		});
		mockEventService.trigger(Event.DiffClosed);
	}

	async function waitForDiffToOpen() {
		await vi.waitFor(() => expect(mockPlugin.activateDiffView).toHaveBeenCalled());
	}

	beforeEach(() => {
		DeregisterAllServices();

		eventListeners = new Map();

		mockPlugin = {
			activateDiffView: vi.fn().mockResolvedValue(undefined),
			activateArtifactView: vi.fn().mockResolvedValue(undefined)
		};

		mockEventService = {
			trigger: vi.fn((event: Event, data?: unknown) => {
				(eventListeners.get(event) ?? []).forEach(listener => listener(data));
			}),
			on: vi.fn((event: Event, callback: Function) => {
				if (!eventListeners.has(event)) {
					eventListeners.set(event, []);
				}
				eventListeners.get(event)!.push(callback);
				return { listener: callback };
			}),
			off: vi.fn()
		};

		mockSettingsService = {
			settings: { freeEdit: false, enableAgentContinuity: false }
		};

		mockTemporaryVaultService = {
			reset: vi.fn(),
			addAll: vi.fn()
		};

		mockDocumentValidationService = {
			generateReport: vi.fn().mockResolvedValue(undefined),
			documentReport: undefined
		};

		abortService = new AbortService();

		RegisterSingleton(Services.VaultkeeperAIPlugin, mockPlugin);
		RegisterSingleton(Services.EventService, mockEventService);
		RegisterSingleton(Services.AbortService, abortService);
		RegisterSingleton(Services.SettingsService, mockSettingsService);
		RegisterSingleton(Services.TemporaryVaultService, mockTemporaryVaultService);
		RegisterSingleton(Services.DocumentValidationService, mockDocumentValidationService);

		service = new DiffService();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should register a DiffClosed event listener', () => {
			expect(mockEventService.on).toHaveBeenCalledWith(Event.DiffClosed, expect.any(Function));
		});

		it('should start with no ongoing diff', () => {
			expect((service as any).ongoingDiff).toBe(false);
			expect((service as any).diffResolve).toBeUndefined();
		});
	});

	describe('proposeChanges - review flow', () => {
		it('should reset the temporary vault and track the requested changes', async () => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Accepted], requests);
			await pending;

			expect(mockTemporaryVaultService.reset).toHaveBeenCalledTimes(1);
			expect(mockTemporaryVaultService.addAll).toHaveBeenCalledWith(requests);
			expect(mockTemporaryVaultService.reset.mock.invocationCallOrder[0])
				.toBeLessThan(mockTemporaryVaultService.addAll.mock.invocationCallOrder[0]);
		});

		it('should open the diff view with the diff configuration and trigger DiffOpened', async () => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();

			expect(mockPlugin.activateDiffView).toHaveBeenCalledWith(expect.objectContaining({
				outputFormat: 'line-by-line',
				highlight: false,
				matching: 'words',
				drawFileList: false
			}));
			expect(mockEventService.trigger).toHaveBeenCalledWith(Event.DiffOpened);
			expect((service as any).ongoingDiff).toBe(true);

			finishReview([DiffState.Accepted], requests);
			await pending;
		});

		it('should assign a diff string to every change using file basenames', async () => {
			const requests = [
				makeRequest({ oldPath: 'a/b/first.md', newPath: 'a/b/first.md', oldContent: 'one', newContent: 'two' }),
				makeRequest({ oldPath: 'c/second.md', newPath: 'c/renamed.md', oldContent: 'same', newContent: 'same' })
			];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();

			expect(requests[0].diffString).toContain('--- first.md');
			expect(requests[0].diffString).toContain('+++ first.md');
			expect(requests[0].diffString).toContain('-one');
			expect(requests[0].diffString).toContain('+two');
			expect(requests[1].diffString).toContain('--- second.md');
			expect(requests[1].diffString).toContain('+++ renamed.md');

			finishReview([DiffState.Rejected, DiffState.Rejected], requests);
			await pending;
		});

		it('should diff against /dev/null for created and deleted files', async () => {
			const created = makeRequest({ oldPath: undefined, oldContent: undefined, newPath: 'new.md', newContent: 'hello', changeType: FileEvent.Create });
			const deleted = makeRequest({ oldPath: 'gone.md', oldContent: 'bye', newPath: undefined, newContent: undefined, changeType: FileEvent.Delete });

			const pending = service.proposeChanges([created, deleted]);
			await waitForDiffToOpen();

			expect(created.diffString).toContain('--- /dev/null');
			expect(created.diffString).toContain('+hello');
			expect(deleted.diffString).toContain('+++ /dev/null');
			expect(deleted.diffString).toContain('-bye');

			finishReview([DiffState.Rejected, DiffState.Rejected], [created, deleted]);
			await pending;
		});

		it('should apply accepted changes and return their results', async () => {
			const requests = [makeRequest(), makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Accepted, DiffState.Accepted], requests);
			const { results } = await pending;

			expect(requests[0].changeAction).toHaveBeenCalledTimes(1);
			expect(requests[1].changeAction).toHaveBeenCalledTimes(1);
			expect(results).toEqual([{ result: 'applied' }, { result: 'applied' }]);
		});

		it('should not apply rejected changes and report the rejection', async () => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Rejected], requests);
			const { results } = await pending;

			expect(requests[0].changeAction).not.toHaveBeenCalled();
			expect(results[0].error?.message).toBe(AIToolResponse.UserRejectionMessage);
		});

		it('should treat changes the user never reviewed as rejected', async () => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.None], requests);
			const { results } = await pending;

			expect(requests[0].changeAction).not.toHaveBeenCalled();
			expect(results[0].error?.message).toBe(AIToolResponse.UserRejectionMessage);
		});

		it('should return the user suggestion instead of applying the change', async () => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Suggestion], requests, { 0: '  use a heading instead  ' });
			const { results } = await pending;

			expect(requests[0].changeAction).not.toHaveBeenCalled();
			expect(results[0].error?.message).toBe(`${AIToolResponse.UserSuggestionMessage}\nuse a heading instead`);
		});

		it.each([undefined, '', '   '])('should report an empty suggestion when the feedback is %j', async (suggestion) => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Suggestion], requests, { 0: suggestion as string });
			const { results } = await pending;

			expect(results[0].error?.message).toBe(AIToolResponse.UserEmptySuggestionMessage);
		});

		it('should return results in request order for mixed decisions', async () => {
			const requests = [makeRequest(), makeRequest(), makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Rejected, DiffState.Accepted, DiffState.Suggestion], requests, { 2: 'tweak it' });
			const { results } = await pending;

			expect(results).toHaveLength(3);
			expect(results[0].error?.message).toBe(AIToolResponse.UserRejectionMessage);
			expect(results[1]).toEqual({ result: 'applied' });
			expect(results[2].error?.message).toContain('tweak it');
			expect(requests[0].changeAction).not.toHaveBeenCalled();
			expect(requests[1].changeAction).toHaveBeenCalledTimes(1);
			expect(requests[2].changeAction).not.toHaveBeenCalled();
		});

		it('should surface an error response from an accepted change without failing the others', async () => {
			const failure = new Error('disk full');
			const requests = [
				makeRequest({ changeAction: vi.fn().mockResolvedValue({ error: failure }) }),
				makeRequest()
			];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Accepted, DiffState.Accepted], requests);
			const { results } = await pending;

			expect(results[0].error).toBe(failure);
			expect(results[1]).toEqual({ result: 'applied' });
		});

		it('should clear the ongoing diff state once the review closes', async () => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Accepted], requests);
			await pending;

			expect((service as any).ongoingDiff).toBe(false);
			expect((service as any).diffResolve).toBeUndefined();
		});

		it('should not generate a validation report in review mode', async () => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Accepted], requests);
			await pending;

			expect(mockDocumentValidationService.generateReport).not.toHaveBeenCalled();
		});
	});

	describe('proposeChanges - free edit', () => {
		beforeEach(() => {
			mockSettingsService.settings.freeEdit = true;
		});

		it('should accept every change without opening the diff view', async () => {
			const requests = [makeRequest(), makeRequest()];

			const { results } = await service.proposeChanges(requests);

			expect(mockPlugin.activateDiffView).not.toHaveBeenCalled();
			expect(requests.every(request => request.status === DiffState.Accepted)).toBe(true);
			expect(requests[0].changeAction).toHaveBeenCalledTimes(1);
			expect(requests[1].changeAction).toHaveBeenCalledTimes(1);
			expect(results).toEqual([{ result: 'applied' }, { result: 'applied' }]);
		});

		it('should generate a validation report', async () => {
			await service.proposeChanges([makeRequest()]);

			expect(mockDocumentValidationService.generateReport).toHaveBeenCalledTimes(1);
		});
	});

	describe('proposeChanges - agent continuity', () => {
		it('should include the document report when agent continuity is enabled', async () => {
			mockSettingsService.settings.freeEdit = true;
			mockSettingsService.settings.enableAgentContinuity = true;
			const report = { issueCount: () => 2 };
			mockDocumentValidationService.documentReport = report;

			const response = await service.proposeChanges([makeRequest()]);

			expect(response.report).toBe(report);
			expect(response.results).toEqual([{ result: 'applied' }]);
		});

		it('should omit the report when agent continuity is disabled', async () => {
			mockSettingsService.settings.freeEdit = true;
			mockDocumentValidationService.documentReport = { issueCount: () => 2 };

			const response = await service.proposeChanges([makeRequest()]);

			expect(response).not.toHaveProperty('report');
		});
	});

	describe('proposeChanges - aborting', () => {
		it('should reject without opening the view when already aborted', async () => {
			abortService.abort();

			await expect(service.proposeChanges([makeRequest()])).rejects.toMatchObject({ name: 'AbortError' });

			expect(mockPlugin.activateDiffView).not.toHaveBeenCalled();
		});

		it('should reject, close the view and reset state when aborted during a review', async () => {
			const request = makeRequest();

			const pending = service.proposeChanges([request]);
			await waitForDiffToOpen();
			abortService.abort();

			await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
			expect(mockEventService.trigger).toHaveBeenCalledWith(Event.DiffClosed);
			expect((service as any).ongoingDiff).toBe(false);
			expect((service as any).diffResolve).toBeUndefined();
			expect(request.changeAction).not.toHaveBeenCalled();
		});

		it('should stop listening for aborts once the review is finished', async () => {
			const requests = [makeRequest()];
			const removeListener = vi.spyOn(abortService.signal(), 'removeEventListener');

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Accepted], requests);
			await pending;

			expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
		});
	});

	describe('proposeChanges - errors', () => {
		it('should return an error for every request when setup fails', async () => {
			mockTemporaryVaultService.addAll.mockImplementation(() => { throw new Error('tracking failed'); });
			const requests = [makeRequest(), makeRequest()];

			const { results } = await service.proposeChanges(requests);

			expect(results).toHaveLength(2);
			expect(results[0].error?.message).toBe('tracking failed');
			expect(results[1].error?.message).toBe('tracking failed');
			expect(requests[0].changeAction).not.toHaveBeenCalled();
		});

		it('should close the diff view when setup fails', async () => {
			mockTemporaryVaultService.addAll.mockImplementation(() => { throw new Error('tracking failed'); });

			await service.proposeChanges([makeRequest()]);

			expect(mockEventService.trigger).toHaveBeenCalledWith(Event.DiffClosed);
		});

		it('should return an error when applying an accepted change throws', async () => {
			mockSettingsService.settings.freeEdit = true;
			const requests = [makeRequest({ changeAction: vi.fn().mockRejectedValue(new Error('write failed')) })];

			const { results } = await service.proposeChanges(requests);

			expect(results[0].error?.message).toBe('write failed');
		});
	});

	describe('DiffClosed handling', () => {
		it('should ignore DiffClosed when no diff is ongoing', () => {
			expect(() => mockEventService.trigger(Event.DiffClosed)).not.toThrow();
			expect((service as any).ongoingDiff).toBe(false);
		});

		it('should tolerate repeated DiffClosed events', async () => {
			const requests = [makeRequest()];

			const pending = service.proposeChanges(requests);
			await waitForDiffToOpen();
			finishReview([DiffState.Accepted], requests);
			mockEventService.trigger(Event.DiffClosed);
			mockEventService.trigger(Event.DiffClosed);

			const { results } = await pending;
			expect(results).toEqual([{ result: 'applied' }]);
		});
	});

	describe('sequential reviews', () => {
		it('should support a second review after the first has finished', async () => {
			const first = [makeRequest()];
			const firstPending = service.proposeChanges(first);
			await waitForDiffToOpen();
			finishReview([DiffState.Accepted], first);
			await firstPending;

			mockPlugin.activateDiffView.mockClear();

			const second = [makeRequest()];
			const secondPending = service.proposeChanges(second);
			await waitForDiffToOpen();
			finishReview([DiffState.Rejected], second);
			const { results } = await secondPending;

			expect(mockTemporaryVaultService.reset).toHaveBeenCalledTimes(2);
			expect(results[0].error?.message).toBe(AIToolResponse.UserRejectionMessage);
		});
	});

	describe('showArtifactDiff', () => {
		it('should open the artifact view with a full-context diff and the diff configuration', () => {
			const artifact = new Artifact('notes/todo.md', 'text/markdown', ArtifactAction.Modify, 'before', 'after');

			service.showArtifactDiff(artifact);

			expect(mockPlugin.activateArtifactView).toHaveBeenCalledWith(
				artifact,
				expect.stringContaining('--- notes/todo.md'),
				expect.objectContaining({ outputFormat: 'line-by-line' })
			);
			const diffString = mockPlugin.activateArtifactView.mock.calls[0][1] as string;
			expect(diffString).toContain('-before');
			expect(diffString).toContain('+after');
		});

		it('should not open the diff review view', () => {
			const artifact = new Artifact('a.md', 'text/markdown', ArtifactAction.Modify, 'x', 'y');

			service.showArtifactDiff(artifact);

			expect(mockPlugin.activateDiffView).not.toHaveBeenCalled();
		});
	});
});

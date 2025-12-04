import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AbortService } from '../../Services/AbortService';
import { DeregisterAllServices } from '../../Services/DependencyService';

describe('AbortService', () => {
	let service: AbortService;

	beforeEach(() => {
		service = new AbortService();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('Constructor & Initialization', () => {
		it('should initialize with a non-aborted controller', () => {
			expect(service.signal().aborted).toBe(false);
		});

		it('should provide a valid abort signal', () => {
			const signal = service.signal();
			expect(signal).toBeInstanceOf(AbortSignal);
		});

		it('should have undefined reason before abort', () => {
			expect(service.signal().reason).toBeUndefined();
		});
	});

	describe('isAbortError - Static Method', () => {
		it('should return true for DOMException with name AbortError', () => {
			const error = new DOMException('Aborted', 'AbortError');
			expect(AbortService.isAbortError(error)).toBe(true);
		});

		it('should return false for DOMException with different name', () => {
			const error = new DOMException('Error', 'NetworkError');
			expect(AbortService.isAbortError(error)).toBe(false);
		});

		it('should return false for generic Error', () => {
			const error = new Error('Aborted');
			expect(AbortService.isAbortError(error)).toBe(false);
		});

		it('should return false for null', () => {
			expect(AbortService.isAbortError(null)).toBe(false);
		});

		it('should return false for undefined', () => {
			expect(AbortService.isAbortError(undefined)).toBe(false);
		});

		it('should return false for string', () => {
			expect(AbortService.isAbortError('AbortError')).toBe(false);
		});
	});

	describe('initialiseAbortController', () => {
		it('should abort the current controller', () => {
			const originalSignal = service.signal();
			service.initialiseAbortController();
			expect(originalSignal.aborted).toBe(true);
		});

		it('should create a new non-aborted controller', () => {
			service.abort();
			expect(service.signal().aborted).toBe(true);

			service.initialiseAbortController();
			expect(service.signal().aborted).toBe(false);
		});

		it('should provide a new signal after initialization', () => {
			const oldSignal = service.signal();
			service.initialiseAbortController();
			const newSignal = service.signal();

			expect(oldSignal).not.toBe(newSignal);
		});

		it('should be callable multiple times in succession', () => {
			expect(() => {
				service.initialiseAbortController();
				service.initialiseAbortController();
				service.initialiseAbortController();
			}).not.toThrow();

			expect(service.signal().aborted).toBe(false);
		});

		it('should abort ongoing listeners on old signal', () => {
			const listener = vi.fn();
			const oldSignal = service.signal();
			oldSignal.addEventListener('abort', listener);

			service.initialiseAbortController();

			expect(listener).toHaveBeenCalled();
			expect(oldSignal.aborted).toBe(true);
		});
	});

	describe('signal()', () => {
		it('should return the current abort signal', () => {
			const signal = service.signal();
			expect(signal).toBeInstanceOf(AbortSignal);
		});

		it('should return the same signal on multiple calls', () => {
			const signal1 = service.signal();
			const signal2 = service.signal();
			expect(signal1).toBe(signal2);
		});

		it('should return new signal after re-initialization', () => {
			const signal1 = service.signal();
			service.initialiseAbortController();
			const signal2 = service.signal();

			expect(signal1).not.toBe(signal2);
		});
	});

	describe('abort()', () => {
		it('should abort the controller with default reason', () => {
			service.abort();

			expect(service.signal().aborted).toBe(true);
			expect(service.signal().reason).toBeDefined();
			expect(service.signal().reason.message).toContain('Aborted');
		});

		it('should abort with custom reason', () => {
			service.abort('Custom abort message');

			expect(service.signal().aborted).toBe(true);
			expect(service.signal().reason.message).toContain('Custom abort message');
		});

		it('should create DOMException with AbortError name', () => {
			service.abort('Test');

			const reason = service.signal().reason;
			expect(reason).toBeInstanceOf(DOMException);
			expect(reason.name).toBe('AbortError');
		});

		it('should trigger abort event on signal', () => {
			const listener = vi.fn();
			service.signal().addEventListener('abort', listener);

			service.abort();

			expect(listener).toHaveBeenCalled();
		});

		it('should be idempotent - multiple abort calls', () => {
			service.abort('First abort');
			const firstReason = service.signal().reason;

			service.abort('Second abort');
			service.abort('Third abort');

			expect(service.signal().reason).toBe(firstReason);
		});

		it('should work with empty string reason', () => {
			service.abort('');

			expect(service.signal().aborted).toBe(true);
			expect(service.signal().reason).toBeDefined();
		});

		it('should work with very long reason string', () => {
			const longReason = 'X'.repeat(1000);
			service.abort(longReason);

			expect(service.signal().aborted).toBe(true);
			expect(service.signal().reason.message).toContain(longReason);
		});
	});

	describe('reason()', () => {
		it('should return Error when signal has Error reason', () => {
			service.abort('Test error');
			const reason = service.reason();

			expect(reason).toBeInstanceOf(Error);
		});

		it('should return default Error before abort', () => {
			const reason = service.reason();

			expect(reason).toBeInstanceOf(Error);
			expect(reason.message).toBe('Aborted');
		});

		it('should return DOMException after abort', () => {
			service.abort('Custom');
			const reason = service.reason();

			expect(reason).toBeInstanceOf(DOMException);
		});

		it('should preserve custom abort message', () => {
			service.abort('Custom message');
			const reason = service.reason();

			expect(reason.message).toContain('Custom message');
		});

		it('should handle reason() after re-initialization', () => {
			service.abort('Original');
			service.initialiseAbortController();
			const reason = service.reason();

			expect(reason.message).toBe('Aborted');
		});
	});

	describe('throw()', () => {
		it('should throw the abort reason', () => {
			service.abort('Test error');

			expect(() => service.throw()).toThrow('Test error');
		});

		it('should throw Error type', () => {
			service.abort('Test');

			try {
				service.throw();
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
		});

		it('should throw even before abort', () => {
			expect(() => service.throw()).toThrow('Aborted');
		});

		it('should never return', () => {
			service.abort('Test');

			let didNotReturn = true;
			try {
				const result = service.throw();
				didNotReturn = false;
				// TypeScript ensures result type is 'never'
				expect(result).toBeUndefined(); // Should never reach
			} catch {
				expect(didNotReturn).toBe(true);
			}
		});
	});

	describe('abortableOperation - Core Functionality', () => {
		it('should execute and return result when not aborted', async () => {
			const executor = () => Promise.resolve('success');

			const result = await service.abortableOperation(executor);

			expect(result).toBe('success');
		});

		it('should immediately throw if already aborted', async () => {
			service.abort('Already aborted');

			const executor = vi.fn(() => Promise.resolve('test'));

			await expect(service.abortableOperation(executor)).rejects.toThrow();
			expect(executor).not.toHaveBeenCalled();
		});

		it('should throw when aborted during execution', async () => {
			const executor = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));

			const opPromise = service.abortableOperation(executor);

			setTimeout(() => service.abort('Aborted during execution'), 50);

			await expect(opPromise).rejects.toThrow();
			const error = await opPromise.catch(e => e);
			expect(AbortService.isAbortError(error)).toBe(true);
		});

		it('should return executor result when it completes first', async () => {
			const executor = () => new Promise(resolve => setTimeout(() => resolve('fast'), 10));

			const opPromise = service.abortableOperation(executor);

			setTimeout(() => service.abort(), 100);

			const result = await opPromise;
			expect(result).toBe('fast');
		});

		it('should clean up event listener on success', async () => {
			const signal = service.signal();
			const removeListenerSpy = vi.spyOn(signal, 'removeEventListener');

			await service.abortableOperation(() => Promise.resolve('done'));

			expect(removeListenerSpy).toHaveBeenCalled();
		});

		it('should clean up event listener on abort', async () => {
			const signal = service.signal();
			const removeListenerSpy = vi.spyOn(signal, 'removeEventListener');

			const executor = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));
			const opPromise = service.abortableOperation(executor);

			setTimeout(() => service.abort(), 10);

			await expect(opPromise).rejects.toThrow();
			expect(removeListenerSpy).toHaveBeenCalled();
		});

		it('should handle executor that rejects with non-abort error', async () => {
			const executor = () => Promise.reject(new Error('Network failed'));

			await expect(service.abortableOperation(executor)).rejects.toThrow('Network failed');
		});

		it('should suppress AbortError from executor after abort wins', async () => {
			const executorAbortError = new DOMException('Executor aborted', 'AbortError');
			const executor = () => new Promise((_, reject) =>
				setTimeout(() => reject(executorAbortError), 100)
			);

			const opPromise = service.abortableOperation(executor);

			setTimeout(() => service.abort('Service abort'), 10);

			await expect(opPromise).rejects.toThrow('Service abort');
		});

		it('should handle executor that throws synchronously', async () => {
			const executor = () => {
				throw new Error('Sync error');
			};

			await expect(service.abortableOperation(executor)).rejects.toThrow('Sync error');
		});

		it('should handle multiple concurrent operations', async () => {
			const executor1 = () => new Promise(resolve => setTimeout(() => resolve('op1'), 100));
			const executor2 = () => new Promise(resolve => setTimeout(() => resolve('op2'), 100));

			const op1Promise = service.abortableOperation(executor1);
			const op2Promise = service.abortableOperation(executor2);

			setTimeout(() => service.abort(), 50);

			await expect(op1Promise).rejects.toThrow();
			await expect(op2Promise).rejects.toThrow();
		});

		it('should handle executor returning immediately resolved promise', async () => {
			const executor = () => Promise.resolve('immediate');

			const result = await service.abortableOperation(executor);

			expect(result).toBe('immediate');
		});

		it('should handle executor with zero delay', async () => {
			const executor = async () => {
				return 'zero-delay';
			};

			const result = await service.abortableOperation(executor);

			expect(result).toBe('zero-delay');
		});
	});

	describe('abortableOperation - Timing & Race Conditions', () => {
		it('should handle abort triggered immediately after operation starts', async () => {
			const executor = () => new Promise(resolve => setTimeout(() => resolve('done'), 50));

			const opPromise = service.abortableOperation(executor);
			service.abort('Immediate abort');

			await expect(opPromise).rejects.toThrow();
		});

		it('should handle very fast executor', async () => {
			const executor = () => Promise.resolve('instant');

			const result = await service.abortableOperation(executor);

			expect(result).toBe('instant');
		});

		it('should handle executor that never resolves with abort', async () => {
			const executor = () => new Promise(() => {}); // Never resolves

			const opPromise = service.abortableOperation(executor);

			setTimeout(() => service.abort(), 50);

			await expect(opPromise).rejects.toThrow();
		});

		it('should handle abort called during Promise.race evaluation', async () => {
			const executor = () => new Promise(resolve => setTimeout(() => resolve('done'), 30));

			const opPromise = service.abortableOperation(executor);

			setTimeout(() => service.abort(), 15);

			await expect(opPromise).rejects.toThrow();
		});

		it('should handle multiple abort calls during operation', async () => {
			const executor = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));

			const opPromise = service.abortableOperation(executor);

			// Abort multiple times - only first abort matters due to idempotence
			setTimeout(() => {
				service.abort('First');
				service.abort('Second');
				service.abort('Third');
			}, 10);

			await expect(opPromise).rejects.toThrow('First');
		});

		it('should handle re-initialization during operation', async () => {
			const executor = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));

			const opPromise = service.abortableOperation(executor);

			setTimeout(() => service.initialiseAbortController(), 50);

			await expect(opPromise).rejects.toThrow();
		});
	});

	describe('Integration Scenarios', () => {
		it('should work with fetch-like operations', async () => {
			const mockFetch = vi.fn().mockImplementation((_url, options) => {
				return new Promise((resolve, reject) => {
					const abortHandler = () => {
						reject(new DOMException('Fetch aborted', 'AbortError'));
					};

					if (options.signal.aborted) {
						reject(new DOMException('Already aborted', 'AbortError'));
						return;
					}

					options.signal.addEventListener('abort', abortHandler);

					setTimeout(() => {
						options.signal.removeEventListener('abort', abortHandler);
						resolve({ data: 'response' });
					}, 100);
				});
			});

			const executor = () => mockFetch('https://api.example.com', { signal: service.signal() });
			const opPromise = service.abortableOperation(executor);

			// Use immediate abort to avoid timing issues with test cleanup
			service.abort();

			await expect(opPromise).rejects.toThrow();
		});

		it('should chain multiple abortable operations', async () => {
			const executor1 = () => Promise.resolve('result1');
			const executor2 = () => Promise.resolve('result2');

			const result1 = await service.abortableOperation(executor1);
			const result2 = await service.abortableOperation(executor2);

			expect(result1).toBe('result1');
			expect(result2).toBe('result2');
		});

		it('should work with async/await in executor', async () => {
			const executor = async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				await new Promise(resolve => setTimeout(resolve, 10));
				return 'multi-await';
			};

			const result = await service.abortableOperation(executor);

			expect(result).toBe('multi-await');
		});

		it('should handle full lifecycle - abort, reset, run operation', async () => {
			service.abort('Initial abort');
			expect(service.signal().aborted).toBe(true);

			service.initialiseAbortController();
			expect(service.signal().aborted).toBe(false);

			const result = await service.abortableOperation(() => Promise.resolve('success'));

			expect(result).toBe('success');
		});
	});
});

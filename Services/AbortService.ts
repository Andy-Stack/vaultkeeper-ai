// This class is designed to provide a single centralised abort controller
export class AbortService {
  private abortController: AbortController = new AbortController();

  public static isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
  }

  public reset = () => this.initialiseAbortController(); // semantic alias for initialiseAbortController

  public initialiseAbortController(): void {
      this.abort();
      this.abortController = new AbortController();
  }

  public signal(): AbortSignal {
    return this.abortController.signal;
  }

  public reason(): Error {
    return this.signal().reason instanceof Error ? this.signal().reason as Error : new Error("Aborted");
  }

  public abort(reason?: string): void {
      this.abortController.abort(
          new DOMException(reason ?? "Aborted", "AbortError")
      );
  }

  // useful if you need to rethrow the abort error
  public throw(): never {
    throw this.reason();
  }

  public async abortableOperation<T>(executor: () => Promise<T>): Promise<T> {
      const signal = this.abortController.signal;

      if (signal.aborted) {
          this.throw();
      }

      let abortHandler: () => void;
      let abortWon = false;

      const executorPromise = executor();

      const abortPromise = new Promise<never>((_, reject) => {
          abortHandler = () => {
              abortWon = true;
              reject(this.reason());
          };
          signal.addEventListener("abort", abortHandler, { once: true });
      });

      // Suppress AbortErrors from executor once abort has won the race
      executorPromise.catch(error => {
          if (abortWon && AbortService.isAbortError(error)) {
              return;
          }
      });

      abortPromise.catch(() => {});

      try {
          return await Promise.race([executorPromise, abortPromise]);
      } finally {
          signal.removeEventListener("abort", abortHandler!);
      }
  }
}
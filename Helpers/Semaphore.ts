export class Semaphore {

    private max: number;
    private count: number;
    private readonly waitAsync: boolean;
    private readonly queue: ((value: boolean) => void)[];

    constructor(max: number, waitAsync: boolean) {
        this.max = max;
        this.count = max;
        this.waitAsync = waitAsync;
        this.queue = [];
    }

    async wait(timeoutMs?: number): Promise<boolean> {
        if (this.count > 0) {
            this.count--;
            return true;
        }

        if (!this.waitAsync) {
            return false;
        }

        return new Promise<boolean>((resolve) => {
            let settled = false;
            let timeoutId: number | null = null;

            const waiter = (value: boolean) => {
                if (settled) {
                    if (value) {
                        this.release();
                    }
                    return;
                }
                settled = true;
                if (timeoutId !== null) {
                    window.clearTimeout(timeoutId);
                }
                resolve(value);
            };

            this.queue.push(waiter);

            if (timeoutMs !== undefined && timeoutMs >= 0) {
                timeoutId = window.setTimeout(() => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    const idx = this.queue.indexOf(waiter);
                    if (idx !== -1) {
                        this.queue.splice(idx, 1);
                    }
                    resolve(false);
                }, timeoutMs);
            }
        });
    }

    release() {
        if (this.queue.length > 0) {
            const resolve = this.queue.shift();
            if (resolve) {
                resolve(true);
            }
        } else {
            if (this.count < this.max) {
                this.count++;
            }
        }
    }
    
}
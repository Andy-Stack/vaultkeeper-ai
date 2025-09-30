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

    async wait(): Promise<boolean> {
        if (this.count > 0) {
            this.count--;
            return true;
        }

        if (!this.waitAsync) {
            return false;
        }

        return new Promise<boolean>((resolve) => {
            this.queue.push(resolve);
        });
    }

    release(): void {
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
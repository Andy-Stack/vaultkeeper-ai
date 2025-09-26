import { type Vault } from "obsidian";

export function isValidJson(str: string): boolean {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export async function createDirectories(vault: Vault, filePath: string) {
    const dirPath: string = filePath.substring(0, filePath.lastIndexOf('/'));

    const dirs: string[] = dirPath.split('/');

    let currentPath = "";
    for (const dir of dirs) {
        if (dir) {
            currentPath = currentPath ? `${currentPath}/${dir}` : dir;
            if (vault.getAbstractFileByPath(currentPath) == null) {
                await vault.createFolder(currentPath);
            }
        }
    }
}

export function loadExternalCSS(href: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = reject;
        document.head.appendChild(link);
    });
}

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
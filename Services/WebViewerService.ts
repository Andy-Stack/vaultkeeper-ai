import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { WebviewElement } from "Types/WebviewElement";

export class WebViewerService {

    private readonly plugin: VaultkeeperAIPlugin;

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    }

    public async getWebViewContent(urlHint?: string): Promise<string | null> {
        const webviewElement = this.getWebviewElement(urlHint);

        if (!webviewElement) {
            return null;
        }

        if (await this.waitForLoad(webviewElement)) {
            const pageContent = await webviewElement.executeJavaScript(
                'document.body.innerText'
            );
            return pageContent as string ?? "Failed to retrieve page content";
        }
        return "";
    }

    public async takeScreenshot(urlHint?: string, stripDataUrl: boolean = false): Promise<string | null> {
        const webviewElement = this.getWebviewElement(urlHint);

        if (!webviewElement) {
            return null;
        }

        if (await this.waitForLoad(webviewElement)) {
            const screenshot = await webviewElement.capturePage();
            const dataUrl = screenshot.toDataURL();
            return stripDataUrl ? dataUrl.split(',')[1] : dataUrl;
        }
        return null;
    }

    private getWebviewElement(urlHint?: string): WebviewElement | null {
        const leaves = this.plugin.app.workspace.getLeavesOfType('webviewer');
        if (leaves.length <= 0) {
            return null;
        }

        let webviewElement: WebviewElement | null = null;
        if (urlHint) {
            for (const leaf of leaves) {
                const element = leaf.view.containerEl.querySelector('webview');
                if (this.isWebviewElement(element) && element.getURL().contains(urlHint)) {
                    webviewElement = element;
                }
            }
        } else {
            const leaf = leaves[0];
            const element = leaf.view.containerEl.querySelector('webview');
            if (this.isWebviewElement(element)) {
                webviewElement = element;
            }
        }
        return webviewElement;
    }

    private async waitForLoad(webviewElement: WebviewElement, timeoutMs = 10000): Promise<boolean> {
        const start = Date.now();
        while (webviewElement.isLoading()) {
            if (Date.now() - start > timeoutMs) {
                return false;
            }
            await new Promise(r => activeWindow.setTimeout(r, 200));
        }
        return true;
    }    

    private isWebviewElement(element: Element | null): element is WebviewElement {
        return element !== null
            && typeof (element as WebviewElement).isLoading === 'function'
            && typeof (element as WebviewElement).executeJavaScript === 'function';
    }

}
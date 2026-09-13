import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { WebviewElement } from "Types/WebviewElement";
import type { SettingsService } from "./SettingsService";

export class WebViewerService {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly settingsService: SettingsService;

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
    }

    public async getWebViewContent(urlHint?: string, index: number = 0): Promise<{ content: string, nextIndex: number | undefined } | null> {
        const webviewElement = this.getWebviewElement(urlHint);

        if (!webviewElement) {
            return null;
        }

        if (await this.waitForLoad(webviewElement)) {
            const pageContent = await webviewElement.executeJavaScript(
                'document.body.innerText'
            ) as string ?? "Failed to retrieve page content";

            const nextIndex = index + this.settingsService.settings.contextSizeLimit;
            return {
                content: pageContent.slice(index, nextIndex),
                nextIndex: nextIndex < pageContent.length ? nextIndex : undefined
            };
        }
        return { content: "", nextIndex: undefined };
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
            await new Promise(r => window.setTimeout(r, 200));
        }
        return true;
    }    

    private isWebviewElement(element: Element | null): element is WebviewElement {
        return element !== null
            && typeof (element as WebviewElement).isLoading === 'function'
            && typeof (element as WebviewElement).executeJavaScript === 'function';
    }

}
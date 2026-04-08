export interface WebviewElement extends Element {
    getURL(): string;
    isLoading(): boolean;
    capturePage(): Promise<NativeImage>
    executeJavaScript(code: string): Promise<unknown>;
}

export interface NativeImage {
    toDataURL(): string;
}
import { mount, unmount, type Component } from "svelte";
import BottomSheet from "Components/BottomSheet.svelte";

export interface IBottomSheetOptions {
    label: string; // Accessible name for the sheet's dialog
    dismissOnBackdropTap?: boolean; // Whether tapping the backdrop or pressing Escape dismisses the sheet (true by default)
    maxHeight?: string; // Any CSS length. Defaults to 85vh
}

/** Passed to every sheet content component so it can dismiss its own sheet */
export interface IBottomSheetContentProps {
    close: () => void;
}

/** Animates the sheet out; `closed` resolves once it has been removed */
export interface IBottomSheetHandle {
    close(): void;
    readonly closed: Promise<void>;
}

/** What BottomSheet.svelte exports from its instance */
interface IBottomSheetExports {
    close(): void;
}

export class BottomSheetService {

    // `props` become the content's props (everything except `close`, which the sheet provides).
    public show<TProps extends IBottomSheetContentProps>(
        content: Component<TProps>,
        props: Omit<TProps, keyof IBottomSheetContentProps>,
        options: IBottomSheetOptions
    ): IBottomSheetHandle {
        let resolveClosed: () => void = () => {};
        const closed = new Promise<void>((resolve) => resolveClosed = resolve);

        // Legacy-syntax components don't surface `export function` members in mount()'s return type
        const sheet = mount(BottomSheet, {
            target: document.body,
            props: {
                content,
                contentProps: props,
                ...options,
                onClosed: () => {
                    void unmount(sheet);
                    resolveClosed();
                }
            }
        }) as IBottomSheetExports;

        return {
            close: () => sheet.close(),
            closed
        };
    }

}
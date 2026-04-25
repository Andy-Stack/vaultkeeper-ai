import { setIcon } from "obsidian";

export function getOuterHeight(element: HTMLElement): number {
    const marginTop = parseFloat(getComputedStyle(element).marginTop) || 0;
    const marginBottom = parseFloat(getComputedStyle(element).marginBottom) || 0;
    return element.offsetHeight + marginTop + marginBottom;
}

export function setElementIcon(element: HTMLDivElement, iconName: string) {
    if (element) {
        setIcon(element, iconName);
    }
    return {
        update(newIconName: string) {
            if (element) {
                setIcon(element, newIconName);
            }
        }
    };
}

export function hideDrawerElements() {
    for (const element of getDrawerElements()) {
        if ("vaultKeeperHidden" in element.dataset) continue;

        const computed = getComputedStyle(element);
        element.dataset.vaultKeeperHidden = String(element.scrollHeight);
        element.dataset.vaultKeeperPaddingTop = computed.paddingTop;
        element.dataset.vaultKeeperPaddingBottom = computed.paddingBottom;

        element.setCssProps({
            "--vaultKeeper-drawer-height": element.scrollHeight + "px",
            "--vaultKeeper-drawer-padding-top": computed.paddingTop,
            "--vaultKeeper-drawer-padding-bottom": computed.paddingBottom,
        });
        element.addClass("vaultKeeper-drawer-hiding");

        requestAnimationFrame(() => {
            element.removeClass("vaultKeeper-drawer-hiding");
            element.addClass("vaultKeeper-drawer-collapsed");
        });

        element.addEventListener("transitionend", () => {
            element.removeClass("vaultKeeper-drawer-collapsed");
            element.addClass("vaultKeeper-drawer-hidden");
        }, { once: true });
    }
}

export function restoreDrawerElements() {
    for (const element of getDrawerElements()) {
        if (!("vaultKeeperHidden" in element.dataset)) continue;

        const targetHeight = element.dataset.vaultKeeperHidden ?? "0";
        const paddingTop = element.dataset.vaultKeeperPaddingTop ?? "0";
        const paddingBottom = element.dataset.vaultKeeperPaddingBottom ?? "0";
        delete element.dataset.vaultKeeperHidden;
        delete element.dataset.vaultKeeperPaddingTop;
        delete element.dataset.vaultKeeperPaddingBottom;

        element.setCssProps({
            "--vaultKeeper-drawer-height": targetHeight + "px",
            "--vaultKeeper-drawer-padding-top": paddingTop,
            "--vaultKeeper-drawer-padding-bottom": paddingBottom,
        });
        element.removeClass("vaultKeeper-drawer-hidden");
        element.addClass("vaultKeeper-drawer-restoring");

        requestAnimationFrame(() => {
            element.removeClass("vaultKeeper-drawer-restoring");
            element.addClass("vaultKeeper-drawer-expanding");
        });

        element.addEventListener("transitionend", () => {
            element.removeClass("vaultKeeper-drawer-expanding");
        }, { once: true });
    }
}

function getDrawerElements(): NodeListOf<HTMLElement> {
    return activeDocument.querySelectorAll<HTMLElement>(".workspace-drawer-header, .workspace-drawer-tab-options");
}
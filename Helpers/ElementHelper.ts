import { setIcon } from "obsidian";

export function getOuterHeight(element: HTMLElement): number {
    const marginTop = parseFloat(getComputedStyle(element).marginTop) || 0;
    const marginBottom = parseFloat(getComputedStyle(element).marginBottom) || 0;
    return element.offsetHeight + marginTop + marginBottom;
}

export function setElementIcon(element: HTMLElement, iconName: string) {
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

export function hideDrawerElements(origin: HTMLElement) {
    for (const element of getDrawerElements(origin)) {
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

        window.requestAnimationFrame(() => {
            element.removeClass("vaultKeeper-drawer-hiding");
            element.addClass("vaultKeeper-drawer-collapsed");
        });

        element.addEventListener("transitionend", () => {
            element.removeClass("vaultKeeper-drawer-collapsed");
            element.addClass("vaultKeeper-drawer-hidden");
        }, { once: true });
    }
}

export function restoreDrawerElements(origin: HTMLElement) {
    for (const element of getDrawerElements(origin)) {
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

        window.requestAnimationFrame(() => {
            element.removeClass("vaultKeeper-drawer-restoring");
            element.addClass("vaultKeeper-drawer-expanding");
        });

        element.addEventListener("transitionend", () => {
            element.removeClass("vaultKeeper-drawer-expanding");
        }, { once: true });
    }
}

// Only the drawer hosting the origin element, so other drawers (e.g. the file explorer) are never touched
function getDrawerElements(origin: HTMLElement): HTMLElement[] {
    const drawer = origin.closest<HTMLElement>(".workspace-drawer");
    if (!drawer) {
        return [];
    }
    return Array.from(drawer.querySelectorAll<HTMLElement>(".workspace-drawer-header, .workspace-drawer-tab-options"));
}
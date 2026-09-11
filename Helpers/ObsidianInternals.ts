import type VaultkeeperAIPlugin from "main";
import type { EventRef, MetadataCache } from "obsidian";

interface IInternalMetadataCache {
    onCleanCache(callback: () => Promise<void>): EventRef;
}

export function openPluginSettings(plugin: VaultkeeperAIPlugin) {
    if (!("setting" in plugin.app) || typeof plugin.app.setting !== "object" || plugin.app.setting === null) {
        return;
    }

    if ("open" in plugin.app.setting) {
        // @ts-expect-error - accessing internal API
        plugin.app.setting.open();
    }
    if ("openTabById" in plugin.app.setting) {
        // @ts-expect-error - accessing internal API
        plugin.app.setting.openTabById(plugin.manifest.id);
    }
}

export function closePluginSettings(plugin: VaultkeeperAIPlugin) {
    if (!("setting" in plugin.app) || typeof plugin.app.setting !== "object" || plugin.app.setting === null) {
        return;
    }

    if ("close" in plugin.app.setting) {
        // @ts-expect-error - accessing internal API
        plugin.app.setting.close();
    }
}

export function onMetaDataCacheReady(plugin: VaultkeeperAIPlugin, action: () => Promise<void>) {
    const metaDataCache = plugin.app.metadataCache;
    
    let eventReference: EventRef;

    if ("onCleanCache" in metaDataCache) {
        const internalMetaDataCache = metaDataCache as MetadataCache & IInternalMetadataCache;
        eventReference = internalMetaDataCache.onCleanCache(async () => {
            internalMetaDataCache.offref(eventReference);
            await action();
        });
    } else {
        eventReference = metaDataCache.on("resolved", async () => {
            metaDataCache.offref(eventReference);
            await action();
        });
    }

    plugin.registerEvent(eventReference);
}
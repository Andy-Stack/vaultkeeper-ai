<script lang="ts">
	import type VaultkeeperAIPlugin from "main";
	import { setIcon } from "obsidian";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import { onMount } from "svelte";
	import type { AssetsService } from "Services/AssetsService";
	import type { IDocumentReport } from "../DocumentValidation/IDocumentReport";

	export let report: IDocumentReport;
	export let onClose: () => void;

	const plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
	const assetsService: AssetsService = Resolve<AssetsService>(Services.AssetsService);

	let closeButton: HTMLButtonElement;

	// $: if (closeButton) {
	// 	setIcon(closeButton, 'circle-x');
	// }

	onMount(() => {
	});
</script>

<div class="about-modal-container">
	
</div>

<style>
	
</style>

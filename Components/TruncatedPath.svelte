<script lang="ts">
	import { basename, dirname } from "path-browserify";

	export let path: string | undefined;

	$: fullPath = path ?? "";
	$: directory = dirname(fullPath);
	$: fileName = basename(fullPath);
</script>

<span class="truncated-path" title={fullPath}>
	{#if directory}
		<span class="truncated-path-directory">{directory}</span>
	{/if}
	<span class="truncated-path-name">{fileName}</span>
</span>

<style>
	.truncated-path {
		display: inline-flex;
		max-width: 100%;
		min-width: 0;
		vertical-align: bottom;
		white-space: nowrap;
	}

	.truncated-path-directory {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.truncated-path-name {
		flex: 0 0 auto;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>

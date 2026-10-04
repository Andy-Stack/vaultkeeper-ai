<script lang="ts">
	import { DiffState } from "Enums/DiffState";

	export let state: DiffState;
</script>

<span
	class="status-dot"
	aria-hidden="true"
	class:secondary={state === DiffState.None}
	class:green={state === DiffState.Accepted}
	class:red={state === DiffState.Rejected}
	class:accent={state === DiffState.Suggestion}>
</span>

<style>
	.status-dot {
		flex-shrink: 0;
		align-self: center;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		transition: background-color 0.2s ease-out;
	}

	.green {
		background-color: #46874a;
	}

	.red {
		background-color: #aa4646;
	}

	.accent {
		background-color: var(--color-accent);
	}

	.secondary {
		background-color: var(--background-secondary-alt);
	}
</style>

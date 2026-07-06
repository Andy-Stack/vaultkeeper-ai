<script lang="ts">
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import type { ExecutionPlan } from "Types/ExecutionPlan";

	export let plan: ExecutionPlan;

	const streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);

	function instructionRenderAction(element: HTMLElement, instruction: string) {
		streamingMarkdownService.render(instruction, element, true);
		return {
			update(newInstruction: string) {
				streamingMarkdownService.render(newInstruction, element, true);
			}
		};
	}
</script>

<div id="plan-approval-container">
	{#each plan.executionSteps as step, index}
		<div class="plan-approval-step">
			<h3 class="plan-approval-step-heading">{`${index + 1}. ${step.description}`}</h3>
			<div class="plan-approval-step-instruction" use:instructionRenderAction={step.instruction}></div>
		</div>
	{/each}
</div>

<style>
	#plan-approval-container {
		max-width: 800px;
		margin: 0 auto;
		padding: var(--size-4-4);
	}

	.plan-approval-step {
		margin-bottom: var(--size-4-6);
	}

	.plan-approval-step-heading {
		margin-bottom: var(--size-4-2);
	}
</style>

<script lang="ts">
	import { ExecutionStatus } from "Enums/ExecutionStatus";
	import { setElementIcon } from "Helpers/ElementHelper";
	import Spinner from "./Spinner.svelte";
	import { tick } from "svelte";
	import { fade, slide } from "svelte/transition";
	import type { IExecutionPlanState } from "Stores/ExecutionPlanStore";
	import type { Writable } from "svelte/store";

    export let executionPlanState: Writable<IExecutionPlanState>;
    export let editModeActive = false;
    export let busyPlanning = false;

    let expanded = false;
    let expandedHeight = 0;
    let collapsedHeight = 0;

    let wrapperDiv: HTMLDivElement;
    let contentDiv: HTMLDivElement;
    let stepElements: (HTMLDivElement | null)[] = [];
    let isTransitioning = false;

    $: steps = $executionPlanState.plan?.executionSteps;
    $: activeStepIndex = steps?.findIndex(step => step.status === ExecutionStatus.Active) ?? -1;

    // Step measurements for height calculations
    $: stepHeight = stepElements[0]?.offsetHeight ?? 0;
    $: separatorHeight = stepElements[0]?.nextElementSibling?.clientHeight ?? 0;

    $: if (steps) {
        tick().then(updateHeight);
        setTimeout(updateHeight, 500);
    }

    $: if (activeStepIndex >= 0 && !isTransitioning) {
        scrollToActiveStep();
    }

    $: if (wrapperDiv && expanded !== undefined) {
        handleExpandTransition();
    }

    function handleExpandTransition() {
        isTransitioning = true;
        const onTransitionEnd = () => {
            isTransitioning = false;
            wrapperDiv.removeEventListener('transitionend', onTransitionEnd);
            scrollToActiveStep();
        };
        wrapperDiv.addEventListener('transitionend', onTransitionEnd);
    }

    async function updateHeight() {
        if (!contentDiv || stepElements.length === 0) {
            return;
        }

        expandedHeight = contentDiv.scrollHeight;

        const stepsToShow = Math.min(3, stepElements.length);
        collapsedHeight = (stepsToShow * stepHeight) + (Math.max(0, stepsToShow - 1) * separatorHeight); 
    }

    async function scrollToActiveStep() {
        if (!wrapperDiv || !$executionPlanState.plan || activeStepIndex === -1) return;

        await tick();
        const stepElement = stepElements[activeStepIndex];
        if (!stepElement) return;

        const stepTop = stepElement.offsetTop;
        const stepHeight = stepElement.offsetHeight;
        const wrapperHeight = wrapperDiv.clientHeight;
        const scrollTo = stepTop - (wrapperHeight / 2) + (stepHeight / 2);

        wrapperDiv.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }

    function toggleExpand() {
        expanded = !expanded;
    }
</script>

{#if busyPlanning}
    <div id="chat-planning-in-progress" transition:slide>
        <Spinner {editModeActive}/>
        <span id="chat-planning-in-progress-text">Planning in progress...</span>
    </div>
{/if}
{#if steps && steps?.length > 0}
    <div id="chat-plan-area"
         out:slide
         on:click={toggleExpand}
         on:keydown={(e) => e.key === 'Enter' && toggleExpand()}
         aria-label={expanded ? "Collapse planned steps" : "Expand planned steps"}
         role="button"
         tabindex=0>
        <div id="chat-plan-steps-wrapper" style:height="{expanded ? expandedHeight : collapsedHeight}px" bind:this={wrapperDiv}>
            <div id="chat-plan-steps" bind:this={contentDiv}>
                {#each steps as step, index }
                    <div class="chat-plan-step" bind:this={stepElements[index]}>
                        {#if step.status === ExecutionStatus.Completed}
                            <div class="chat-plan-step-icon" use:setElementIcon={"circle-check"} style:color="var(--color-green)"></div>
                        {/if}
                        {#if step.status === ExecutionStatus.Active}
                            <div class="chat-plan-step-icon">
                                <Spinner {editModeActive}/>
                            </div>
                        {/if}
                        {#if step.status === ExecutionStatus.Pending}
                            <div class="chat-plan-step-icon" use:setElementIcon={"circle"} style:opacity={0.5}></div>
                        {/if}
                        <span class="chat-plan-step-span">
                            {`${step.step}. ${step.description}`}
                        </span>
                    </div>
                    {#if index < steps.length - 1}
                        <div class="chat-plan-step-icon"
                             use:setElementIcon={"ellipsis-vertical"}
                             style:opacity={step.status === ExecutionStatus.Completed ? 1 : 0.25}>
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
        {#if steps.length > 2}
            <div class="chat-plan-fade top-fade" transition:fade></div>
            <div class="chat-plan-fade bottom-fade" transition:fade></div>
        {/if}
        <div id="chat-plan-chevron"
            class="transparent-button"
            use:setElementIcon={expanded ? "chevrons-down-up" : "chevrons-up-down"}>
        </div>
    </div>
{/if}

<style>
    #chat-planning-in-progress {
        display: flex;
        gap: var(--size-4-2);
        background-color: var(--background-secondary-alt);
        border-radius: var(--radius-m);
        padding: var(--size-4-2);
        font-style: italic;
        font-size: var(--font-smaller);
        justify-content: center;
    }

    #chat-planning-in-progress-text {
        max-width: 90%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    #chat-plan-area {
        grid-row: 1;
        grid-column: 1;
        display: grid;
        grid-template-rows: auto;
        grid-template-columns: 1fr auto;
        background-color: var(--background-secondary-alt);
        border-radius: var(--radius-m);
        padding: var(--size-4-1) var(--size-4-2);
        cursor: pointer;
        position: relative;
    }

    #chat-plan-steps-wrapper {
        grid-row: auto;
        grid-column: 1;
        transition: height 0.2s ease-out;
        overflow-x: hidden;
        overflow-y: auto;
        scroll-behavior: smooth;
        max-height: 20vh;
    }

    #chat-plan-steps-wrapper::-webkit-scrollbar {
		display: none;
	}

    #chat-plan-steps {
        position: relative;
        display: flex;
        flex-direction: column;
        font-size: var(--font-smallest);
        width: 100%;
    }

    .chat-plan-step {
        display: flex;
        align-items: center;
    }

    .chat-plan-step-span {
        max-width: 90%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .chat-plan-step-icon {
        display: flex;
        align-items: center;
        padding-right: var(--size-4-2);
    }

    #chat-plan-chevron {
        grid-row: auto;
        grid-column: 2;
        display: flex;
		align-items: center;
		justify-content: center;
    }

    .chat-plan-fade {
        position: absolute;
        left: 0;
        right: 0;
        height: var(--size-4-1);
        border-radius: var(--radius-m);
        pointer-events: none;
        z-index: 1;
    }

    .top-fade {
        top: var(--size-4-1);
        background-image: linear-gradient(to bottom, var(--background-secondary-alt), transparent);
    }

    .bottom-fade {
        bottom: var(--size-4-1);
        background-image: linear-gradient(to top, var(--background-secondary-alt), transparent);
    }
</style>
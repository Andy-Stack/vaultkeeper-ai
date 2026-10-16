<script lang="ts">
  import { Platform } from "obsidian";
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import type { WorkSpaceService } from "Services/WorkSpaceService";
  import { tick } from "svelte";
  import { VIEW_TYPE_PLAN_APPROVAL } from "Views/PlanApprovalView";

  export let planApprovalOpen = false;

  const workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);

  let contentDiv: HTMLDivElement;
  let height = 0;

  $: planApprovalOpen, updateHeight();

  function updateHeight() {
    tick().then(() => {
      if (contentDiv) {
        height = contentDiv.scrollHeight;
      }
    });
  }

  async function focusPlanApproval() {
    await workSpaceService.revealLeafOfType(VIEW_TYPE_PLAN_APPROVAL);
  }
</script>

<div id="plan-approval-controls-wrapper" style:height="{height}px">
  <div id="plan-approval-controls" bind:this={contentDiv}>
    {#if planApprovalOpen}
      <div id="plan-approval-controls-center">
        <span id="plan-approval-controls-label">A proposed plan is waiting for your review.</span>
        {#if Platform.isPhone}
          <button class="plan-approval-controls-link transparent-button" onclick={focusPlanApproval}>Review plan</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  #plan-approval-controls-wrapper {
    transition: height 0.2s ease-out;
    overflow: hidden;
  }

  #plan-approval-controls {
    display: flex;
    font-size: var(--font-smaller);
  }

  #plan-approval-controls-center {
    display: flex;
    flex-direction: column;
    margin: auto;
    padding-top: var(--size-4-2);
  }

  #plan-approval-controls-label {
    font-style: italic;
    color: var(--text-muted);
  }

  .plan-approval-controls-link {
    color: var(--color-accent-1);
    text-decoration: underline;
    padding: 0;
    cursor: pointer;
  }
</style>

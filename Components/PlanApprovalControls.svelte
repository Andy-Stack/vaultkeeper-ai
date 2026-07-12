<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import type { PlanApprovalService } from "Services/PlanApprovalService";
  import { Services } from "Services/Services";
  import { Copy } from "Enums/Copy";
  import { tick } from "svelte";

  export let planApprovalOpen = false;

  const planApprovalService: PlanApprovalService = Resolve<PlanApprovalService>(Services.PlanApprovalService);

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
</script>

<div id="plan-approval-controls-wrapper" style:height="{height}px">
  <div id="plan-approval-controls" bind:this={contentDiv}>
    {#if planApprovalOpen}
      <button
        id="plan-approve"
        class="plan-approval-button"
        aria-label={Copy.ButtonApprove}
        on:click={() => planApprovalService.onApprove()}>
        {Copy.ButtonApprove}
      </button>
      <button
        id="plan-reject"
        class="plan-approval-button"
        aria-label={Copy.ButtonReject}
        on:click={() => planApprovalService.onReject()}>
        {Copy.ButtonReject}
      </button>
    {/if}
  </div>
</div>

<style>
  #plan-approval-controls-wrapper {
    transition: height 0.2s ease-out;
    overflow: hidden;
  }

  #plan-approval-controls {
    display: grid;
    grid-template-columns: 1fr var(--size-4-2) 1fr;
    grid-template-rows: auto;
  }

  #plan-approve {
    grid-column: 1;
    color: white;
    background-color: #38533a;
  }

  #plan-approve:hover {
    background-color: #537555;
  }

  #plan-approve:focus {
    background-color: #537555;
  }

  #plan-reject {
    grid-column: 3;
    color: white;
    background-color: #593030;
  }

  #plan-reject:hover {
    background-color: #774545;
  }

  #plan-reject:focus {
    background-color: #774545;
  }

  .plan-approval-button {
    transition: background-color 0.2s ease-out;
  }
</style>

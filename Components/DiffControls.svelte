<script lang="ts">
  import { Resolve } from "Services/DependencyService";
  import type { DiffService } from "Services/DiffService";
  import { Services } from "Services/Services";

  const diffService: DiffService = Resolve<DiffService>(Services.DiffService);
</script>

<div id="diff-controls">
  <button
    id="diff-accept"
    class="diff-button"
    aria-label="Accept"
    on:click={() => diffService.onAccept()}>
    Accept
  </button>
  <button
    id="diff-reject"
    class="diff-button"
    aria-label="Reject"
    on:click={() => diffService.onReject()}>
    Reject
  </button>
</div>

<style>
  #diff-controls {
      display: grid;
      grid-template-columns: 1fr var(--size-4-2) 1fr;
      grid-template-rows: auto;
  }

  #diff-accept {
      grid-column: 1;
      background-color: color-mix(
          in srgb,
          var(--color-green) 75%,
          var(--background-primary) 25%
      );
  }

  #diff-accept:hover {
      background-color: var(--color-green);
  }

  #diff-accept:focus {
      background-color: var(--color-green);
  }

  #diff-reject {
      grid-column: 3;
      background-color: color-mix(
          in srgb,
          var(--color-red) 75%,
          var(--background-primary) 25%
      );
  }

  #diff-reject:hover {
      background-color: var(--color-red);
  }

  #diff-reject:focus {
      background-color: var(--color-red);
  }

  .diff-button {
      border-radius: var(--button-radius);
      transition-duration: 0.5s;
  }
</style>
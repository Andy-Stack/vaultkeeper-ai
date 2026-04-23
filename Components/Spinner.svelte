<script lang="ts">
  export let width: string = "18px";
  export let height: string = "18px";
  export let background: string = "var(--background-primary)";
  export let spinnerElement: HTMLDivElement | undefined = undefined;
</script>

<div
  class="circle-border"
  style="width: {width}; height: {height};"
  bind:this={spinnerElement}
>
  <div class="circle-core" style:background={background}></div>
</div>

<style>
  @keyframes spin {
    from {
      transform: rotate(0);
    }
    to {
      transform: rotate(359deg);
    }
  }

  .circle-border {
    padding: 1px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    flex-shrink: 0;
    --color: var(--interactive-accent);
    background: var(--color);
    background: linear-gradient(
      0deg,
      color-mix(in srgb, var(--color) 10%, transparent) 33%,
      var(--color) 100%
    );
    animation: spin 0.8s linear 0s infinite;
  }

  .circle-core {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }
</style>

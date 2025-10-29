<script lang="ts">
  export let streamingElement: HTMLElement | undefined;
  export let editModeActive: boolean = false;
</script>

<div class="loader" class:edit-mode={editModeActive} bind:this={streamingElement}>
  <div class="circle">
    <div class="dot"></div>
    <div class="outline"></div>
  </div>
  <div class="circle">
    <div class="dot"></div>
    <div class="outline"></div>
  </div>
  <div class="circle">
    <div class="dot"></div>
    <div class="outline"></div>
  </div>
  <div class="circle">
    <div class="dot"></div>
    <div class="outline"></div>
  </div>
</div>

<style>
  /* From Uiverse.io by Li-Deheng */ 
  .loader {
    display: flex;
    justify-content: left;
    align-items: center;
    --color: var(--interactive-accent);
    --animation: 2s ease-in-out infinite;
  }

  .loader.edit-mode {
    --color: var(--alt-interactive-accent);
  }

  .loader .circle {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 10px;
    height: 10px;
    border: solid 1px var(--color);
    border-radius: 50%;
    margin: 0 5px;
    background-color: transparent;
    animation: circle-keys var(--animation);
    animation-fill-mode: backwards;
  }

  .loader .circle .dot {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color);
    animation: dot-keys var(--animation);
    animation-fill-mode: backwards;
  }

  .loader .circle .outline {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    animation: outline-keys var(--animation);
    animation-fill-mode: backwards;
  }

  .circle:nth-child(2) {
    animation-delay: 0.3s;
  }

  .circle:nth-child(3) {
    animation-delay: 0.6s;
  }

  .circle:nth-child(4) {
    animation-delay: 0.9s;
  }

  .circle:nth-child(5) {
    animation-delay: 1.2s;
  }

  .circle:nth-child(2) .dot {
    animation-delay: 0.3s;
  }

  .circle:nth-child(3) .dot {
    animation-delay: 0.6s;
  }

  .circle:nth-child(4) .dot {
    animation-delay: 0.9s;
  }

  .circle:nth-child(5) .dot {
    animation-delay: 1.2s;
  }

  .circle:nth-child(1) .outline {
    animation-delay: 0.9s;
  }

  .circle:nth-child(2) .outline {
    animation-delay: 1.2s;
  }

  .circle:nth-child(3) .outline {
    animation-delay: 1.5s;
  }

  .circle:nth-child(4) .outline {
    animation-delay: 1.8s;
  }

  .circle:nth-child(5) .outline {
    animation-delay: 2.1s;
  }

  @keyframes circle-keys {
    0% {
      transform: scale(1);
      opacity: 1;
    }

    50% {
      transform: scale(1.5);
      opacity: 0.5;
    }

    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes dot-keys {
    0% {
      transform: scale(1);
    }

    50% {
      transform: scale(0);
    }

    100% {
      transform: scale(1);
    }
  }

  @keyframes outline-keys {
    0% {
      transform: scale(0);
      outline: solid 10px var(--color);
      outline-offset: 0;
      opacity: 1;
    }

    100% {
      transform: scale(1);
      outline: solid 0 transparent;
      outline-offset: 10px;
      opacity: 0;
    }
  }
</style>
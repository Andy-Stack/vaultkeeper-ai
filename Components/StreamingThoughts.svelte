<script lang="ts">
  import { slide } from "svelte/transition";
  
  export let isIdle: boolean = false;
  export let isSubmitting: boolean = false;
  export let streamingThoughts: string = "";

  let thoughtText: string = "";

  $: resetThoughtsOnResume(isIdle);
  $: resetThoughtsOnSubmit(isSubmitting);
  $: appendThoughts(streamingThoughts);

  function resetThoughtsOnResume(isIdle: boolean) {
    if (!isIdle) {
        thoughtText = "";
    }
  }

  function resetThoughtsOnSubmit(_: boolean) {
    thoughtText = "";
  }

  function appendThoughts(thoughts: string) {
    thoughtText += thoughts;
  }

</script>

{#if !isIdle && thoughtText.length > 0}
  <div id="streaming-thoughts-container" in:slide out:slide={{duration: 1000}}>
    <span id="streaming-thoughts-label">{thoughtText}</span>
    <div id="streaming-thoughts-fade"></div>
  </div>
{/if}

<style>

  #streaming-thoughts-container {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;
    margin-top: var(--size-2-2);
    padding-right: 5%;
    font-size: var(--font-smaller);
    line-height: 1.5;
    height: 3em;
  }

  #streaming-thoughts-label {
    color: var(--text-muted);
  }

  #streaming-thoughts-fade {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3em;
    pointer-events: none;
    background-image: linear-gradient(to bottom, var(--background-secondary), transparent);
  }

</style>
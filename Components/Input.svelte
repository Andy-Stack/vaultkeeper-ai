<script lang="ts">
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { IActioner } from "Actioner/IActioner";
	import type { IAIClass } from "AIClasses/IAIClass";

  interface Props {
    input: string;
  }

  let {
    input
  }: Props = $props();

  let output: string = $state("");

  async function submit() {
    let aiClass: IAIClass = Resolve(Services.IAIClass)
    let actioner: IActioner = Resolve(Services.IActioner);

    let aiResponse: Part[] | null = await aiClass.apiRequest(input, actioner);

    if (aiResponse == null) {
      throw "Response was invalid JSON";
    }

    for (let part of aiResponse) {
      if (part.functionCall) {
        let functionName: string = part.functionCall.name;
        let functionObject: object = part.functionCall.args;

        await actioner[Symbol.for(functionName)](functionObject);
      };
    }

    output = `Done: ${aiResponse}`
  }
</script>
  
<div class="container">
  <input
    type="string"
    bind:value={input}
    placeholder="Enter a prompt"
    aria-label="Enter a prompt"
  />
  <button onclick={submit}>Submit</button>

  <p>{output}</p>
</div>
  
<style>
  .container {
    display: flex;
    background-color: hotpink;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 200px;
  }

  input {
    padding: 0.4rem;
    font-size: 1rem;
  }

  button {
    background: #0066ff;
    color: white;
    border: none;
    padding: 0.4rem;
    cursor: pointer;
  }

  button:hover {
    background: #0055dd;
  }
</style>
<script lang="ts">
  import { onDestroy } from "svelte";
  import type { EventRef } from "obsidian";
  import { Resolve } from "Services/DependencyService";
  import { Services } from "Services/Services";
  import type { EventService } from "Services/EventService";
  import { Event } from "Enums/Event";
  import ThoughtSteps, { type ThoughtStep } from "./ThoughtSteps.svelte";

  const eventService: EventService = Resolve<EventService>(Services.EventService);

  let steps: ThoughtStep[] = [];

  // Calls in a batch run one at a time, so a new thought means the previous one has finished
  const thoughtUpdateRef: EventRef = eventService.on(Event.ThoughtUpdate, (thought?: string) => {
    steps = steps.map(step => ({ ...step, isComplete: true }));
    if (thought) {
      steps = [...steps, { thought, isComplete: false }];
    }
  });

  onDestroy(() => {
    eventService.offref(thoughtUpdateRef);
  });
</script>

<ThoughtSteps {steps} isLive={true}/>

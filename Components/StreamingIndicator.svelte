<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  export let isIdle: boolean = false;
  export let streamingIndicatorElement: HTMLElement | undefined = undefined;

  type DotShape = { x: number; y: number; radius: number };

  interface Animation {
    shapeDot: (dotIndex: number, time: number) => DotShape;
  }

  const DOT_COUNT = 3;
  const TRANSITION_DURATION_MS = 700;
  const MAX_FRAME_SECONDS = 0.05;
  const MIN_ACTIVE_SWAP_MS = 2000;
  const MAX_ACTIVE_SWAP_MS = 7000;
  const TUMBLE_STEP_SECONDS = 0.6;
  const TUMBLE_STEP_RADIANS = (Math.PI * 2) / DOT_COUNT;
  const TUMBLE_RING_RADIUS = 16;

  // Each animation's centre x is chosen so its widest leftmost dot edge sits at x = 28, the viewBox's left edge
  const dotBounce: Animation = {
    shapeDot: (dotIndex, time) => {
      const bounceHeight = Math.abs(Math.sin(time * Math.PI * 1.4 - dotIndex * 0.45));
      return { x: 68 + (dotIndex - 1) * 30, y: 116 - bounceHeight * 32, radius: 10 };
    }
  };

  const beadSplit: Animation = {
    shapeDot: (dotIndex, time) => {
      const spread = 19 + 11 * Math.sin(time * 2.2);
      return {
        x: 69 + (dotIndex - 1) * spread,
        y: 100 + Math.sin(time * 2.2 + dotIndex * 0.9) * 6,
        radius: 11
      };
    }
  };

  const tumble: Animation = {
    shapeDot: (dotIndex, time) => {
      const stepProgress = time / TUMBLE_STEP_SECONDS;
      const completedSteps = Math.floor(stepProgress);
      const easedStep = completedSteps + easeInOutCubic(stepProgress - completedSteps);
      const angle = -Math.PI / 2 + (easedStep + dotIndex) * TUMBLE_STEP_RADIANS;
      return {
        x: 69 + Math.cos(angle) * TUMBLE_RING_RADIUS,
        y: 100 + Math.sin(angle) * TUMBLE_RING_RADIUS,
        radius: 9
      };
    }
  };

  const breathe: Animation = {
    shapeDot: (dotIndex, time) => ({
      x: 64 + (dotIndex - 1) * 26,
      y: 100,
      radius: 6 + 4 * (0.5 + 0.5 * Math.sin(time * 1.6))
    })
  };

  const activeAnimations = [dotBounce, beadSplit, tumble];

  let currentAnimation: Animation = dotBounce;
  let dots: DotShape[] = shapeAllDots(currentAnimation, 0);

  let transitionStartDots: DotShape[] | undefined;
  let transitionStartTimestamp = 0;

  let animationTime = 0;
  let lastFrameTimestamp = 0;
  let animationFrameId: number | undefined;
  let activeSwapTimeout: ReturnType<typeof setTimeout> | undefined;

  $: applyIdleState(isIdle);

  function applyIdleState(idle: boolean) {
    clearTimeout(activeSwapTimeout);
    if (idle) {
      switchAnimation(breathe);
      return;
    }
    switchAnimation(dotBounce);
    scheduleActiveSwap();
  }

  function scheduleActiveSwap() {
    const delay = MIN_ACTIVE_SWAP_MS + Math.random() * (MAX_ACTIVE_SWAP_MS - MIN_ACTIVE_SWAP_MS);
    activeSwapTimeout = setTimeout(() => {
      const otherAnimations = activeAnimations.filter(animation => animation !== currentAnimation);
      switchAnimation(otherAnimations[Math.floor(Math.random() * otherAnimations.length)]);
      scheduleActiveSwap();
    }, delay);
  }

  function switchAnimation(animation: Animation) {
    if (animation === currentAnimation) {
      return;
    }
    transitionStartDots = dots.map(dot => ({ ...dot }));
    transitionStartTimestamp = performance.now();
    currentAnimation = animation;
  }

  function shapeAllDots(animation: Animation, time: number): DotShape[] {
    return Array.from({ length: DOT_COUNT }, (_, dotIndex) => animation.shapeDot(dotIndex, time));
  }

  function easeInOutCubic(progress: number): number {
    return progress < 0.5 ? 4 * progress ** 3 : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }

  function interpolate(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
  }

  function renderFrame(timestamp: number) {
    animationTime += Math.min(MAX_FRAME_SECONDS, (timestamp - lastFrameTimestamp) / 1000);
    lastFrameTimestamp = timestamp;

    const targetDots = shapeAllDots(currentAnimation, animationTime);

    if (transitionStartDots) {
      const progress = Math.min(1, (timestamp - transitionStartTimestamp) / TRANSITION_DURATION_MS);
      const eased = easeInOutCubic(progress);
      const startDots = transitionStartDots;
      dots = targetDots.map((target, dotIndex) => ({
        x: interpolate(startDots[dotIndex].x, target.x, eased),
        y: interpolate(startDots[dotIndex].y, target.y, eased),
        radius: interpolate(startDots[dotIndex].radius, target.radius, eased)
      }));
      if (progress >= 1) {
        transitionStartDots = undefined;
      }
    } else {
      dots = targetDots;
    }

    animationFrameId = requestAnimationFrame(renderFrame);
  }

  onMount(() => {
    lastFrameTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(renderFrame);
  });

  onDestroy(() => {
    clearTimeout(activeSwapTimeout);
    if (animationFrameId !== undefined) {
      cancelAnimationFrame(animationFrameId);
    }
  });
</script>

<div class="loader" bind:this={streamingIndicatorElement}>
  <svg viewBox="28 72 82 56" aria-label="Loading" role="img">
    {#each dots as dot}
      <circle cx={dot.x.toFixed(2)} cy={dot.y.toFixed(2)} r={Math.max(0, dot.radius).toFixed(2)}/>
    {/each}
  </svg>
</div>

<style>
  .loader {
    display: flex;
    justify-content: left;
    align-items: center;
  }

  .loader svg {
    width: 24px;
    height: auto;
    overflow: visible;
  }

  .loader circle {
    fill: var(--text-muted);
  }
</style>

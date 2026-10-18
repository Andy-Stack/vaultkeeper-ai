<script lang="ts">
  import { onDestroy } from "svelte";

  export let isIdle: boolean = false;

  const WORKING_WORDS = [
    "Backlinkifying",
    "Hyperlinkling",
    "Wikilinkering",
    "Vault-rummaging",
    "Obsidianizing",
    "Frontmattering",
    "Ruminating",
    "Hmm-ing",
    "Meandering"
  ];
  const IDLE_LABEL = "Waiting for user input";
  const MIN_WORD_SWAP_MS = 10000;
  const MAX_WORD_SWAP_MS = 15000;
  const SCRAMBLE_BASE_MS = 160;
  const SCRAMBLE_PER_CHARACTER_MS = 40;
  const SCRAMBLE_TICK_MS = 50;
  const SCRAMBLE_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

  let targetLabel = "";
  let settledText = "";
  let scrambledText = "";
  let currentWord: string | undefined;
  let wordSwapTimeout: ReturnType<typeof setTimeout> | undefined;
  let scrambleFrameId: number | undefined;
  let scrambleStartTimestamp = 0;
  let lastScrambleTick = -1;

  $: applyIdleState(isIdle);

  function applyIdleState(idle: boolean) {
    clearTimeout(wordSwapTimeout);
    if (idle) {
      showLabel(IDLE_LABEL);
      return;
    }
    showNextWord();
  }

  function showNextWord() {
    currentWord = pickRandomWord();
    showLabel(`${currentWord}…`);
    const delay = MIN_WORD_SWAP_MS + Math.random() * (MAX_WORD_SWAP_MS - MIN_WORD_SWAP_MS);
    wordSwapTimeout = setTimeout(showNextWord, delay);
  }

  function pickRandomWord(): string {
    const candidates = WORKING_WORDS.filter(word => word !== currentWord);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function showLabel(label: string) {
    targetLabel = label;
    scrambleStartTimestamp = performance.now();
    lastScrambleTick = -1;
    if (scrambleFrameId === undefined) {
      scrambleFrameId = requestAnimationFrame(renderScramble);
    }
  }

  function randomLetter(): string {
    return SCRAMBLE_ALPHABET[Math.floor(Math.random() * SCRAMBLE_ALPHABET.length)];
  }

  // Letters settle left to right; unsettled ones show random letters that change every tick
  function renderScramble(timestamp: number) {
    const elapsed = Math.max(0, timestamp - scrambleStartTimestamp);
    const duration = SCRAMBLE_BASE_MS + targetLabel.length * SCRAMBLE_PER_CHARACTER_MS;

    if (elapsed >= duration) {
      settledText = targetLabel;
      scrambledText = "";
      scrambleFrameId = undefined;
      return;
    }

    const scrambleTick = Math.floor(elapsed / SCRAMBLE_TICK_MS);
    if (scrambleTick !== lastScrambleTick) {
      lastScrambleTick = scrambleTick;
      const settledCount = Math.floor((elapsed / duration) * targetLabel.length);
      settledText = targetLabel.slice(0, settledCount);
      scrambledText = [...targetLabel.slice(settledCount)]
        .map(character => (character === " " || character === "…" ? character : randomLetter()))
        .join("");
    }

    scrambleFrameId = requestAnimationFrame(renderScramble);
  }

  onDestroy(() => {
    clearTimeout(wordSwapTimeout);
    if (scrambleFrameId !== undefined) {
      cancelAnimationFrame(scrambleFrameId);
    }
  });
</script>

<span class="streaming-label" class:shining={!isIdle} role="status" aria-label={targetLabel}>
  <span aria-hidden="true">{settledText}</span>{#if scrambledText}<span class="scrambled" aria-hidden="true">{scrambledText}</span>{/if}
</span>

<style>
  .streaming-label {
    --shine-duration: 2.3s;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    white-space: nowrap;
  }

  .scrambled {
    opacity: 0.45;
  }

  .shining {
    background-image: linear-gradient(
      90deg,
      var(--text-muted) 45%,
      var(--text-normal) 50%,
      var(--text-muted) 55%
    );
    background-size: 300% 100%;
    background-repeat: no-repeat;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: shine var(--shine-duration) linear infinite;
  }

  @keyframes shine {
    from {
      background-position: 100% 0;
    }

    65%,
    to {
      background-position: 0% 0;
    }
  }
</style>

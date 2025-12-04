<!-- https://codepen.io/aybukeceylan/pen/abLNeox -->

<div class="loading-container">
  <div class="loading-text">
    <span>C</span>
    <span>A</span>
    <span>N</span>
    <span>C</span>
    <span>E</span>
    <span>L</span>
    <span>L</span>
    <span>I</span>
    <span>N</span>
    <span>G</span>
    <span>.</span>
    <span>.</span>
    <span>.</span>
  </div>
</div>

<style>
  * {
    box-sizing: border-box;
  }

  .loading-container {
    --cancelling-color: var(--text-muted);
    display: block;
    text-align: center;
    position: relative;
    color: var(--cancelling-color, currentColor);
  }

  .loading-container:before {
    content: '';
    position: absolute;
    width: 100%;
    height: 1px;
    background-color: currentColor;
    bottom: 0;
    left: 0;
    animation: movingLine 3.5s infinite ease-in-out;
  }

  @keyframes movingLine {
    0% {
      opacity: 0;
      width: 0;
    }

    23%, 80% {
      opacity: 0.8;
      width: 100%;
    }

    92% {
      width: 0;
      left: initial;
      right: 0;
      opacity: 1;
    }

    100% {
      opacity: 0;
      width: 0;
    }
  }

  .loading-text {
    font-size: 1em;
    line-height: 1.5;
    letter-spacing: 0.05em;
    margin-bottom: 0.25em;
    padding-bottom: 0.25em;
    display: flex;
    justify-content: center;
    gap: 0.1em;
  }

  .loading-text span {
    animation: moveLetters 3.5s infinite ease-in-out;
    transform: translatex(0);
    position: relative;
    display: inline-block;
    opacity: 0;
  }

  .loading-text span:nth-child(1) {
    animation-delay: 0.1s;
  }

  .loading-text span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-text span:nth-child(3) {
    animation-delay: 0.3s;
  }

  .loading-text span:nth-child(4) {
    animation-delay: 0.4s;
  }

  .loading-text span:nth-child(5) {
    animation-delay: 0.5s;
  }

  .loading-text span:nth-child(6) {
    animation-delay: 0.6s;
  }

  .loading-text span:nth-child(7) {
    animation-delay: 0.7s;
  }

  .loading-text span:nth-child(8) {
    animation-delay: 0.8s;
  }

  .loading-text span:nth-child(9) {
    animation-delay: 0.9s;
  }

  .loading-text span:nth-child(10) {
    animation-delay: 1.0s;
  }

  .loading-text span:nth-child(11) {
    animation-delay: 1.1s;
  }

  .loading-text span:nth-child(12) {
    animation-delay: 1.2s;
  }

  .loading-text span:nth-child(13) {
    animation-delay: 1.3s;
  }

  @keyframes moveLetters {
    0% {
      transform: translateX(-15vw);
      opacity: 0;
    }

    23%, 80% {
      transform: translateX(0);
      opacity: 1;
    }

    100% {
      transform: translateX(15vw);
      opacity: 0;
    }
  }
</style>
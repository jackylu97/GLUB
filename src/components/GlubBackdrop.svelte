<script lang="ts">
  const ROWS = 16;
  const line = 'glub '.repeat(40);
  const ticker = 'GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB ';
</script>

<div class="wallpaper" aria-hidden="true">
  <div class="tilt">
    {#each { length: ROWS }, i}
      <p class="row" class:reverse={i % 2 === 1} style:animation-duration="{38 + ((i * 7) % 5) * 9}s">{line}{line}</p>
    {/each}
  </div>
</div>

<div class="ticker" aria-hidden="true">
  <p class="track">{ticker}{ticker}</p>
</div>

<style>
  .wallpaper {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  }

  .tilt {
    position: absolute;
    inset: -30% -20%;
    transform: rotate(-7deg);
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }

  .row {
    margin: 0;
    white-space: nowrap;
    font-family: var(--font-display);
    font-size: 54px;
    line-height: 1;
    color: #f2b21f;
    animation: drift linear infinite;
  }

  .row.reverse {
    animation-direction: reverse;
  }

  .ticker {
    position: relative;
    height: 28px;
    background: var(--ink);
    overflow: hidden;
    border-bottom: 3px solid var(--coral);
  }

  .track {
    margin: 0;
    white-space: nowrap;
    width: max-content;
    font-family: var(--font-display);
    font-size: 15px;
    line-height: 28px;
    letter-spacing: 0.06em;
    color: var(--butter);
    animation: drift 18s linear infinite;
  }

  @media (min-width: 960px) and (max-height: 780px) {
    .ticker {
      height: 22px;
    }

    .track {
      font-size: 13px;
      line-height: 22px;
    }
  }

  @keyframes drift {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }
</style>

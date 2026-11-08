<script lang="ts">
  let { day, date, position }: { day: number; date: Date; position: string } = $props();

  const number = $derived(String(day).padStart(3, '0'));
  const dateText = $derived(
    `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })} ${date.getFullYear()}`,
  );
  const letters = ['G', 'L', 'U', 'B'];
</script>

<header class="masthead">
  <p class="mast" aria-label="Glub">
    <span class="plate" aria-hidden="true">GLUB</span>
    {#each letters as letter, i (i)}
      <span class="letter" aria-hidden="true" style:animation-delay="{i * -0.37}s">{letter}</span>
    {/each}
  </p>
  <div class="folio cond">
    <div class="top"><span class="no">No. {number}</span><span class="date">{dateText}</span></div>
    <p class="position" aria-live="polite">{position}</p>
  </div>
</header>
<div class="rule" aria-hidden="true"></div>

<style>
  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    isolation: isolate;
    padding-top: 14px;
  }

  .mast {
    position: relative;
    margin: 0;
    display: flex;
    font-family: var(--font-display);
    font-size: clamp(64px, 9.5vw, 136px);
    line-height: 0.8;
    letter-spacing: -0.02em;
    padding-right: 0.08em;
  }

  .letter {
    display: inline-block;
    transform-origin: 50% 90%;
    animation: wobble 1.9s ease-in-out infinite;
  }

  .letter:nth-of-type(odd) {
    animation-name: wobble-alt;
  }

  /* The coral printing plate never quite lines up, and twitches. */
  .plate {
    position: absolute;
    left: 0.04em;
    top: 0.03em;
    color: var(--coral);
    mix-blend-mode: multiply;
    z-index: -1;
    white-space: nowrap;
    letter-spacing: -0.02em;
    animation: misregister 0.36s steps(2) infinite;
  }

  @keyframes wobble {
    0%, 100% { transform: rotate(-4deg) scale(1, 1); }
    30% { transform: rotate(5deg) scale(1.12, 0.86) translateY(4px); }
    60% { transform: rotate(-2deg) scale(0.9, 1.14) translateY(-8px); }
  }

  @keyframes wobble-alt {
    0%, 100% { transform: rotate(5deg) scale(0.92, 1.1) translateY(-6px); }
    40% { transform: rotate(-6deg) scale(1.14, 0.88) translateY(3px); }
    70% { transform: rotate(2deg) scale(1, 1); }
  }

  @keyframes misregister {
    0% { transform: translate(0, 0); }
    50% { transform: translate(5px, -3px); }
    100% { transform: translate(-3px, 4px); }
  }

  .folio {
    flex: 0 1 320px;
    background: var(--ink);
    color: var(--butter);
    padding: 10px 14px;
    font-weight: 900;
    transform: rotate(1.5deg);
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    line-height: 1;
  }

  .no {
    font-size: 32px;
    white-space: nowrap;
  }

  .date {
    font-size: 16px;
    letter-spacing: 0.06em;
    text-align: right;
  }

  .position {
    margin: 8px 0 0;
    padding-top: 7px;
    border-top: 2px solid var(--butter);
    font-size: 22px;
    letter-spacing: 0.06em;
    color: var(--coral);
  }

  .rule {
    margin-top: 14px;
    border-top: var(--rule);
    height: 16px;
    background: radial-gradient(circle at 9px 0, var(--coral) 0 6px, var(--ink) 6px 8px, transparent 8.5px) 0 4px / 18px 10px
      repeat-x;
  }

  @media (min-width: 960px) and (max-height: 780px) {
    .mast {
      font-size: clamp(64px, 7vw, 100px);
    }

    .masthead {
      padding-top: 10px;
    }

    .rule {
      margin-top: 10px;
    }
  }

  @media (max-width: 959px) {
    .masthead {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding-top: 12px;
    }

    .mast {
      font-size: 64px;
    }

    .folio {
      flex-basis: auto;
      margin: 0;
      padding: 5px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      transform: none;
    }

    .top {
      gap: 8px;
    }

    .no,
    .date,
    .position {
      font-size: 14px;
      letter-spacing: 0.06em;
    }

    .position {
      margin: 0;
      padding: 0;
      border: 0;
      white-space: nowrap;
    }

    .rule {
      margin-top: 10px;
    }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { burst } from '../lib/fx';
  import type { Stats } from '../lib/game';
  import type { GameFish } from '../lib/types';
  import CastButton from './CastButton.svelte';

  let {
    fish,
    day,
    progress,
    stats,
    onplay,
    onarchive,
  }: {
    fish: GameFish[];
    day: number;
    progress: number;
    stats: Stats;
    onplay: () => void;
    onarchive: () => void;
  } = $props();

  const done = $derived(fish.length > 0 && progress >= fish.length);
  const label = $derived(done ? 'See results' : progress > 0 ? 'Continue' : `Play No. ${String(day).padStart(3, '0')}`);
  const detail = $derived(
    done
      ? 'Your score and the answers'
      : progress > 0
        ? `Next up: fish ${progress + 1} of ${fish.length}`
        : `${fish.length} fish, one guess each`,
  );
  const tilts = [-7, 4, -3, 8, -5];

  let heading: HTMLHeadingElement;
  onMount(() => heading?.focus());

  function play(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 34);
    onplay();
  }
</script>

<main class="home">
  <section class="pitch">
    <h1 tabindex="-1" bind:this={heading}>Five rare fish have lost their addresses.</h1>
    <p class="how">
      For each fish, study the photo and hints, then tap the world map where you think it lives. You get one pin per
      fish. A pin inside its native range scores 1,000 points; the further away it lands, the fewer points you get.
    </p>
    <div class="go"><CastButton {label} {detail} onclick={play} /></div>
    {#if day > 1}<button class="back" type="button" onclick={onarchive}>Archive: play the last 14 days</button>{/if}
    {#if stats.played > 0}
      <dl class="stats cond">
        <div><dt>Played</dt><dd>{stats.played}</dd></div>
        <div><dt>Streak</dt><dd>{stats.streak}</dd></div>
        <div><dt>Best score</dt><dd>{stats.best.toLocaleString('en-US')}</dd></div>
      </dl>
    {/if}
  </section>

  <section class="five" aria-label="Today's five fish">
    <h2 class="cond">Today's suspects</h2>
    <ol>
      {#each fish as f, i (f.id)}
        <li style:--tilt="{tilts[i % tilts.length]}deg" style:animation-delay="{i * -0.6}s">
          <img src={f.photo.src} alt="Mystery fish {i + 1}" width="240" height="160" loading="lazy" />
          <span class="num">{i + 1}</span>
          {#if i < progress}<span class="caught cond">Guessed</span>{/if}
        </li>
      {/each}
    </ol>
  </section>
</main>

<style>
  .home {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 40px;
    margin-top: 22px;
    align-items: start;
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: clamp(34px, 3.5vw, 50px);
    line-height: 1;
    animation: slam 0.9s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }

  h1:focus {
    outline: none;
  }

  .how {
    margin: 16px 0 0;
    max-width: 44ch;
    font-size: 18px;
    line-height: 1.45;
  }

  .go {
    margin-top: 20px;
    max-width: 420px;
  }

  .back {
    margin-top: 14px;
    min-height: 44px;
    padding: 0 16px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--butter);
    font-family: var(--font-cond);
    font-weight: 900;
    font-size: 17px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .back:hover {
    background: var(--coral);
    color: var(--ink);
    animation: jelly 0.55s ease-in-out infinite;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-width: 420px;
    margin: 20px 0 0;
    border-top: 3px solid var(--ink);
    border-bottom: 3px solid var(--ink);
    text-align: center;
  }

  .stats div {
    padding: 6px 0;
  }

  .stats div + div {
    border-left: 2px solid var(--ink);
  }

  dt {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  dd {
    margin: 0;
    font-size: 30px;
    font-weight: 900;
    line-height: 1;
  }

  h2 {
    margin: 0 0 14px;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.08em;
    border-bottom: 3px solid var(--ink);
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 18px 14px;
  }

  li {
    position: relative;
    grid-column: span 2;
    padding: 8px 8px 26px;
    background: var(--cel);
    border: 3px solid var(--ink);
    transform: rotate(var(--tilt));
    animation: sway 3.2s ease-in-out infinite;
  }

  li:nth-child(4) {
    grid-column: 2 / span 2;
  }

  li:hover {
    animation: spin 0.8s cubic-bezier(0.2, 1.3, 0.4, 1);
    z-index: 2;
  }

  img {
    width: 100%;
    aspect-ratio: 3 / 2;
    height: auto;
    object-fit: cover;
    border: 2px solid var(--ink);
  }

  .num {
    position: absolute;
    left: 10px;
    bottom: 3px;
    font-family: var(--font-display);
    font-size: 18px;
  }

  .caught {
    position: absolute;
    right: 8px;
    bottom: 4px;
    padding: 0 6px;
    background: var(--ink);
    color: var(--butter);
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  @keyframes sway {
    0%, 100% { transform: rotate(var(--tilt)) translateY(0); }
    50% { transform: rotate(calc(var(--tilt) * -0.6)) translateY(-6px); }
  }

  @keyframes spin {
    from { transform: rotate(var(--tilt)) scale(1); }
    to { transform: rotate(calc(var(--tilt) + 360deg)) scale(1.08); }
  }

  @media (max-width: 959px) {
    .home {
      grid-template-columns: minmax(0, 1fr);
      gap: 26px;
      margin-top: 14px;
    }

    .how {
      font-size: 16px;
    }

    ol {
      gap: 14px 10px;
    }

    .num {
      font-size: 15px;
    }
  }
</style>

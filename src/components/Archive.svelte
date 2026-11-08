<script module lang="ts">
  import type { GameFish } from '../lib/types';

  export type ArchiveEntry = {
    day: number;
    date: Date;
    fish: GameFish[];
    progress: number;
    total: number;
    done: boolean;
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  let {
    entries,
    onopen,
    onhome,
  }: { entries: ArchiveEntry[]; onopen: (day: number) => void; onhome: () => void } = $props();

  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const no = (d: number) => String(d).padStart(3, '0');
  const when = (d: Date) =>
    `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
  const tilts = [-3, 2, -1.5, 3, -2.5, 1.5, -1];

  let heading: HTMLHeadingElement;
  onMount(() => heading?.focus());
</script>

<main class="archive">
  <div class="head">
    <h1 tabindex="-1" bind:this={heading}>Archive</h1>
    <p class="sub">Play any of the last 14 days. Archive games don't count towards your streak or stats.</p>
    <button class="home" type="button" onclick={onhome}>Back to front page</button>
  </div>

  {#if entries.length === 0}
    <p class="empty">Nothing here yet. Past days will appear here from tomorrow.</p>
  {:else}
    <ol class="issues">
      {#each entries as e, i (e.day)}
        <li style:--tilt="{tilts[i % tilts.length]}deg" style:animation-delay="{i * 0.05}s">
          <button type="button" class="issue" onclick={() => onopen(e.day)}>
            <span class="top">
              <span class="mini">GLUB</span>
              <span class="no cond">No. {no(e.day)}</span>
            </span>
            <span class="date cond">{when(e.date)}</span>
            <span class="strip" aria-hidden="true">
              {#each e.fish as f (f.id)}<img src={f.photo.thumb} alt="" width="64" height="44" loading="lazy" />{/each}
            </span>
            {#if e.done}
              <span class="status done cond">{fmt(e.total)} <small>/ 5,000</small></span>
            {:else if e.progress > 0}
              <span class="status partial cond">{e.progress} of {e.fish.length} guessed</span>
            {:else}
              <span class="status unread cond">Not played</span>
            {/if}
            <span class="visually-hidden">Play No. {no(e.day)}</span>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</main>

<style>
  .archive {
    margin-top: 18px;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 20px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: clamp(30px, 3.4vw, 44px);
    line-height: 1;
    animation: slam 0.8s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }

  h1:focus {
    outline: none;
  }

  .sub {
    flex: 1 1 260px;
    margin: 0;
    font-size: 16px;
  }

  .home {
    min-height: 48px;
    padding: 0 18px;
    border: 4px dashed var(--ink);
    border-radius: 10px;
    background: var(--cel);
    font-family: var(--font-display);
    font-size: 17px;
    cursor: pointer;
  }

  .home:hover {
    animation: jelly 0.55s ease-in-out infinite;
  }

  .empty {
    font-size: 18px;
    font-weight: 700;
  }

  .issues {
    margin: 22px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 22px 18px;
  }

  li {
    transform: rotate(var(--tilt));
    animation: drop-in 0.6s cubic-bezier(0.2, 1.3, 0.4, 1) both;
  }

  @keyframes drop-in {
    from {
      transform: translateY(-60px) rotate(calc(var(--tilt) * -6));
      opacity: 0;
    }
  }

  .issue {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 12px 14px;
    text-align: left;
    background: var(--cel);
    border: 3px solid var(--ink);
    border-bottom-width: 8px;
    cursor: pointer;
  }

  .issue:hover {
    animation: jelly 0.6s ease-in-out infinite;
    background: var(--butter);
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 3px solid var(--ink);
    padding-bottom: 4px;
  }

  .mini {
    font-family: var(--font-display);
    font-size: 26px;
    line-height: 1;
  }

  .no {
    font-size: 22px;
    font-weight: 900;
  }

  .date {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }

  .strip img {
    width: 100%;
    aspect-ratio: 3 / 2;
    height: auto;
    object-fit: cover;
    border: 2px solid var(--ink);
  }

  .status {
    align-self: flex-start;
    margin-top: 4px;
    padding: 2px 10px;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .status small {
    font-size: 13px;
  }

  .done {
    background: var(--ink);
    color: var(--butter);
    transform: rotate(-3deg);
  }

  .partial {
    background: var(--coral);
    color: var(--ink);
  }

  .unread {
    border: 2px dashed var(--ink);
  }
</style>

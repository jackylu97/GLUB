<script lang="ts">
  import { onMount } from 'svelte';
  import { msUntilNextDay } from '../lib/daily';
  import { burst, reducedMotion } from '../lib/fx';
  import { total, type DayState, type Stats } from '../lib/game';
  import { BAND_LABEL, bandFor, type Band } from '../lib/score';
  import { BAND_EMOJI, shareText } from '../lib/share';
  import type { GameFish } from '../lib/types';
  import ChartMap, { type MapResult } from './ChartMap.svelte';

  /** Explains the emoji in the shared result. */
  const KEY = (Object.keys(BAND_EMOJI) as Band[]).map((b) => `${BAND_EMOJI[b]} ${BAND_LABEL[b].toLowerCase()}`).join(' · ');

  let {
    fish,
    dayState,
    stats,
    isToday,
    onhome,
    onarchive,
  }: {
    fish: GameFish[];
    dayState: DayState;
    stats: Stats;
    isToday: boolean;
    onhome: () => void;
    onarchive: () => void;
  } = $props();

  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const max = $derived(dayState.fishIds.length * 1000);
  const score = $derived(total(dayState));
  const text = $derived(
    shareText(
      dayState.day,
      dayState.guesses.map((g) => ({ km: g?.km ?? Infinity, points: g?.points ?? 0 })),
    ),
  );
  const results: MapResult[] = $derived(
    fish.flatMap((f, i) => {
      const g = dayState.guesses[i];
      return g ? [{ pin: g.pin, range: f.range, nearest: g.nearest, label: String(i + 1) }] : [];
    }),
  );

  let shown = $state(0);
  let status = $state('');
  let fallback = $state(false);
  let remaining = $state(msUntilNextDay(new Date()));
  let heading: HTMLHeadingElement;
  let textarea: HTMLTextAreaElement | undefined = $state();

  const countdown = $derived.by(() => {
    const s = Math.max(0, Math.floor(remaining / 1000));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
  });

  onMount(() => {
    heading?.focus();
    const tick = setInterval(() => (remaining = msUntilNextDay(new Date())), 1000);
    // The score spins up like a slot machine.
    let frame = 0;
    if (reducedMotion()) shown = score;
    else {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 1400);
        shown = t < 1 ? Math.round(score * (1 - (1 - t) ** 3) + (Math.random() - 0.5) * 40 * (1 - t)) : score;
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }
    return () => {
      clearInterval(tick);
      cancelAnimationFrame(frame);
    };
  });

  async function share(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      status = 'Score copied to your clipboard.';
    } catch {
      fallback = true;
      status = "Couldn't copy automatically. Select the text below and copy it.";
      queueMicrotask(() => textarea?.select());
    }
  }
</script>

<main class="summary">
  <section class="score" aria-labelledby="summary-heading">
    <h1 id="summary-heading" tabindex="-1" bind:this={heading}>{isToday ? "Today's results" : `Results for No. ${String(dayState.day).padStart(3, '0')}`}</h1>
    <p class="total cond">
      <span class="big" aria-hidden="true">{fmt(Math.max(0, shown))}</span>
      <span class="visually-hidden">{fmt(score)}</span> / {fmt(max)}
    </p>
    <div class="actions">
      <button class="share" type="button" onclick={share}>Share score</button>
      <button class="home" type="button" onclick={onhome}>Back to front page</button>
      <button class="home" type="button" onclick={onarchive}>Archive</button>
    </div>
    <p class="status" aria-live="polite">{status}</p>
    {#if fallback}
      <label class="fallback">
        <span class="visually-hidden">Share text</span>
        <textarea readonly rows="2" bind:this={textarea}>{text}</textarea>
      </label>
    {/if}
    <dl class="stats cond">
      <div><dt>Days played</dt><dd>{stats.played}</dd></div>
      <div><dt>Streak</dt><dd>{stats.streak}</dd></div>
      <div><dt>Best score</dt><dd>{fmt(stats.best)}</dd></div>
      {#if isToday}<div><dt>Next fish in</dt><dd class="clock">{countdown}</dd></div>{/if}
    </dl>
  </section>

  <div class="map">
    <ChartMap results={results} locked title="Where they live" />
  </div>

  <section class="rows-section" aria-labelledby="rows-heading">
    <h2 id="rows-heading" class="cond">Your guesses</h2>
    <ol class="rows">
      {#each fish as f, i (f.id)}
        {@const g = dayState.guesses[i]}
        <li style:animation-delay="{0.15 + i * 0.12}s">
          <span class="n">{i + 1}</span>
          <img src={f.photo.src} alt="" width="96" height="64" />
          <div class="who">
            <span class="name">{f.commonName}</span>
            <span class="where">{f.place}{f.country ? `, ${f.country}` : ''}</span>
          </div>
          <span class="cond km">{g ? (g.km === 0 ? 'In range' : `${fmt(g.km)} km`) : '—'}</span>
          <span class="cond pts">{g ? fmt(g.points) : 0}<small>{#if g}<span aria-hidden="true">{BAND_EMOJI[bandFor(g.km)]}</span>{/if} pts</small></span>
        </li>
      {/each}
    </ol>
    <p class="key">In your shared result: {KEY}</p>
    <p class="credits">
      Photos:
      {#each fish as f, i (f.id)}
        {#if i > 0}&#160;&#183;&#32;{/if}{f.photo.author},
        {#if f.photo.licenseUrl}<a href={f.photo.licenseUrl} rel="license noopener" target="_blank">{f.photo.license}</a>{:else}{f.photo.license}{/if}
      {/each}
    </p>
  </section>
</main>

<style>
  .summary {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    grid-template-areas:
      'score map'
      'rows rows';
    gap: 24px 40px;
    margin-top: 18px;
  }

  .score {
    grid-area: score;
  }

  .map {
    grid-area: map;
    animation: rise-in 0.7s var(--ease-out) 0.2s both;
  }

  .rows-section {
    grid-area: rows;
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

  .total {
    margin: 8px 0 0;
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
  }

  .big {
    display: inline-block;
    font-size: clamp(80px, 9vw, 128px);
    letter-spacing: -0.01em;
    color: var(--coral-text);
    font-variant-numeric: tabular-nums;
    animation: wobble-num 0.9s ease-in-out infinite;
  }

  @keyframes wobble-num {
    0%, 100% { transform: rotate(-2deg); }
    50% { transform: rotate(2deg) scale(1.03); }
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 16px;
  }

  .share,
  .home {
    min-height: 60px;
    padding: 0 20px;
    border: 4px solid var(--ink);
    border-radius: 12px;
    font-family: var(--font-display);
    cursor: pointer;
  }

  .share {
    flex: 1 1 140px;
    background: var(--coral);
    border-bottom-width: 10px;
    font-size: 24px;
  }

  .home {
    flex: 1 1 200px;
    background: var(--cel);
    border-style: dashed;
    font-size: 17px;
  }

  .share:hover,
  .home:hover {
    animation: jelly 0.55s ease-in-out infinite;
  }

  .share:active,
  .home:active {
    animation: none;
    transform: scale(0.95, 0.88);
  }

  .status {
    min-height: 1.4em;
    margin: 6px 0 0;
    font-weight: 700;
  }

  .fallback textarea {
    width: 100%;
    font: inherit;
    font-size: 15px;
    padding: 8px;
    border: 3px solid var(--ink);
    background: var(--cel);
    resize: none;
  }

  .stats {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    margin: 8px 0 0;
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

  .clock {
    font-variant-numeric: tabular-nums;
  }

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.06em;
    border-bottom: 3px solid var(--ink);
  }

  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li {
    display: grid;
    grid-template-columns: 24px 96px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 14px;
    padding: 8px 0;
    border-bottom: 2px solid var(--ink);
    animation: row-in 0.6s cubic-bezier(0.2, 1.3, 0.4, 1) both;
  }

  .rows li:nth-child(even) {
    animation-name: row-in-alt;
  }

  @keyframes row-in {
    from { transform: translateX(-120%) rotate(-6deg); opacity: 0; }
  }

  @keyframes row-in-alt {
    from { transform: translateX(120%) rotate(6deg); opacity: 0; }
  }

  .n {
    font-family: var(--font-display);
    font-size: 18px;
  }

  .rows img {
    width: 96px;
    height: 64px;
    object-fit: cover;
    border: 2px solid var(--ink);
  }

  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-family: var(--font-display);
    font-size: 18px;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  .where {
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .km {
    font-size: 22px;
    font-weight: 900;
    text-align: right;
    white-space: nowrap;
  }

  .pts {
    min-width: 84px;
    font-size: 26px;
    font-weight: 900;
    text-align: right;
    line-height: 1;
  }

  .pts small {
    display: block;
    font-size: 13px;
    letter-spacing: 0.06em;
  }

  .key {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .credits {
    margin: 10px 0 0;
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  @media (max-width: 959px) {
    .summary {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'score' 'map' 'rows';
      gap: 20px;
      margin-top: 12px;
    }

    .stats {
      grid-auto-flow: row;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stats div:nth-child(3) {
      border-left: 0;
    }

    .stats div:nth-child(n + 3) {
      border-top: 2px solid var(--ink);
    }

    .rows li {
      grid-template-columns: 20px 56px minmax(0, 1fr) auto;
      grid-template-areas: 'n img who pts' 'n img km pts';
      gap: 2px 10px;
    }

    .n {
      grid-area: n;
    }

    .rows img {
      grid-area: img;
      width: 56px;
      height: 44px;
    }

    .who {
      grid-area: who;
    }

    .km {
      grid-area: km;
      font-size: 16px;
      text-align: left;
    }

    .pts {
      grid-area: pts;
      min-width: 0;
      font-size: 22px;
    }
  }
</style>

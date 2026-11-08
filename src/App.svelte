<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Archive, { type ArchiveEntry } from './components/Archive.svelte';
  import CastButton from './components/CastButton.svelte';
  import ChartMap from './components/ChartMap.svelte';
  import FishPhoto from './components/FishPhoto.svelte';
  import GlubBackdrop from './components/GlubBackdrop.svelte';
  import Hints from './components/Hints.svelte';
  import Home from './components/Home.svelte';
  import Masthead from './components/Masthead.svelte';
  import Reveal from './components/Reveal.svelte';
  import Summary from './components/Summary.svelte';
  import TideTable from './components/TideTable.svelte';
  import { archiveDays, dateForDay, dayNumber, pickDaily } from './lib/daily';
  import { burst, flood, shake } from './lib/fx';
  import { applyGuess, currentIndex, newDay, recordFinish, total, type DayState } from './lib/game';
  import type { LatLng } from './lib/geo';
  import { loadDay, loadStats, saveDay, saveStats } from './lib/storage';
  import type { GameFish } from './lib/types';

  /** Issue numbers start at 1; a device clock set before launch still gets issue 1. */
  const today = Math.max(1, dayNumber(new Date()));

  let allFish: GameFish[] = [];
  let schedule: Record<string, string[]> | null = null;
  /** The issue on screen: today's, or a back issue from the archive. */
  let activeDay = $state(today);
  let fish = $state<GameFish[]>([]);
  let dayState = $state<DayState | null>(null);
  let stats = $state(loadStats());
  let view = $state<'home' | 'round' | 'summary' | 'archive'>('home');
  let archive = $state<ArchiveEntry[]>([]);
  let pin = $state<LatLng | null>(null);
  /** Index of the fish whose answer is on screen, or null while aiming. */
  let revealing = $state<number | null>(null);
  let failed = $state(false);
  let stale = $state(false);
  let announcement = $state('');
  let revealedAt = 0;
  let page: HTMLDivElement;
  let chart: ChartMap | undefined = $state();

  async function load() {
    const [all, sched] = await Promise.all([
      fetch('/data/fish.json').then((r) => {
        if (!r.ok) throw new Error(`fish.json: HTTP ${r.status}`);
        return r.json() as Promise<GameFish[]>;
      }),
      fetch('/data/schedule.json')
        .then((r) => (r.ok ? (r.json() as Promise<Record<string, string[]>>) : null))
        .catch(() => null),
    ]);
    allFish = all;
    schedule = sched;
    route();
  }

  /** The fish and progress for an issue. A day in progress keeps its own fish, even if the data changes. */
  function issue(d: number): { fish: GameFish[]; state: DayState } {
    const byId = new Map(allFish.map((f) => [f.id, f]));
    const lookup = (ids?: string[]) => {
      const found = ids?.map((id) => byId.get(id));
      return found && found.length > 0 && found.every(Boolean) ? (found as GameFish[]) : null;
    };
    const saved = loadDay(d);
    const savedFish = lookup(saved?.fishIds);
    if (saved && savedFish) return { fish: savedFish, state: saved };
    const picked = lookup(schedule?.[d]) ?? pickDaily(allFish, d);
    return { fish: picked, state: newDay(d, picked.map((f) => f.id)) };
  }

  function openDay(d: number) {
    const found = issue(d);
    fish = found.fish;
    dayState = found.state;
    activeDay = d;
    revealing = null;
    pin = null;
  }

  /** Routes: '' front page, '#archive' back issues, '#no-N' an issue (today's or a back issue). */
  async function route() {
    if (allFish.length === 0) return;
    const m = /^#no-(\d+)$/.exec(location.hash);
    const n = m ? Number(m[1]) : NaN;
    if (location.hash === '#archive') {
      openDay(today);
      archive = archiveDays(today).map((d) => {
        const { fish: f, state } = issue(d);
        const progress = currentIndex(state);
        return { day: d, date: dateForDay(d), fish: f, progress, total: total(state), done: progress >= f.length };
      });
      view = 'archive';
    } else if (n >= 1 && n <= today) {
      openDay(n);
      view = dayState && currentIndex(dayState) >= dayState.fishIds.length ? 'summary' : 'round';
    } else {
      openDay(today);
      view = 'home';
    }
    window.scrollTo({ top: 0 });
    await tick();
    if (view === 'round') document.querySelector<HTMLElement>('#round-heading')?.focus();
  }

  function go(hash: string) {
    if (location.hash === hash || (hash === '' && location.hash === '')) route();
    else location.hash = hash;
  }

  onMount(() => {
    load().catch((err) => {
      console.error(err);
      failed = true;
    });
    window.addEventListener('hashchange', route);
    // A tab left open overnight should notice that tomorrow's fish are in.
    const checkDay = () => {
      if (Math.max(1, dayNumber(new Date())) !== today) stale = true;
    };
    const timer = setInterval(checkDay, 30_000);
    document.addEventListener('visibilitychange', checkDay);
    window.addEventListener('pageshow', checkDay);
    return () => {
      clearInterval(timer);
      window.removeEventListener('hashchange', route);
      document.removeEventListener('visibilitychange', checkDay);
      window.removeEventListener('pageshow', checkDay);
    };
  });

  const index = $derived(dayState ? currentIndex(dayState) : 0);
  const done = $derived(dayState !== null && index >= dayState.fishIds.length);
  const shownIndex = $derived(revealing ?? index);
  const shown = $derived(fish[shownIndex]);
  const shownGuess = $derived(revealing !== null && dayState ? dayState.guesses[revealing] : null);
  const isToday = $derived(activeDay === today);
  const mastDay = $derived(view === 'home' || view === 'archive' ? today : activeDay);
  const position = $derived(
    view === 'home'
      ? "Today's five"
      : view === 'archive'
        ? 'Archive'
        : view === 'summary'
          ? 'Results'
          : `Fish ${shownIndex + 1} of ${fish.length || 5}`,
  );

  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const fmtCoord = (p: LatLng) =>
    `${Math.abs(p.lat).toFixed(1)}°${p.lat < 0 ? 'S' : 'N'} ${Math.abs(p.lng).toFixed(1)}°${p.lng < 0 ? 'W' : 'E'}`;

  const play = () => go(`#no-${today}`);
  const goHome = () => go('');
  const goArchive = () => go('#archive');

  function setPin(p: LatLng) {
    pin = p;
    announcement = `Pin placed at ${fmtCoord(p)}.`;
  }

  async function cast(e: MouseEvent) {
    if (!dayState || !pin || done) return;
    const i = index;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    dayState = applyGuess(dayState, pin, fish[i].range);
    saveDay(dayState);
    const g = dayState.guesses[i]!;
    const f = fish[i];
    announcement = `${g.km === 0 ? 'Inside its range' : `${fmt(g.km)} km from its range`}. ${fmt(g.points)} points. It was a ${f.commonName}, from ${f.place}.`;

    if (currentIndex(dayState) >= dayState.fishIds.length) {
      // Back issues don't count towards the streak.
      if (activeDay === today) {
        stats = recordFinish(stats, dayState);
        saveStats(stats);
      }
      // The fifth fish goes straight to the results, through a wall of glubs.
      flood(() => {
        view = 'summary';
        revealing = null;
        pin = null;
        window.scrollTo({ top: 0 });
      });
      return;
    }

    revealing = i;
    revealedAt = performance.now();
    shake(page, g.km === 0 ? 'quake-hard' : 'quake');
    await tick();
    const heading = document.querySelector<HTMLElement>('#answer-heading');
    heading?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    heading?.focus({ preventScroll: true });
  }

  async function next() {
    // The Next button appears where Cast was; ignore the second half of a double-click.
    if (performance.now() - revealedAt < 450) return;
    revealing = null;
    pin = null;
    await tick();
    document.querySelector('.round')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    chart?.focus();
  }
</script>

<GlubBackdrop />
<p class="visually-hidden" aria-live="polite">{announcement}</p>

{#if stale}
  <div class="stale" role="status">
    <span>A new day has started.</span>
    <button type="button" onclick={() => location.reload()}>Load today's fish</button>
  </div>
{/if}

<div class="page" bind:this={page}>
  <Masthead day={mastDay} date={dateForDay(mastDay)} {position} />

  {#if failed}
    <p class="notice">Today's fish didn't load. Check your connection and refresh the page.</p>
  {:else if !dayState}
    <p class="notice" aria-live="polite">Loading today's fish…</p>
  {:else if view === 'home'}
    <Home {fish} day={today} progress={index} {stats} onplay={play} onarchive={goArchive} />
  {:else if view === 'archive'}
    <Archive entries={archive} onopen={(d) => go(`#no-${d}`)} onhome={goHome} />
  {:else if view === 'summary'}
    <Summary {fish} {dayState} {stats} {isToday} onhome={goHome} onarchive={goArchive} />
  {:else if shown}
    <main class="round" class:answer={shownGuess !== null}>
      <div class="col lead">
        {#if shownGuess}
          <div class="area-a"><Reveal part="header" fish={shown} guess={shownGuess} /></div>
          <div class="area-d"><Reveal part="card" fish={shown} guess={shownGuess} /></div>
          <div class="area-p small"><FishPhoto fish={shown} revealed /></div>
        {:else}
          <h1 id="round-heading" class="area-a" tabindex="-1">Where does this fish live?</h1>
          {#key shown.id}<div class="area-p"><FishPhoto fish={shown} revealed={false} /></div>{/key}
          <div class="area-d"><Hints hints={shown.hints} /></div>
        {/if}
      </div>
      <div class="col side">
        <div class="area-m">
          {#key shown.id}
            <ChartMap
              bind:this={chart}
              pin={shownGuess ? null : pin}
              onpin={setPin}
              results={shownGuess ? [{ pin: shownGuess.pin, range: shown.range, nearest: shownGuess.nearest, label: 'Range' }] : []}
              locked={shownGuess !== null}
              frame
            />
          {/key}
        </div>
        <div class="under">
          <div class="area-t"><TideTable {fish} {dayState} active={shownIndex} /></div>
          <div class="area-c">
            {#if shownGuess}
              <CastButton label="Next fish" detail={`Fish ${shownIndex + 2} of ${fish.length}`} onclick={next} />
            {:else}
              <CastButton
                label="Submit guess"
                detail={pin ? `Pin at ${fmtCoord(pin)}. Tap the map to move it.` : 'Tap the map to place your pin'}
                disabled={!pin}
                onclick={cast}
              />
            {/if}
          </div>
        </div>
      </div>
    </main>
  {/if}
</div>

<style>
  /* Wobbling letters and swaying cards must never cause sideways scrolling. The clip lives here,
     not on body: body's overflow is applied to the whole viewport and would stop vertical scrolling. */
  .page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 28px 32px;
    overflow-x: clip;
  }

  .notice {
    margin: 40px 0;
    font-size: 20px;
    font-weight: 700;
  }

  .stale {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
    padding: 8px 16px;
    background: var(--coral);
    border-bottom: 3px solid var(--ink);
    font-weight: 800;
  }

  .stale button {
    min-height: 44px;
    padding: 0 16px;
    border: 3px solid var(--ink);
    border-radius: 8px;
    background: var(--cel);
    font-family: var(--font-display);
    cursor: pointer;
  }

  .round {
    display: grid;
    grid-template-columns: minmax(0, 572fr) minmax(0, 616fr);
    gap: 32px;
    margin-top: 14px;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: clamp(24px, 2.15vw, 31px);
    line-height: 1.05;
    text-wrap: balance;
    animation: slam 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }

  h1:focus {
    outline: none;
  }

  .area-p.small {
    max-width: 360px;
  }

  .under {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 22px;
    align-items: start;
  }

  /* Short desktop windows (a 13-inch laptop, say): tighten everything so the round fits. */
  @media (min-width: 960px) and (max-height: 780px) {
    .page {
      padding-bottom: 10px;
    }

    .round {
      gap: 24px;
      margin-top: 4px;
    }

    .page :global(.tide td),
    .page :global(.tide th) {
      padding: 1px 0;
    }

    .page :global(.tide .km) {
      font-size: 20px;
    }

    .col {
      gap: 8px;
    }

    .under {
      gap: 16px;
    }

    .page :global(.photo img) {
      aspect-ratio: 572 / 262;
    }

    .page :global(.coupon) {
      min-height: 92px;
    }
  }

  /* Phone: one column, and the order changes so the answer leads after a cast. */
  @media (max-width: 959px) {
    .page {
      padding: 0 16px 24px;
    }

    .round {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 10px;
    }

    .col,
    .under {
      display: contents;
    }

    .area-a { order: 1; }
    .area-p { order: 2; }
    .area-d { order: 3; }
    .area-m { order: 4; }
    .area-c { order: 5; }
    .area-t { order: 6; }

    .answer .area-m { order: 2; }
    .answer .area-d { order: 3; }
    .answer .area-c { order: 4; }
    .answer .area-p { order: 5; }

    /* Cast stays in reach while the chart scrolls past. */
    .area-c {
      position: sticky;
      bottom: 8px;
      z-index: 5;
    }

    /* The answer doesn't need a pinned button covering it. */
    .answer .area-c {
      position: static;
    }

    .area-p.small {
      max-width: none;
    }
  }
</style>

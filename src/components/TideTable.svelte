<script lang="ts">
  import { mapDirection } from '../lib/geo';
  import { currentIndex, type DayState } from '../lib/game';
  import type { GameFish } from '../lib/types';

  let { fish, dayState, active }: { fish: GameFish[]; dayState: DayState; active?: number } = $props();

  /** The row on screen: the fish being revealed, or the one being aimed at. */
  const current = $derived(active ?? currentIndex(dayState));
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
</script>

<section class="tide" aria-labelledby="tide-heading">
  <h2 id="tide-heading" class="cond">Your guesses</h2>
  <table>
    <thead class="visually-hidden">
      <tr><th scope="col">Fish</th><th scope="col">Distance</th><th scope="col">Direction to its range</th><th scope="col">Points</th></tr>
    </thead>
    <tbody>
      {#each fish as f, i (f.id)}
        {@const g = dayState.guesses[i]}
        <tr class:current={i === current} class:future={i > current}>
          <th scope="row" class="n">{i + 1}</th>
          {#if g}
            <td class="cond km">{g.km === 0 ? 'In range' : `${fmt(g.km)} km`}</td>
            <td class="cond way">{g.km === 0 ? '' : mapDirection(g.pin, g.nearest)}</td>
            <td class="cond pts">{fmt(g.points)}<span class="unit">pts</span></td>
          {:else if i === current}
            <td class="cond now" colspan="3">Waiting for your guess</td>
          {:else}
            <td class="cond" colspan="3">&#8212;</td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.06em;
    line-height: 1.15;
    border-bottom: 3px solid var(--ink);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  tr {
    border-bottom: 2px solid var(--ink);
  }

  tr:last-child {
    border-bottom-width: 3px;
  }

  th,
  td {
    padding: 3px 0;
    text-align: left;
    vertical-align: baseline;
  }

  .n {
    width: 28px;
    padding-left: 4px;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 16px;
  }

  td {
    font-size: 18px;
    font-weight: 700;
  }

  .km {
    font-size: 24px;
    font-weight: 900;
    line-height: 1;
  }

  .way {
    font-size: 18px;
    font-weight: 900;
  }

  .pts {
    text-align: right;
    padding-right: 4px;
    font-size: 20px;
    font-weight: 900;
  }

  .unit {
    margin-left: 0.3em;
    font-size: 14px;
    letter-spacing: 0.04em;
  }

  .current {
    background: var(--coral);
  }

  .future {
    color: var(--muted);
  }
</style>

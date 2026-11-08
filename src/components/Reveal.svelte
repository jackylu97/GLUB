<script lang="ts">
  import type { Guess } from '../lib/game';
  import { mapDirection, type Compass } from '../lib/geo';
  import type { GameFish } from '../lib/types';

  let { fish, guess, part }: { fish: GameFish; guess: Guess; part: 'header' | 'card' } = $props();

  const IUCN: Record<string, string> = {
    EW: 'Extinct in the wild',
    CR: 'Critically endangered',
    EN: 'Endangered',
    VU: 'Vulnerable',
    NT: 'Near threatened',
    DD: 'Data deficient',
    NE: 'Not evaluated',
    LC: 'Least concern',
  };

  const DIRECTION: Record<Compass, string> = {
    N: 'north',
    NE: 'northeast',
    E: 'east',
    SE: 'southeast',
    S: 'south',
    SW: 'southwest',
    W: 'west',
    NW: 'northwest',
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const home = $derived(guess.km === 0);
  const direction = $derived(DIRECTION[mapDirection(guess.pin, guess.nearest)]);
</script>

{#if part === 'header'}
  <div class="answer">
    <p class="found">It lives in</p>
    <h2 id="answer-heading" class="place" tabindex="-1">{fish.place}</h2>
    {#if fish.country}<p class="country cond">{fish.country}</p>{/if}
    <p class="result cond">
      <span class="km">{home ? 'Inside its range' : `${fmt(guess.km)} km from its range`}</span>
      <span class="pts">{fmt(guess.points)} points{home ? '' : ` · its range is ${direction} of your pin`}</span>
    </p>
    {#if home}<p class="stamp" aria-hidden="true">HOME!</p>{/if}
  </div>
{:else}
  <section class="card" aria-label="About this fish">
    <h3>{fish.commonName}</h3>
    <p class="sci">
      <i>{fish.scientificName}</i>
      {#if fish.iucn}<span class="iucn cond">{fish.iucn} &#183; {IUCN[fish.iucn] ?? fish.iucn}</span>{/if}
    </p>
    {#if fish.rangeSummary}<p class="lives"><b class="cond">Range</b> {fish.rangeSummary}</p>{/if}
    {#if fish.revealFact}<p class="fact">{fish.revealFact}</p>{/if}
  </section>
{/if}

<style>
  .answer {
    position: relative;
  }

  .found {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    line-height: 1;
    animation: rise-in 0.4s var(--ease-out) both;
  }

  .place {
    margin: 6px 0 0;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: clamp(28px, 3.3vw, 46px);
    line-height: 1;
    color: var(--coral-text);
    text-wrap: balance;
    overflow-wrap: anywhere;
    transform-origin: 0 60%;
    animation: slam 0.75s cubic-bezier(0.2, 1.4, 0.4, 1) 0.1s both;
  }

  .place:focus {
    outline: none;
  }

  .place:focus-visible {
    outline: 4px solid var(--teal-deep);
    outline-offset: 4px;
  }

  .country {
    margin: 4px 0 0;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 0.06em;
    animation: rise-in 0.5s var(--ease-out) 0.35s both;
  }

  .result {
    margin: 12px 0 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 14px;
    padding: 6px 10px;
    background: var(--ink);
    color: var(--butter);
    animation: rise-in 0.5s var(--ease-out) 0.5s both;
  }

  .km {
    font-size: 26px;
    font-weight: 900;
  }

  .pts {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--coral);
  }

  .stamp {
    position: absolute;
    right: 0;
    top: -6px;
    margin: 0;
    padding: 2px 12px;
    border: 4px solid var(--ink);
    border-radius: 8px;
    background: var(--cel);
    font-family: var(--font-display);
    font-size: 26px;
    transform: rotate(-8deg);
    animation: stamp 0.6s cubic-bezier(0.2, 1.6, 0.4, 1) 0.55s both;
  }

  @keyframes stamp {
    0% { transform: scale(4) rotate(30deg); opacity: 0; }
    100% { transform: rotate(-8deg); opacity: 1; }
  }

  .card {
    border-top: 3px solid var(--ink);
    padding-top: 10px;
    animation: rise-in 0.6s var(--ease-out) 0.6s both;
  }

  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.1;
  }

  .sci {
    margin: 4px 0 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    font-size: 15px;
  }

  .iucn {
    border: 2px solid var(--ink);
    padding: 0 6px;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0.06em;
  }

  .lives,
  .fact {
    margin: 8px 0 0;
    font-size: 15px;
    line-height: 1.4;
    max-width: 65ch;
  }

  .lives b {
    margin-right: 4px;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 0.06em;
  }

  @media (max-width: 959px) {
    .place {
      font-size: 30px;
    }

    .country {
      font-size: 16px;
    }

    .stamp {
      font-size: 20px;
    }
  }
</style>

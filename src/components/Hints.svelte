<script lang="ts">
  import type { Hint } from '../lib/types';

  let { hints }: { hints: Hint[] } = $props();
</script>

<section class="hints" aria-labelledby="hints-heading">
  <h2 id="hints-heading" class="cond">Hints</h2>
  <dl>
    {#each hints as hint, i (hint.label)}
      <div style:animation-delay="{i * 0.06}s">
        <dt class="cond">{hint.label}</dt>
        <dd>{hint.text}</dd>
      </div>
    {/each}
  </dl>
</section>

<style>
  .hints {
    border-top: 3px solid var(--ink);
    padding-top: 8px;
  }

  h2 {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 0.06em;
    line-height: 1;
  }

  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 15px;
    line-height: 1.3;
  }

  div {
    display: grid;
    grid-template-columns: 66px minmax(0, 1fr);
    column-gap: 10px;
    animation: rise-in 0.5s var(--ease-out) both;
  }

  dt {
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0.06em;
    line-height: 1.4;
    text-transform: uppercase;
    color: var(--teal-deep);
  }

  dd {
    margin: 0;
  }

</style>

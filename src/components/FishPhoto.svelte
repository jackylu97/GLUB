<script lang="ts">
  import type { GameFish } from '../lib/types';

  let { fish, revealed }: { fish: GameFish; revealed: boolean } = $props();
</script>

<figure class="photo">
  <img
    src={fish.photo.src}
    alt={revealed ? `Photo of a ${fish.commonName.toLowerCase()}` : "Photo of today's mystery fish"}
    width="1280"
    height="945"
  />
  <figcaption class:over={!revealed}>
    {#snippet credit()}
      Photo: {fish.photo.author},
      {#if fish.photo.licenseUrl}<a href={fish.photo.licenseUrl} rel="license noopener" target="_blank">{fish.photo.license}</a
        >{:else}{fish.photo.license}{/if}{#if fish.photo.sourceUrl}. <a href={fish.photo.sourceUrl} rel="noopener" target="_blank">Source</a>{/if}
    {/snippet}
    {#if revealed}
      <p class="credit">{@render credit()}</p>
    {:else}
      <details>
        <summary>Photo credit (may reveal the answer)</summary>
        <p class="credit">{@render credit()}</p>
      </details>
    {/if}
  </figcaption>
</figure>

<style>
  .photo {
    position: relative;
    margin: 0;
    animation: photo-in 0.9s cubic-bezier(0.2, 1.3, 0.4, 1) both;
  }

  @keyframes photo-in {
    0% { transform: rotate(-28deg) scale(0.2) translateX(-60%); opacity: 0; }
    60% { transform: rotate(6deg) scale(1.05); opacity: 1; }
    100% { transform: none; }
  }

  img:hover {
    animation: jelly 0.6s ease-in-out;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 572 / 285;
    object-fit: cover;
    border: 3px solid var(--ink);
    background: var(--ink);
  }

  figcaption {
    margin-top: 6px;
    font-size: 14px;
    font-weight: 700;
  }

  summary {
    cursor: pointer;
    width: max-content;
    text-decoration: underline;
    text-underline-offset: 3px;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .credit {
    margin: 4px 0 0;
    font-weight: 500;
  }

  /* Before the answer, the credit tucks into the photo's corner so the hints get the room. */
  .over {
    position: absolute;
    left: 3px;
    bottom: 3px;
    max-width: calc(100% - 6px);
    margin: 0;
    padding: 3px 8px;
    background: var(--cel);
    font-size: 13px;
  }

  @media (max-width: 959px) {
    img {
      aspect-ratio: 358 / 176;
    }

    figcaption {
      font-size: 13px;
    }
  }
</style>

<script module lang="ts">
  import { geoGraticule10, geoPath } from 'd3-geo';
  import { feature } from 'topojson-client';
  import land110Url from 'world-atlas/land-110m.json?url';
  import land50Url from 'world-atlas/land-50m.json?url';
  import type { LatLng, Range } from '../lib/geo';
  import { makeProjection } from '../lib/mapGeometry';

  export type MapResult = { pin: LatLng; range: Range; nearest: LatLng; label: string };

  const projection = makeProjection();
  const path = geoPath(projection).digits(1);
  const sphere = path({ type: 'Sphere' }) ?? '';
  const graticule = path(geoGraticule10()) ?? '';

  // Coastlines are fetched and projected once per page, however many maps the day draws.
  const landCache = new Map<string, Promise<string>>();
  function landPath(url: string): Promise<string> {
    if (!landCache.has(url)) {
      landCache.set(
        url,
        fetch(url)
          .then((r) => r.json())
          .then((topo) => path(feature(topo, topo.objects.land)) ?? ''),
      );
    }
    return landCache.get(url)!;
  }
</script>

<script lang="ts">
  import { pointer, select } from 'd3-selection';
  import 'd3-transition';
  import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
  import { onMount } from 'svelte';
  import { reducedMotion, shake } from '../lib/fx';
  import { rangeFeatures, revealTarget, screenToLatLng, VIEW_H, VIEW_W } from '../lib/mapGeometry';

  let {
    pin = null,
    onpin = () => {},
    results = [],
    locked = false,
    frame = false,
    title = 'World map',
  }: {
    pin?: LatLng | null;
    onpin?: (p: LatLng) => void;
    results?: MapResult[];
    locked?: boolean;
    /** Zoom to fit the result when there is exactly one. */
    frame?: boolean;
    title?: string;
  } = $props();

  let svgEl: SVGSVGElement;
  let frameEl: HTMLDivElement;
  let zoomer: ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let transform: ZoomTransform = $state(zoomIdentity);
  let cssWidth = $state(VIEW_W);
  let land110 = $state('');
  let land50 = $state('');
  let wantDetail = false;

  const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;

  /** Chart units per CSS pixel, so markers keep the same on-screen size at any width. */
  const unit = $derived(VIEW_W / cssWidth);
  const land = $derived(transform.k >= 2.5 && land50 ? land50 : land110);
  const project = (p: LatLng) => {
    const xy = projection([p.lng, p.lat]);
    return xy ? transform.apply(xy) : null;
  };
  const drawn = $derived(
    results.map((r) => ({
      ...r,
      shape: path(rangeFeatures(r.range)) ?? '',
      line:
        path({
          type: 'LineString',
          coordinates: [
            [r.pin.lng, r.pin.lat],
            [r.nearest.lng, r.nearest.lat],
          ],
        }) ?? '',
      pinXY: project(r.pin),
      homeXY: project(r.nearest),
    })),
  );
  const aimXY = $derived(pin && !locked ? project(pin) : null);

  export function focus() {
    svgEl?.focus();
  }

  function place(point: [number, number]) {
    if (locked) return;
    const ll = screenToLatLng(projection, point);
    if (!ll) return;
    onpin(ll);
    shake(frameEl);
  }

  function zoomBy(factor: number) {
    if (!zoomer) return;
    const sel = select(svgEl);
    zoomer.scaleBy(reducedMotion() ? sel : sel.transition().duration(250).ease(easeOutQuart), factor);
  }

  function onkeydown(e: KeyboardEvent) {
    if (!zoomer) return;
    const sel = select(svgEl);
    const step = 60 / transform.k;
    if (e.key === 'ArrowLeft') zoomer.translateBy(sel, step, 0);
    else if (e.key === 'ArrowRight') zoomer.translateBy(sel, -step, 0);
    else if (e.key === 'ArrowUp') zoomer.translateBy(sel, 0, step);
    else if (e.key === 'ArrowDown') zoomer.translateBy(sel, 0, -step);
    else if (e.key === '+' || e.key === '=') zoomBy(1.5);
    else if (e.key === '-') zoomBy(1 / 1.5);
    else if (e.key === 'Enter' || e.key === ' ') place(transform.invert([VIEW_W / 2, VIEW_H / 2]) as [number, number]);
    else return;
    e.preventDefault();
  }

  onMount(() => {
    landPath(land110Url).then((d) => (land110 = d));

    const sel = select(svgEl);
    zoomer = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .clickDistance(4)
      .extent([
        [0, 0],
        [VIEW_W, VIEW_H],
      ])
      .translateExtent([
        [0, 0],
        [VIEW_W, VIEW_H],
      ])
      .on('zoom', (e) => (transform = e.transform));
    sel.call(zoomer).on('dblclick.zoom', null);
    // d3-zoom swallows the click that ends a drag or pinch, so only deliberate taps land here.
    sel.on('click', (event: MouseEvent) => place(transform.invert(pointer(event, svgEl)) as [number, number]));

    const ro = new ResizeObserver(([entry]) => (cssWidth = entry.contentRect.width || VIEW_W));
    ro.observe(svgEl);
    return () => {
      ro.disconnect();
      sel.on('.zoom', null).on('click', null);
    };
  });

  // Detailed coastlines only once someone zooms in.
  $effect(() => {
    if (transform.k >= 2 && !wantDetail) {
      wantDetail = true;
      landPath(land50Url).then((d) => (land50 = d));
    }
  });

  // On reveal, frame the pin and the home range together (see revealTarget).
  $effect(() => {
    if (!frame || results.length !== 1 || !zoomer) return;
    const r = results[0];
    const t = revealTarget(path, r.range, r.pin, r.nearest);
    const target = zoomIdentity.translate(t.x, t.y).scale(t.k);
    const sel = select(svgEl);
    zoomer.transform(reducedMotion() ? sel : sel.transition().delay(250).duration(1100).ease(easeOutQuart), target);
  });
</script>

<section class="chart" aria-label={title}>
  <div class="bar">
    <h2 class="cond">{title}</h2>
    <div class="zoom">
      <button type="button" aria-label="Zoom in" onclick={() => zoomBy(1.6)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" aria-label="Zoom out" onclick={() => zoomBy(1 / 1.6)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
    </div>
  </div>
  <div class="frame" bind:this={frameEl}>
    <!-- The chart is a custom keyboard widget (role="application"), which svelte-check doesn't treat as interactive. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      bind:this={svgEl}
      viewBox="0 0 {VIEW_W} {VIEW_H}"
      class:locked
      role="application"
      tabindex="0"
      aria-label="World chart. Tap or click to place your pin. Drag or pinch to move and zoom. Keyboard: arrow keys pan, plus and minus zoom, Enter drops a pin at the centre."
      {onkeydown}
    >
      <defs>
        <pattern id="halftone" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="scale({1 / transform.k})">
          <circle cx="3" cy="3" r="1.7" fill="var(--coral)" />
        </pattern>
        <pattern id="teal-dots" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="scale({1 / transform.k})">
          <rect width="6" height="6" fill="var(--teal)" />
          <circle cx="3" cy="3" r="1.4" fill="var(--cel)" opacity="0.6" />
        </pattern>
        <clipPath id="sphere-clip"><path d={sphere} /></clipPath>
      </defs>

      <g transform={transform.toString()}>
        <path class="graticule" d={graticule} />
        <path class="land" d={land} />
        <g clip-path="url(#sphere-clip)">
          {#each drawn as r, i (i)}
            <path class="range" d={r.shape} />
            <path class="line" d={r.line} />
          {/each}
        </g>
        <path class="sphere" d={sphere} />
      </g>

      {#each drawn as r, i (i)}
        {#if r.homeXY}
          {@const flip = r.homeXY[0] > VIEW_W - 110 * unit}
          <g class="home" transform="translate({r.homeXY[0]} {r.homeXY[1]}) scale({unit})">
            <circle class="pulse" r="12" />
            <circle class="dot" r="10" />
            <text x={flip ? -16 : 16} y="5" text-anchor={flip ? 'end' : 'start'}>{r.label}</text>
          </g>
        {/if}
        {#if r.pinXY}
          <g class="pin placed" transform="translate({r.pinXY[0]} {r.pinXY[1]}) scale({unit})">
            <path d="M0 -20V20M-20 0H20" />
            <circle r="11" />
          </g>
        {/if}
      {/each}

      {#if aimXY && pin}
        {#key `${pin.lat},${pin.lng}`}
          <g class="shock" transform="translate({aimXY[0]} {aimXY[1]}) scale({unit})" aria-hidden="true">
            <circle r="15" />
            <circle r="15" class="late" />
          </g>
        {/key}
        <g class="pin" transform="translate({aimXY[0]} {aimXY[1]}) scale({unit})">
          <path d="M0 -26V26M-26 0H26" />
          <circle r="15" />
        </g>
      {/if}
      <g class="crosshair" transform="translate({VIEW_W / 2} {VIEW_H / 2}) scale({unit})" aria-hidden="true">
        <path d="M0 -14V14M-14 0H14" />
      </g>
    </svg>
    {#if !pin && !locked}
      <p class="hint">Tap to place your pin. Use + and − to zoom.</p>
    {/if}
  </div>
</section>

<style>
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    background: var(--ink);
    color: var(--butter);
    padding: 0 4px 0 10px;
    min-height: 44px;
  }

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .zoom {
    display: flex;
    gap: 2px;
  }

  .zoom button {
    width: 44px;
    height: 40px;
    display: grid;
    place-items: center;
    background: none;
    border: 0;
    border-radius: 6px;
    color: var(--butter);
    cursor: pointer;
  }

  .zoom button:hover {
    background: var(--coral);
    color: var(--ink);
    animation: jelly 0.5s;
  }

  .zoom path {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
  }

  .frame {
    position: relative;
    border: 3px solid var(--ink);
    border-top: 0;
    background: var(--butter);
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    cursor: crosshair;
    touch-action: none;
    user-select: none;
  }

  svg.locked {
    cursor: grab;
  }

  svg:focus {
    outline: none;
  }

  svg:focus-visible {
    outline: 4px solid var(--teal-deep);
    outline-offset: -4px;
  }

  .graticule {
    fill: none;
    stroke: var(--ink);
    stroke-width: 0.6px;
    stroke-dasharray: 1.5 3;
    vector-effect: non-scaling-stroke;
    opacity: 0.7;
  }

  .land {
    fill: url(#halftone);
    stroke: var(--ink);
    stroke-width: 1.4px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .sphere {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.5px;
    vector-effect: non-scaling-stroke;
  }

  .range {
    fill: url(#teal-dots);
    stroke: var(--ink);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    animation: fade 0.6s var(--ease-out) both;
  }

  .line {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.5px;
    stroke-dasharray: 2 6;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    animation: march 0.8s linear infinite;
  }

  .pin path {
    stroke: var(--ink);
    stroke-width: 2;
  }

  .pin circle {
    fill: rgb(242 100 61 / 0.6);
    stroke: var(--ink);
    stroke-width: 4;
  }

  .shock circle {
    fill: none;
    stroke: var(--ink);
    stroke-width: 3;
    transform-box: fill-box;
    transform-origin: center;
    animation: shock 0.7s cubic-bezier(0.1, 0.8, 0.3, 1) both;
  }

  .shock .late {
    stroke: var(--coral);
    animation-delay: 0.12s;
  }

  .home .dot {
    fill: var(--teal);
    stroke: var(--ink);
    stroke-width: 3;
  }

  .home .pulse {
    fill: none;
    stroke: var(--teal-deep);
    stroke-width: 3;
    transform-box: fill-box;
    transform-origin: center;
    animation: pulse 1.6s ease-out infinite;
  }

  .home text {
    font-family: var(--font-cond);
    font-weight: 900;
    font-size: 16px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--butter);
    stroke-width: 4px;
  }

  .crosshair {
    opacity: 0;
  }

  .crosshair path {
    stroke: var(--ink);
    stroke-width: 2;
  }

  svg:focus-visible .crosshair {
    opacity: 1;
  }

  .hint {
    position: absolute;
    left: 8px;
    bottom: 8px;
    margin: 0;
    padding: 2px 8px;
    background: var(--ink);
    color: var(--butter);
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    pointer-events: none;
    animation: jelly 1.4s ease-in-out infinite;
  }

  @keyframes fade {
    from {
      fill-opacity: 0;
    }
  }

  @keyframes march {
    to {
      stroke-dashoffset: -16;
    }
  }

  @keyframes shock {
    from {
      transform: scale(0.4);
      opacity: 1;
    }
    to {
      transform: scale(5);
      opacity: 0;
    }
  }

  @keyframes pulse {
    from {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(3.2);
      opacity: 0;
    }
  }

  @media (max-width: 959px) {
    h2 {
      font-size: 18px;
    }
  }
</style>

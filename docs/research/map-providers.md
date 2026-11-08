# Map providers for FishLocator

All pages were read on 2026-11-07, and prices are list USD. **[U]** means I could not confirm the claim from a primary source.

## Recommendation

**Recommended: MapLibre GL JS v6 with our own Natural Earth vector tiles, served as static files from Cloudflare Workers Static Assets.**
**Runner-up: MapLibre GL JS with a Protomaps z0–8 PMTiles extract on Cloudflare R2 and a Worker.**

- **Wobbly coasts are a geometry problem.** Vendor styling changes how features are drawn, not their shape. The [MapLibre layer spec](https://maplibre.org/maplibre-style-spec/layers/) has no displacement or distortion property, and Mapbox, MapTiler, Stadia and ArcGIS style the same kind of vector layers. Hand-drawn coasts therefore mean owning the geometry and baking the wobble in at build time. After that, paying a vendor to host the result buys little.
- **Static files remove both failure modes.** No meter means no surprise bill, and no quota to run out on launch day. Every vendor spend cap works by turning the map off (see the table).
- **Labels and attribution get easier.** Natural Earth is public domain, needs no credit, and shows no labels unless we add them.
- **The main risk is river detail at high zoom.** Natural Earth says its 1:10m rivers ["work well at scales to about 1:30,000,000"](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/), roughly z3–4 by my calculation, not z8. Test this against the [roughly 150 fish](../../PRODUCT.md) first. If it's too sparse, cap zoom around z6–7 or add z6–8 rivers from [HydroRIVERS](https://www.hydrosheds.org/products/hydrorivers) (commercial use allowed, attribution terms not read) or Protomaps (OSM attribution required).

No commercial provider fits better. Mapbox has the strongest tooling, but it has no spend cap, a proprietary SDK, and a mandatory logo. Stadia is the best commercial fallback on cost and billing control.

## Comparison

| Option | Billing unit, free tier | Card? | Over quota; can you cap? | Styling | Labels | Projection, antimeridian | Attribution | Terms | Lock-in |
|---|---|---|---|---|---|---|---|---|---|
| **MapLibre + own Natural Earth, static** | None. Static asset requests are ["free and unlimited"](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) | Free plan: no [U]. $5 plan: yes | No quota to hit. 20k files on Free, 100k on Paid | Total, including geometry. Sprites, `fill-pattern`, `line-pattern`. No layer blend modes in GL JS | Only what we add | Mercator with world copies, or globe | [None required](https://www.naturalearthdata.com/about/terms-of-use/) | Public domain. MapLibre is [BSD-3](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt) | Minimal |
| **Natural Earth + d3-geo (SVG/canvas)** | Same | Same | Same | Best art: SVG filters, any drawing style. We build pan, zoom and tap | Only what we add | [Any projection, built-in antimeridian cutting](https://d3js.org/d3-geo/projection) | None required | Public domain. d3 is ISC | Minimal |
| **Protomaps z0–8 on R2 + Worker** | Worker requests, R2 reads on cache miss. [10M Worker requests/mo with $5 plan](https://developers.cloudflare.com/workers/platform/pricing/); [R2 free tier 10 GB, 10M reads](https://developers.cloudflare.com/r2/pricing/) | Yes [U] | Auto-bills at low rates. No cap found on the pricing pages | MapLibre style JSON. No geometry change | Remove symbol layers | Same as MapLibre | [OSM required](https://docs.protomaps.com/basemaps/downloads) (ODbL) | Copy builds to your own bucket; hotlinking discouraged | Low |
| **OpenFreeMap (public)** | [Free, no limit on views or requests](https://openfreemap.org/) | No | No SLA. See Wplace note below | Style JSON on OpenMapTiles schema | Remove symbol layers | Same as MapLibre | "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (name optional) | Commercial allowed. [No warranty](https://openfreemap.org/tos/) | Low; self-host possible |
| **Stadia Maps** | [Credits: 1 per vector or raster tile](https://stadiamaps.com/pricing/). Free 200k/mo | [Free: no](https://stadiamaps.com/faqs/). Paid: yes | [Hard 429 by default](https://docs.stadiamaps.com/limits/); [overage is opt-in](https://docs.stadiamaps.com/upgrading-subscription/) | [Maputnik/style JSON](https://docs.stadiamaps.com/custom-styles/). Watercolor is fixed raster | Editable on vector. Watercolor has none | Same as MapLibre | [© Stadia © OpenMapTiles © OSM, plus © Stamen](https://docs.stadiamaps.com/attribution/) | Free tier non-commercial; [for-profit orgs count even with no revenue](https://stadiamaps.com/terms-of-service/versions/2026-11-09/) (terms effective 2026-11-09). No server-side caching | Low |
| **MapTiler Cloud** | [Sessions via its SDK; requests via third-party libraries](https://docs.maptiler.com/guides/maps-apis/maps-platform/tile-requests-and-map-sessions-compared/). Free 5k sessions | Free: no. Flex: card or PayPal | Free pauses. Flex auto-bills, or a [spending limit deactivates the API until next month](https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-control-expenses-in-your-user-account/) | [Map Designer + style JSON](https://docs.maptiler.com/guides/map-design/) | Editable | [Globe in SDK](https://docs.maptiler.com/sdk-js/examples/globe-projection/) | Logo on Free. [Not on Flex](https://www.maptiler.com/cloud/pricing/), except 3D | [Free is non-commercial; no server-side cache](https://www.maptiler.com/terms/cloud/) | Medium if on SDK |
| **Mapbox GL JS** | [Map loads, free 50k/mo](https://www.mapbox.com/pricing); 12-hour window, tiles included | [Optional, but no-card demo access is limited and not for production](https://docs.mapbox.com/accounts/guides/demo-access/) | Auto-bills. [No spending cap](https://docs.mapbox.com/accounts/guides/invoices/); rotating tokens is the only stop | Studio is the strongest editor [U: Studio docs not read]. No geometry change unless we upload data | Editable | [Globe, Equal Earth, Natural Earth, Winkel Tripel; rectangular projections loop across 180°](https://docs.mapbox.com/mapbox-gl-js/guides/projections/) | [Logo mandatory even with fully custom data](https://docs.mapbox.com/help/dive-deeper/attribution/) | [No cache or store](https://www.mapbox.com/legal/product-terms) (§1). No ad ban found | High: [SDK licensed only for Mapbox products](https://github.com/mapbox/mapbox-gl-js/blob/main/LICENSE.txt) |
| **ArcGIS Location Platform** | [Tiles: 2M free then $0.15/1k. Sessions: 1k free then $4/1k](https://location.arcgis.com/pricing/) | [No until PAYG](https://location.arcgis.com/help/billing/) | PAYG off: service disabled until next cycle. PAYG on: bills, no cap found | [Vector Tile Style Editor](https://developers.arcgis.com/documentation/esri-and-data-attribution/) [U: depth not tested] | Editable [U] | MapLibre plugin or ArcGIS SDK [U] | ["Powered by Esri" + data sources](https://developers.arcgis.com/documentation/mapping-and-location-services/faq/) | Commercial and ad terms not read [U] | Medium |

## Cost per month

**Assumptions**
- 1 map load per player per day for 30 days, giving 30k, 300k, 3M and 30M sessions per month.
- 12 map views per session (my estimate, to be measured).
- [MapTiler's rule of thumb](https://www.maptiler.com/cloud/pricing/) of 4 vector or 10–16 raster requests per view, which gives 50 vector or 150 raster tiles per session.
- Vector tiles per month: 1.5M, 15M, 150M, 1.5B. Raster: 4.5M, 45M, 450M, 4.5B.
- Browser caching and negotiated discounts are ignored, so tile-billed figures are upper bounds. Game hosting is excluded.

| Option | 1k/day | 10k/day | 100k/day | 1M/day | Arithmetic (1M/day unless noted) |
|---|---|---|---|---|---|
| **Own Natural Earth, static** | $0 | $0 | $0–5 | $5 | Requests free. Budget the $5 plan (see Cloudflare note). About 1 MB per session (estimate) is 30 TB/mo, with no egress fee |
| **Protomaps on R2 + Worker** | $5 | $6.50 | ~$49 | ~$486 | Worker $5 + 1,490M × $0.30/M = $452. CPU at ~1 ms per request (estimate): 1,470M ms × $0.02/M = $29.40. R2 at 1% miss × 1.5 reads: 12.5M × $0.36/M = $4.50 |
| **OpenFreeMap** | $0 | $0 | $0 | $0 | Free, with no SLA. Assumes the operator doesn't block us |
| **Stadia, vector** | $35 | $230 | $2,125 | $22,375 | Pro $250 + 1,475M × $0.015/1k. 100k: $250 + 125M × $0.015/1k. 10k: Standard $80 + 7.5M × $0.02/1k. 1k: Starter $20 + 0.5M × $0.03/1k |
| **Stadia, Watercolor raster** | $80 | $550 | $6,625 | $67,375 | $250 + 4,475M × $0.015/1k. 256px tiles; retina would cost more |
| **MapTiler Flex, SDK sessions** | $42.50 | $717.50 | $7,467.50 | $74,967.50 | $30 + 29,975 × $2.50. Via plain MapLibre it's request-billed: $224,955. Custom plan pricing unpublished |
| **Mapbox** | $0 | $950 | $8,050 | $75,550 | 50×$5 + 100×$4 + 800×$3 + 29,000×$2.50. Above 5M is "contact sales", so $2.50 is assumed as a ceiling |
| **ArcGIS** (cheaper of tile or session billing) | $0 | $1,196 | $11,996 | $119,996 | 29,999 × $4. 1k uses tiles (1.5M, under the free 2M). Tile billing at 1M/day: $224,700 |
| **Google Dynamic Maps** (reference only) | $140 | $1,750 | $9,170 | $26,620 | [90×$7 + 400×$5.60 + 500×$4.20 + 4,000×$2.10 + 25,000×$0.53](https://developers.google.com/maps/billing-and-pricing/pricing) |

## Per-option notes

### Own Natural Earth with MapLibre

- **Build:** wobble the geometry once, then pre-cut tiles. z0–6 is at most 5,461 files, within the [Free plan's 20k limit](https://developers.cloudflare.com/workers/platform/limits/), and MapLibre can overzoom to z8. Full z0–8 is 87,381 files, which needs the Paid plan's 100k limit.
- **Projection mismatch:** `design/mockups/tools/gen-maps.mjs` draws the mockups in d3's `geoNaturalEarth1`. MapLibre offers Mercator and globe, so the real map won't match those mockups. If that projection matters more than gestures and zoom, choose d3.
- **Globe status:** shipped in v5 and [still being patched](https://github.com/maplibre/maplibre-gl-js/releases). v6.12 fixed a pole hole in Oct 2026, and [an antimeridian FPS bug](https://github.com/maplibre/maplibre-gl-js/issues/7672) closed in Sept 2026. [Polygons over the poles have rendered with holes](https://github.com/maplibre/maplibre-gl-js/issues/6072). Test on real phones.
- **v6 is ESM-only:** [UMD bundles are gone](https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/CHANGELOG.md), so older tutorials won't work as written.
- **Antimeridian:** [world copies are on by default](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/). Lines need [unwrapped longitudes](https://maplibre.org/maplibre-gl-js/docs/examples/display-line-that-crosses-180th-meridian/), and pins need [`lngLat.wrap()`](https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/).
- **Cloudflare risk:** CDN terms let Cloudflare limit [a "disproportionate percentage" of large files](https://www.cloudflare.com/service-specific-terms-application-services/) unless you use paid services such as the Developer Platform, which [can "host content"](https://www.cloudflare.com/service-specific-terms-developer-platform/). I found no written guarantee at 30 TB/mo, so take the $5 plan before launch and ask Cloudflare if traffic grows.
- **Fallback host:** [CloudFront flat-rate plans](https://aws.amazon.com/cloudfront/pricing/) have no overage charges. Business is $200 for 125M requests and 50 TB. At 1M/day, a 4-file bundle (120M requests) fits it, while 50 tiles per session (1.5B) needs a custom Premium price.

**Natural Earth sizes** (measured from the [official repo](https://github.com/nvkelso/natural-earth-vector) and [CDN](https://naciscdn.org/naturalearth/); gzip -9 by me)

| Layer | 1:50m GeoJSON raw / gz | 1:50m features / vertices | 1:50m zip | 1:10m GeoJSON raw / gz | 1:10m features / vertices | 1:10m zip |
|---|---|---|---|---|---|---|
| Coastline | 1.64 / 0.53 MB | 1,428 / 60,416 | 0.46 MB | 10.11 / 3.37 MB | 4,133 / 410,957 | 3.07 MB |
| Land | 1.64 / 0.53 MB | 1,420 / 60,669 | 0.46 MB | 10.16 / 3.57 MB | 11 / 446,175 | 3.27 MB |
| Lakes | 0.88 / 0.26 MB | 412 / 19,778 | 0.25 MB | 5.04 / 1.57 MB | 1,355 / 162,852 | 2.35 MB |
| Rivers + lake centerlines | 0.83 / 0.27 MB | 462 / 25,641 | 0.50 MB | 7.31 / 2.27 MB | 1,455 / 256,386 | 2.08 MB |

[world-atlas TopoJSON](https://cdn.jsdelivr.net/npm/world-atlas@2/) land is smaller: 50m is 0.55 MB (0.17 MB gz) and 10m is 3.09 MB (0.77 MB gz).

**Is it good enough?** Big lakes and major rivers are there at 1:10m, and generalised lines suit a hand-drawn look. Small rivers aren't, and coverage is uneven, with [extra detail mainly for North America and Europe](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/).

### Natural Earth with d3-geo

The best art and the cleanest antimeridian handling, and it's what the mockups already use. 1:10m is about 830k vertices across coast, lakes and rivers, which I'd expect to struggle when re-projected per frame on phones (untested). 1:50m is about 106k. We would also build gestures ourselves.

### Protomaps

The best hydrography without a vendor, but no wobble. The planet is [about 120 GB at z15, and each zoom level roughly doubles the size](https://docs.protomaps.com/basemaps/downloads), so z0–8 is about 1 GB (estimate). [Caching needs a custom domain, and R2 misses can take 500 ms or more](https://docs.protomaps.com/deploy/cloudflare).

**Don't launch on the Workers Free plan.** Its 100k requests a day is about 2,000 players at 50 tiles, after which [requests get Error 1027 or bypass the Worker](https://developers.cloudflare.com/workers/platform/limits/).

### OpenFreeMap

Fine for prototypes. In 2025 its operator [blocked Wplace after a viral spike](https://hyperknot.com/blog/openfreemap-survived-100000-requests/) (about 3B requests in 24 hours) and planned per-referer limits around 100M a day. Our 1M/day case is about 50M tiles a day, but nothing guarantees that stays allowed. Current limits are [U].

### Stadia

The best commercial fit: hard stop by default, opt-in overage, low rates. Overage must be switched on before traffic arrives, or launch day gets 429s.

[Stamen Watercolor](https://docs.stadiamaps.com/map-styles/stamen-watercolor/) is label-free, but its [listed "vector style"](https://tiles.stadiamaps.com/styles/stamen_watercolor.json) is one 256px raster layer, so there's nothing to restyle. [Custom raster styles are quote-only](https://docs.stadiamaps.com/custom-styles/). [Stamen tiles are priced as normal tiles](https://stadiamaps.com/stamen/). The attribution page's "contact us" licensing line sits in its print and media section, so I read it as not covering live web maps [U].

### MapTiler, Mapbox, ArcGIS

MapTiler and Mapbox could host our own data, but that means paying per load for what a static file does for free. ArcGIS's off-by-default PAYG prevents surprise bills, but it is the most expensive option at scale.

### Failed the style requirement

- **Google Maps JS:** [cloud styling](https://developers.google.com/maps/documentation/javascript/cloud-customization) covers colours, visibility and some label and geometry settings, not hand-drawn coasts. [Per-SKU free caps replaced the $200 credit](https://developers.google.com/maps/billing-and-pricing/march-2025), with 10k Dynamic Maps loads free. [Billing must be enabled](https://developers.google.com/maps/documentation/javascript/get-api-key). [Per-day quotas are a hard cap; requests then fail for the rest of the day](https://developers.google.com/maps/billing-and-pricing/manage-costs). [No caching or use near non-Google maps](https://cloud.google.com/maps-platform/terms).
- **Apple MapKit JS:** [250k map views a day free](https://developer.apple.com/maps/web/) with a [$99/yr membership](https://developer.apple.com/programs/whats-included/), enough for 100k players a day; beyond that, contact Apple. [The Map API](https://developer.apple.com/documentation/mapkitjs/map) offers map types, colour schemes and POI filters, not custom base styles. Globe and terms not checked.
- **HERE:** 30k free tile transactions a month and about €0.066/1k for vector tiles, from search snippets only [U]. A card may be required [U].
- **TomTom:** [200k free tiles a month, no card](https://docs.tomtom.com/pricing). [Over the limit returns 429, QPS limits are 5–50, and commercial use is allowed even on free evaluation](https://developer.tomtom.com/platform/documentation/status-and-support/faqs). That QPS is a launch-day risk. Per-1k prices not visible [U].

### Other renderers

- **Leaflet:** [2.0 is in beta](https://leafletjs.com/), about 40 KB, with [SVG or canvas layers and `worldCopyJump`](https://leafletjs.com/reference.html). No globe, and core vector tiles not confirmed [U]. Reasonable for a pre-rendered illustrated raster map.
- **OpenLayers:** [v10.11, BSD-2, vector tiles and WebGL](https://openlayers.org/), with [`multiWorld`](https://openlayers.org/en/latest/apidoc/module-ol_View-View.html). Capable, but offers nothing here that MapLibre lacks. No globe found [U].

## Limits of this research

Tiles, bytes and Worker CPU per session are estimates, so measure them in a prototype. I rechecked the main prices and the key Stadia, Cloudflare, Google, Mapbox and TomTom terms against raw page text. Other details came through a summarising fetch tool, so recheck them before committing. ArcGIS and Apple ad and commercial terms were not read.

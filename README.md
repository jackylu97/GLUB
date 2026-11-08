# Glub

A daily browser game: five rare fish a day, one pin each. Guess where in the world each fish lives; the closer your pin lands to its native range, the more points you get.

## Develop

```sh
npm install
npm run build:dev   # builds game data (falls back to fixtures without data/fish.json) and the app
npm run dev         # http://localhost:5173
npm test            # unit tests
npm run check       # type check
npm run preview     # serve dist/ on http://localhost:4173
npm run smoke       # browser playthrough and layout audit against the preview server (needs Chrome)
```

## Data

- `data/fish.json`: the 150 fish, with ranges, facts, sources and photo licences. Photos are in `data/photos/`. See `data/README.md`.
- `data/clues.json`: one researched location clue per fish, with sources. `scripts/lib/clues.ts` rejects any clue that names the place.
- `data/schedule.json`: which five fish appear each day. It is append-only: a build never changes a day that has already been published. Commit it after building locally.

`npm run build` re-encodes the photos, writes `public/data/`, extends the schedule and builds the app into `dist/`.

## Deploy

`render.yaml` is a Render Blueprint for a free static site.

1. In the [Render Dashboard](https://dashboard.render.com), connect your GitHub account if you haven't (Render asks the first time you pick a repo).
2. Click **New → Blueprint**, find this repository and click **Connect**.
3. Give the Blueprint a name, keep the branch as `main`, and click **Deploy Blueprint**.

The site is served at `https://glub.onrender.com` (or a similar `onrender.com` name if that one is taken). Every push to `main` redeploys it. A custom domain can be added on the site's **Settings** page.

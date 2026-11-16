# Style Library

A static inspiration library: screenshots of sites and sections, grouped by design style, each style explained with its vocabulary (type, color, layout, motion, when to use, what to avoid). Every entry has a copyable brief and an image-generation prompt.

No build step. Plain HTML, CSS and JS, deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

## Run locally

```bash
npm run dev
```

Open http://localhost:4321. (Opening `index.html` directly from disk will not work because the page fetches `data/library.json`.)

## Add an entry

1. Capture a screenshot (first time only: `npm install` then `npx playwright install chromium`):

   ```bash
   npm run shot -- https://example.com example-hero
   npm run shot -- https://example.com example-footer --selector "footer"
   npm run shot -- https://example.com example-full --full
   ```

   Or drop any `.jpg`/`.png`/`.webp` into `shots/` yourself.

2. Click **+ Add entry** in the app, fill the form, copy the JSON and paste it into the `entries` array in `data/library.json`.

3. Commit and push. The site redeploys in about a minute.

Entries without an `image` show a generated placeholder in the style's palette.

## Add a style

Add an object to `categories` in `data/library.json`:

```json
{
  "id": "soft-brutalism",
  "name": "Soft Brutalism",
  "summary": "...",
  "vocabulary": ["...", "..."],
  "typography": "...",
  "color": "...",
  "layout": "...",
  "motion": "...",
  "useWhen": "...",
  "avoid": "..."
}
```

## Links

- `#style=<id>` opens a style with its guide
- `#vocabulary` shows all style guides
- `#entry=<id>` opens an entry

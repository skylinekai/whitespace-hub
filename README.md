# Whitespace Hub

Skyline Whitespace's internal hub of forms, policies and documents. Replaces the Jotform app at eu.jotform.com/app/240183316304345.

It's a single static page (`index.html`) with no build step. Forms still submit to Jotform; documents are still hosted on Jotform.

## Deploy on Render
1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint**, pick the repo. `render.yaml` sets it up as a free static site.
   (Or **New → Static Site**, publish directory `.`, no build command.)
3. Optional: add a custom domain such as `hub.skylinewhitespace.com` under Settings → Custom Domains.

## Editing content
All content lives in the `D` array near the top of the `<script>` in `index.html`.
Each department has groups: `['Heading', [items]]`. Each item is one of:

| Item | Meaning |
|---|---|
| `['f', 'Title', '240181811919052', 'optional subtitle']` | Jotform form (the form ID) |
| `['d', 'Title', '~File%20Name.pdf', 'optional subtitle']` | Document; `~` = Jotform uploads folder, or a full URL |
| `['l', 'Title', 'https://…', 'optional subtitle']` | External link |
| `['p', 'Title', 'department-id']` | Link to another page in the hub |
| `['n', '<p>HTML text</p>']` | A note / paragraph |

Home-page tiles are listed in `HOME`, quick-action buttons in `QUICK`.
Commit and push; Render redeploys automatically.

## Notes
- The site is public to anyone with the URL (like the Jotform app). It's set to `noindex` so search engines skip it.
- Favourites are stored in each person's browser.
- Staff can add it to their phone home screen ("Add to Home Screen") and it opens like an app.

# Word Counter

Counts total and unique words for a given URL.

## Run

1. Ensure Node.js 18+ is installed.
2. Run:
   - `npm start`

## Run (site-wide unique words)

Counts unique words across the entire site based on `site_map.txt`.

1. Run:
   - `npm run start:site`

Optional: pass a URL or a sitemap file path.

- `npm run start:site https://example.com/page`
- `npm run start:site ./site_map.txt`

The URL is configured in `index.js` as `URL_TO_COUNT`.
# site-word-counter

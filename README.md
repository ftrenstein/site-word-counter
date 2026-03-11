# Word Counter

Counts total and unique words for one or more pages.

## How It Works

The script:

1. Reads URLs from `site_map.txt` by default.
2. Loads each page and extracts visible text from the HTML body.
3. Excludes `script`, `style`, `noscript`, hidden elements, and elements with `display:none`.
4. Normalizes words by converting them to lowercase and removing punctuation and digits.
5. Calculates:
   - total words per page
   - unique words per page
   - unique words across the whole set of pages

## Prepare `site_map.txt`

Put the page addresses into `site_map.txt`, one URL per line.

Example:

```txt
https://example.com/
https://example.com/about/
https://example.com/contact/
```

Only lines starting with `http` are processed.

## Run

1. Ensure Node.js 18+ is installed.
2. Install dependencies:

```bash
npm install
```

3. Start the script:

```bash
npm start
```

## Optional Run Modes

Run for a single URL:

```bash
npm start -- https://example.com/page
```

Run with a custom sitemap file:

```bash
npm start -- ./site_map.txt
```

## Output Files

The script generates:

- `results_<timestamp>.txt` — formatted report with counts for every processed URL
- `first_url_text.txt` — normalized text extracted from the first processed URL in a readable wrapped format

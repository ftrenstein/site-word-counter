import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const DEFAULT_URL = 'https://aristeksystems.com/portfolio/custom-b2c-b2b-lms/';
const DEFAULT_SITEMAP = new URL('./site_map.txt', import.meta.url);
const FIRST_URL_TEXT_FILE = new URL('./first_url_text.txt', import.meta.url);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const RESULTS_FILE = new URL(`./results_${timestamp}.txt`, import.meta.url);
const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 2;
const BASE_DELAY_MS = 800;
const EXTRA_403_DELAY_MS = 2500;

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/[^\p{L}]+/gu, '');
}

function extractWords(text) {
  return text.split(/\s+/g).map(normalizeWord).filter(Boolean);
}

function extractBodyText($) {
  const $body = $('body').clone();
  $body.find('*').each((_, el) => {
    $body.find(el).after(' ');
  });
  return $body.text();
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const userAgent = getRandomUserAgent();

  try {
    return await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Referer: new URL(url).origin,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPageText(url) {
  let lastError;

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);

      if (!response.ok) {
        if (response.status === 403) {
          await sleep(BASE_DELAY_MS + EXTRA_403_DELAY_MS * (attempt + 1));
        }
        throw new Error(
          `Request failed: ${response.status} ${response.statusText}`,
        );
      }

      const html = await response.text();
      const $ = load(html);
      $('script, style, noscript').remove();
      $('[hidden], [aria-hidden="true"]').remove();
      $('[style*="display:none"], [style*="display: none"]').remove();
      //   $('header, nav, footer').remove();
      //   $('[role="navigation"], [aria-label*="nav"]').remove();
      //   $('[class*="menu"], [class*="navbar"], [class*="breadcrumb"]').remove();
      return extractBodyText($);
    } catch (error) {
      lastError = error;
      await sleep(BASE_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

async function countUrl(url, text) {
  const words = extractWords(text);
  const uniqueWords = new Set(words);

  return {
    url,
    total: words.length,
    unique: uniqueWords.size,
    uniqueWords,
  };
}

async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let index = 0;

  async function next() {
    const currentIndex = index;
    index += 1;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    return next();
  }

  const workers = Array.from({ length: concurrency }, () => next());
  await Promise.all(workers);
  return results;
}

function parseUrlsFromSitemap(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0])
    .filter((value) => value.startsWith('http'));
}

async function main() {
  try {
    const arg = process.argv[2];
    let urls = [];

    if (arg && arg.startsWith('http')) {
      urls = [arg];
    } else {
      const sitemapText = await readFile(
        arg ? new URL(arg, import.meta.url) : DEFAULT_SITEMAP,
        'utf8',
      );
      urls = parseUrlsFromSitemap(sitemapText);
    }

    if (urls.length === 0) {
      urls = [DEFAULT_URL];
    }

    console.log('url\ttotal_words\tunique_words');

    const results = await runWithConcurrency(
      urls,
      async (url, index) => {
        try {
          const text = await fetchPageText(url);
          if (index === 0) {
            const normalizedText = extractWords(text).join(' ');
            await writeFile(FIRST_URL_TEXT_FILE, normalizedText, 'utf8');
          }
          return await countUrl(url, text);
        } catch (error) {
          return { url, total: 0, unique: 0, error: error.message };
        }
      },
      CONCURRENCY,
    );

    let grandTotal = 0;
    let grandUnique = 0;
    const siteUniqueWords = new Set();
    const lines = [];
    let errorCount = 0;

    lines.push('Word Count Report');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Total URLs: ${urls.length}`);
    lines.push('');
    lines.push('Methodology');
    lines.push('  Included: visible body text (p, h1-h4, li, span, div, etc.)');
    lines.push(
      '  Excluded: script, style, noscript, hidden elements (hidden attr, aria-hidden, display:none)',
    );
    lines.push(
      '  Words: lowercase letters only, digits and punctuation stripped',
    );
    lines.push('  Unique per page: distinct words per individual page');
    lines.push('  Unique site-wide: distinct words across all pages combined');
    lines.push('');
    lines.push('url\ttotal_words\tunique_words');

    for (const result of results) {
      if (result.error) {
        console.log(`${result.url}\tERROR\t${result.error}`);
        lines.push(`${result.url}\tERROR\t${result.error}`);
        errorCount += 1;
        continue;
      }
      grandTotal += result.total;
      grandUnique += result.unique;
      for (const word of result.uniqueWords) {
        siteUniqueWords.add(word);
      }
      console.log(`${result.url}\t${result.total}\t${result.unique}`);
      lines.push(`${result.url}\t${result.total}\t${result.unique}`);
    }

    const successCount = urls.length - errorCount;
    console.log(
      `TOTAL\t${grandTotal}\tUnique per page (sum): ${grandUnique}\tUnique site-wide: ${siteUniqueWords.size}`,
    );
    lines.push('');
    lines.push(`Processed URLs: ${successCount}`);
    lines.push(`Failed URLs: ${errorCount}`);
    lines.push(`Total words: ${grandTotal}`);
    lines.push(`Unique per page (sum): ${grandUnique}`);
    lines.push(`Unique words (site-wide): ${siteUniqueWords.size}`);

    await writeFile(RESULTS_FILE, lines.join('\n') + '\n', 'utf8');
    console.log(`Saved report to ${RESULTS_FILE.pathname}`);
  } catch (error) {
    console.error('Failed to count words:', error.message);
    process.exitCode = 1;
  }
}

main();

import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const INPUT_FILE = new URL('./site_map3.txt', import.meta.url);
const OUTPUT_FILE = new URL('./site_map3.txt', import.meta.url);

async function main() {
  try {
    const xml = await readFile(INPUT_FILE, 'utf8');
    const $ = load(xml, { xmlMode: true });
    const urls = [];

    $('loc').each((_, el) => {
      const value = $(el).text().trim();
      if (value) urls.push(value);
    });

    const output = urls.join('\n') + (urls.length ? '\n' : '');
    await writeFile(OUTPUT_FILE, output, 'utf8');

    console.log(`Wrote ${urls.length} URLs to ${OUTPUT_FILE.pathname}`);
  } catch (error) {
    console.error('Failed to extract URLs:', error.message);
    process.exitCode = 1;
  }
}

main();

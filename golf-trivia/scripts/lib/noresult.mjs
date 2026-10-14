// Songs whose YouTube search found nothing are remembered here, so the daily run does not spend a search on
// them again. They are listed in no-result-report.md. Use scripts/set-embed-url.mjs to fill one by hand, or
// `fill-embed-urls.mjs --retry-no-result` to search them again.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const SKIP_FILE = `${root}.fill-no-result.json`;
const REPORT_FILE = `${root}no-result-report.md`;

export function loadSkipped() {
  try {
    return JSON.parse(readFileSync(SKIP_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveSkipped(skipped) {
  writeFileSync(SKIP_FILE, `${JSON.stringify(skipped, null, 2)}\n`);
  const rows = Object.values(skipped);
  const lines = [
    '# Songs with no video found (to fix later)',
    '',
    `Updated ${new Date().toLocaleString('sv-SE')}. The daily run does not search these again.`,
    'Paste the right video with: `node scripts/set-embed-url.mjs "<part of the song name>" <youtubeVideoId>`',
    'or put `https://www.youtube.com/embed/<videoId>` into that row\'s `embed_url` in Supabase (costs no quota).',
    '',
  ];
  if (!rows.length) {
    lines.push('No songs are waiting.');
  } else {
    lines.push(`${rows.length} song(s):`, '', '| # | Song | Searched |', '|---|------|----------|');
    rows.forEach((row, i) => lines.push(`| ${i + 1} | ${row.label} | ${row.date} |`));
  }
  writeFileSync(REPORT_FILE, `${lines.join('\n')}\n`);
}

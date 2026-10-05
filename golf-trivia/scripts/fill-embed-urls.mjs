// Finds a YouTube video for every song in `songs_trivia` that has no embed_url yet, and saves
// https://www.youtube.com/embed/<videoId> into that row.
//
//   node scripts/fill-embed-urls.mjs                    every song without a video: Rock_Metal first, then Pop, then the rest
//   node scripts/fill-embed-urls.mjs --limit=95         stop after 95 searches (the free YouTube quota is ~100 searches/day)
//   node scripts/fill-embed-urls.mjs --category=Pop     only that category
//
// Re-running is safe: rows that already have an embed_url are skipped.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { CATEGORY_ORDER } from './lib/sheet.mjs';

const TABLE = 'songs_trivia';
const ID_COLUMN = 'id'; // change if your primary key has another name
const DELAY_MS = 500; // pause between YouTube requests
const YOUTUBE_API_BASE = process.env.YOUTUBE_API_BASE ?? 'https://www.googleapis.com/youtube/v3'; // override only for tests

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, YOUTUBE_API_KEY } = process.env;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const flag = (name) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const limit = flag('limit') === undefined ? Infinity : Number(flag('limit'));
const categoryFilter = flag('category')?.toLowerCase();
if (!(limit > 0)) {
  console.error('--limit must be a positive number, e.g. --limit=95');
  process.exit(1);
}

for (const [name, value] of Object.entries({ SUPABASE_URL, YOUTUBE_API_KEY })) {
  if (!value) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}
if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Errors that would make every following row fail too: stop instead of burning quota.
class FatalError extends Error {}

async function searchVideoId(query) {
  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.search = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '1',
    videoEmbeddable: 'true', // skip uploads that block embedding (delete this line if you don't want it)
    key: YOUTUBE_API_KEY,
  }).toString();

  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    const message = body?.error?.message ?? res.statusText;
    if (res.status === 403 && ['quotaExceeded', 'dailyLimitExceeded'].includes(reason)) {
      throw new FatalError(`YouTube quota used up for today: ${message}`);
    }
    if (res.status === 400 || (res.status === 403 && reason === 'keyInvalid')) {
      throw new FatalError(`YouTube rejected the API key or request: ${message}`);
    }
    throw new Error(`YouTube API ${res.status}: ${message}`);
  }
  return body.items?.[0]?.id?.videoId ?? null;
}

async function fetchPendingRows() {
  const pageSize = 1000; // Supabase returns at most 1000 rows per request
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`${ID_COLUMN}, category, artist_and_song`)
      .is('embed_url', null)
      .order(ID_COLUMN)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  const rank = (row) => {
    const i = CATEGORY_ORDER.findIndex((c) => c.toLowerCase() === String(row.category).toLowerCase());
    return i < 0 ? CATEGORY_ORDER.length : i;
  };
  return rows
    .filter((row) => !categoryFilter || String(row.category).toLowerCase() === categoryFilter)
    .sort((a, b) => rank(a) - rank(b) || a[ID_COLUMN] - b[ID_COLUMN]);
}

async function main() {
  const pending = await fetchPendingRows();
  const todo = pending.slice(0, limit === Infinity ? undefined : limit);
  console.log(`${pending.length} song(s) without a video${categoryFilter ? ` in ${categoryFilter}` : ''}; searching ${todo.length} now.`);
  console.log(`Each search costs 100 YouTube quota units; the free quota is 10,000 a day (about 100 searches).`);

  let updated = 0;
  let noResult = 0;
  let failed = 0;
  let stopped = false;

  for (const [i, row] of todo.entries()) {
    const label = `[${i + 1}/${todo.length}] ${row.category}: ${row.artist_and_song}`;
    try {
      const videoId = await searchVideoId(`${row.artist_and_song} official audio`);
      if (!videoId) {
        console.warn(`${label} -> no result (left empty, it will be retried next run)`);
        noResult++;
      } else {
        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        const { data, error } = await supabase
          .from(TABLE)
          .update({ embed_url: embedUrl })
          .eq(ID_COLUMN, row[ID_COLUMN])
          .select(ID_COLUMN);
        if (error) throw new Error(`Supabase update failed: ${error.message}`);
        if (!data?.length) {
          throw new FatalError('Update matched 0 rows. Without the service-role key, is an UPDATE policy (RLS) missing for the anon role?');
        }
        console.log(`${label} -> ${embedUrl}`);
        updated++;
      }
    } catch (err) {
      console.error(`${label} -> ${err.message}`);
      if (err instanceof FatalError) {
        console.error('Stopping here. Fix the cause and re-run; songs that already have a video are skipped.');
        stopped = true;
        break;
      }
      failed++;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone${stopped ? ' (stopped early)' : ''}. videos saved: ${updated}, no result: ${noResult}, errors: ${failed}, still without a video: ${pending.length - updated}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

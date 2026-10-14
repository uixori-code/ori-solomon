// Fills the `decoys` column of `songs_trivia`: for every song, 5 REAL songs by the same artist that are not in the game.
// The game's guess dropdown mixes them in with the game's own songs, so a guess has to be recognised, not just spotted.
//
//   node scripts/fill-decoys.mjs --dry-run --limit=10    try 10 artists, print what would be saved, change nothing
//   node scripts/fill-decoys.mjs                         fill every song that has no decoys yet
//   node scripts/fill-decoys.mjs --redo                  also redo songs that already have (or failed to get) decoys
//
// Source: Deezer's public API (no key, no sign-up). Needs SUPABASE_SERVICE_ROLE_KEY in .env to save (the anon key can't write).
// Re-running is safe. Artists Deezer can't find get an empty list and are reported, so you can see which ones to check.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { pickDecoys, rankArtists, splitName } from './lib/decoys.mjs';

const DEEZER = process.env.DEEZER_API_BASE ?? 'https://api.deezer.com'; // override only for tests
const DELAY_MS = 250; // Deezer allows about 50 requests per 5 seconds
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const redo = args.includes('--redo');
const limitArg = args.find((a) => a.startsWith('--limit='))?.slice(8);
const limit = limitArg === undefined ? Infinity : Number(limitArg);
if (!(limit > 0)) {
  console.error('--limit must be a positive number, e.g. --limit=10');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL and a Supabase key in .env');
  process.exit(1);
}
if (!dryRun && !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Saving needs SUPABASE_SERVICE_ROLE_KEY in .env (the anon key cannot write). Use --dry-run to just preview.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function deezer(path, params = {}) {
  const url = new URL(`${DEEZER}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    // Deezer reports its rate limit inside a 200 response.
    if (body?.error?.code === 4 || res.status === 429) {
      await sleep(2000 * attempt);
      continue;
    }
    if (!res.ok || body?.error) throw new Error(`Deezer ${res.status}: ${body?.error?.message ?? res.statusText}`);
    await sleep(DELAY_MS);
    return body;
  }
  throw new Error('Deezer kept rate-limiting; try again in a minute');
}

async function loadRows() {
  const rows = [];
  let withDecoys = true;
  for (let from = 0; ; from += 1000) {
    let { data, error } = await supabase
      .from('songs_trivia')
      .select(withDecoys ? 'id, artist_and_song, decoys' : 'id, artist_and_song')
      .order('id')
      .range(from, from + 999);
    if (error && withDecoys && /decoys/.test(error.message)) {
      if (!dryRun) {
        console.error('The `decoys` column does not exist yet. Run the new lines at the bottom of scripts/schema.sql in the Supabase SQL editor, then re-run.');
        process.exit(1);
      }
      withDecoys = false; // a dry run doesn't need the column
      from -= 1000;
      continue;
    }
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const rows = await loadRows();
const todo = rows.filter((r) => redo || r.decoys === null || r.decoys === undefined);

// One lookup per artist: every song by the artist gets the same decoys, minus the artist's own game songs.
const byArtist = new Map();
for (const row of todo) {
  const { artist, title } = splitName(row.artist_and_song);
  if (!artist) continue;
  const group = byArtist.get(artist) ?? { ids: [], titles: [] };
  group.ids.push(row.id);
  group.titles.push(title);
  byArtist.set(artist, group);
}
// Titles of ALL the artist's game songs (even ones already filled) must never become decoys.
for (const row of rows) {
  const { artist, title } = splitName(row.artist_and_song);
  const group = artist && byArtist.get(artist);
  if (group && !group.titles.includes(title)) group.titles.push(title);
}

console.log(`${rows.length} songs, ${todo.length} need decoys, ${byArtist.size} artists to look up${dryRun ? ' (dry run: nothing is saved)' : ''}`);

let done = 0;
const notFound = [];
for (const [artist, group] of byArtist) {
  if (done >= limit) break;
  done++;
  try {
    // Try the likeliest artists in turn until one has enough tracks (Deezer lists many artists with the same name).
    const ranked = rankArtists(artist, (await deezer('/search/artist', { q: artist, limit: 25 })).data);
    if (ranked.length === 0) throw new Error('artist not found');
    let found = ranked[0];
    let decoys = [];
    for (const candidate of ranked.slice(0, 3)) {
      const top = (await deezer(`/artist/${candidate.id}/top`, { limit: 50 })).data ?? [];
      const picked = pickDecoys({ artistLabel: artist, answerTitles: group.titles, candidates: top.map((t) => t.title) });
      if (picked.length > decoys.length) {
        decoys = picked;
        found = candidate;
      }
      if (decoys.length >= 5) break;
    }
    console.log(`${artist}  (Deezer: ${found.name})  ->  ${decoys.length ? decoys.map((d) => d.split(' - ').slice(1).join(' - ')).join(' | ') : 'NO DECOYS'}`);
    if (decoys.length < 5) notFound.push(`${artist}: only ${decoys.length} found`);
    if (!dryRun) {
      const { error } = await supabase.from('songs_trivia').update({ decoys }).in('id', group.ids);
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    console.log(`${artist}  ->  FAILED: ${err.message}`);
    notFound.push(`${artist}: ${err.message}`);
    if (!dryRun) await supabase.from('songs_trivia').update({ decoys: [] }).in('id', group.ids);
  }
}

console.log(`\nDone: ${done} artists.${notFound.length ? ` ${notFound.length} with fewer than 5 decoys, worth a look:\n  ${notFound.join('\n  ')}` : ''}`);

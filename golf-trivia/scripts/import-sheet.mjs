// Reads the song sheet (.xlsx) and, with --upload, writes the songs to Supabase `songs_trivia`.
//
//   node scripts/import-sheet.mjs songs.xlsx              dry run: read, check, print a report (writes nothing)
//   node scripts/import-sheet.mjs songs.xlsx --upload     same, then upsert into Supabase
//   --only=Rock_Metal,Pop   which categories to import (default: Rock_Metal then Pop)
//   --all                   import every category in the file
//
// Get the file from Google Sheets: File -> Download -> Microsoft Excel (.xlsx).
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { CATEGORY_ORDER, MISS_PENALTY, analyze, dedupeRows, extractRows, selectAndOrder } from './lib/sheet.mjs';

const TABLE = 'songs_trivia';
const BATCH = 200;
const fmt = (n) => n.toLocaleString('en-US');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const upload = args.includes('--upload');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = args.includes('--all') ? null : onlyArg ? onlyArg.slice(7).split(',').map((s) => s.trim()).filter(Boolean) : CATEGORY_ORDER;

if (!file) {
  console.error('Usage: node scripts/import-sheet.mjs <songs.xlsx> [--only=Rock_Metal,Pop | --all] [--upload]');
  process.exit(1);
}

async function readWorkbook(path) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(path);
  } catch (err) {
    console.error(`Could not read "${path}": ${err.message}`);
    console.error('Download it from Google Sheets with File -> Download -> Microsoft Excel (.xlsx).');
    process.exit(1);
  }
  const rows = [];
  const problems = [];
  const tabs = [];
  for (const sheet of workbook.worksheets) {
    const grid = [];
    sheet.eachRow({ includeEmpty: true }, (row, number) => {
      grid[number - 1] = row.values.slice(1);
    });
    const result = extractRows(sheet.name, grid);
    tabs.push(`${sheet.name} (${result.rows.length})`);
    rows.push(...result.rows);
    problems.push(...result.problems);
  }
  return { rows, problems, tabs };
}

const { rows: allRows, problems, tabs } = await readWorkbook(file);
const selected = selectAndOrder(allRows, only);
const { rows, duplicates } = dedupeRows(selected);
const { counts, max, overlaps } = analyze(rows);

console.log(`Read ${tabs.length} tab(s): ${tabs.join(', ')}`);
console.log(`Importing: ${only ? only.join(', then ') : 'all categories'}${only ? '   (use --all for every category)' : ''}`);
console.log(`\nSongs ready: ${fmt(rows.length)}`);
for (const [label, c] of Object.entries(counts)) {
  const levels = Object.entries(c.byLevel).map(([l, n]) => `L${l} ${n}`).join('  ');
  console.log(`  ${label.padEnd(24)} ${String(c.total).padStart(4)}   ${levels}`);
}

if (max) {
  console.log(`\nHighest song: ${max.artist_and_song} at ${fmt(max.exact_views)} views (must stay below ${fmt(MISS_PENALTY)}).`);
}
const tooBig = problems.filter((p) => p.includes('not below'));
console.log(tooBig.length ? `\n!! ${tooBig.length} song(s) at or above the ${fmt(MISS_PENALTY)} penalty were SKIPPED (listed below).` : '\nNo song reaches the 10,000,000,000 penalty.');

if (duplicates.length) {
  console.log(`\nDuplicates dropped (${duplicates.length}), kept the first of each:`);
  for (const { row, firstSeen } of duplicates.slice(0, 10)) {
    console.log(`  ${row.sheet} row ${row.row}: ${row.artist_and_song} (first seen ${firstSeen.sheet} row ${firstSeen.row})`);
  }
}
if (overlaps.length) {
  console.log(`\nLevel-order warnings (${overlaps.length}). Levels should get smaller in views as they get harder; not changed, just reported:`);
  for (const line of overlaps.slice(0, 12)) console.log(`  ${line}`);
}
if (problems.length) {
  console.log(`\nRows skipped (${problems.length}):`);
  for (const line of problems.slice(0, 25)) console.log(`  ${line}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
}

if (!upload) {
  console.log(`\nDry run: nothing was written. Add --upload to write these ${fmt(rows.length)} songs to Supabase.`);
  process.exit(0);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !key) {
  console.error('\nMissing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, key);
console.log(`\nUploading with the ${SUPABASE_SERVICE_ROLE_KEY ? 'service-role' : 'anon'} key...`);

// embed_url is not in the payload, so re-running never wipes videos that were already found.
const payload = rows.map(({ category, region, level, artist_and_song, estimated_views, exact_views, youtube_link }) => ({
  category, region, level, artist_and_song, estimated_views, exact_views, youtube_link,
}));

let written = 0;
for (let i = 0; i < payload.length; i += BATCH) {
  const batch = payload.slice(i, i + BATCH);
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(batch, { onConflict: 'category,region,artist_and_song' })
    .select('id');
  if (error) {
    console.error(`Upload failed at rows ${i + 1}-${i + batch.length}: ${error.message}`);
    console.error('Did you run scripts/schema.sql? With the anon key you also need the TEMP insert/update policies from it.');
    process.exit(1);
  }
  if (!data?.length) {
    console.error('Supabase accepted the request but wrote 0 rows. That is what a missing write policy (RLS) looks like.');
    process.exit(1);
  }
  written += data.length;
  console.log(`  ${written}/${payload.length}`);
}
console.log(`\nDone: ${fmt(written)} songs are in ${TABLE}.`);
console.log('Next: node scripts/fill-embed-urls.mjs --limit=95   (finds a video for each song; Rock_Metal first, then Pop)');

// Sets the video of one song by hand (no YouTube quota used) and removes it from the no-result list.
//   node scripts/set-embed-url.mjs "part of artist - song" <youtubeVideoId>
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { loadSkipped, saveSkipped } from './lib/noresult.mjs';

const [, , needle, videoId] = process.argv;
if (!needle || !/^[\w-]{11}$/.test(videoId ?? '')) {
  console.error('Usage: node scripts/set-embed-url.mjs "part of artist - song" <11-character YouTube video id>');
  process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const { data, error } = await supabase.from('songs_trivia').select('id, artist_and_song').ilike('artist_and_song', `%${needle}%`);
if (error) throw new Error(error.message);
// The sheet can list the same song in two genres; those rows share the same name and get the same video.
const names = [...new Set(data.map((r) => r.artist_and_song))];
if (names.length !== 1) {
  console.error(`Expected one song matching "${needle}", found ${names.length}${names.length ? `: ${names.join(' | ')}` : ''}`);
  process.exit(1);
}
const { error: updateError } = await supabase.from('songs_trivia').update({ embed_url: `https://www.youtube.com/embed/${videoId}` }).in('id', data.map((r) => r.id));
if (updateError) throw new Error(updateError.message);
const skipped = loadSkipped();
for (const row of data) delete skipped[row.id];
saveSkipped(skipped);
console.log(`Saved https://www.youtube.com/embed/${videoId} for: ${names[0]} (${data.length} row(s))`);

// Pure helpers for scripts/fill-decoys.mjs: turn an artist's top tracks into "decoy" song names
// (real songs by the same artist that are not in the game), so the guess dropdown has plausible wrong answers.

/** "Artist - Song" -> { artist, title }. Splits at the first dash. */
export function splitName(name) {
  const match = String(name).match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return match ? { artist: match[1].trim(), title: match[2].trim() } : { artist: null, title: String(name).trim() };
}

// A "(Live)", "[Remastered 2011]" or "- Radio Edit" style tag marks a different version of a song, not a different song.
const VERSION_WORDS = /live|remix|remaster|version|acoustic|instrumental|demo|edit|karaoke|cover|unplugged|mix|session/i;

/** Lower-cases and drops brackets, version tags and punctuation, so "Blank Space (Taylor's Version)" ~ "blank space". */
export function normTitle(title) {
  return String(title)
    .toLowerCase()
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    .replace(/\s[-–—]\s.*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** True for a track that is just another version of a song ("... (Live)", "... - Remastered"). */
export function isVersionOfSomething(title) {
  const tags = [...String(title).matchAll(/[([{]([^)\]}]*)[)\]}]/g)].map((m) => m[1]);
  const dashTail = String(title).match(/\s[-–—]\s(.*)$/)?.[1];
  if (dashTail) tags.push(dashTail);
  return tags.some((tag) => VERSION_WORDS.test(tag));
}

/**
 * Chooses up to `count` decoys from `candidates` (track titles, best first).
 * Skips versions, repeats, and anything that is (or contains) one of the game's own songs by this artist.
 * Returns full "Artist - Title" names, using `artistLabel` exactly as written in the sheet.
 */
export function pickDecoys({ artistLabel, answerTitles, candidates, count = 5 }) {
  const answers = answerTitles.map(normTitle).filter(Boolean);
  const seen = new Set(answers);
  const out = [];
  for (const raw of candidates) {
    const title = String(raw).trim();
    const norm = normTitle(title);
    if (!norm || seen.has(norm) || isVersionOfSomething(title)) continue;
    const clashes = answers.some((a) => (a.length >= 4 && norm.includes(a)) || (norm.length >= 4 && a.includes(norm)));
    if (clashes) continue;
    seen.add(norm);
    out.push(`${artistLabel} - ${title}`);
    if (out.length >= count) break;
  }
  return out;
}

/** "P!nk" -> "pink", "Guns N' Roses" -> "gunsnroses": a form for comparing artist names. */
const artistKey = (name) => String(name).toLowerCase().replace(/!/g, 'i').replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Orders Deezer's artist search results from most to least likely to be the artist meant.
 * Deezer often has many artists with the same name, so results named like the query come first, most popular first
 * (that skips look-alikes such as "Nirvana (UK)"). Hebrew queries match transliterated names, so when nothing is
 * named like the query the search order is kept.
 */
export function rankArtists(query, results) {
  if (!results?.length) return [];
  const q = artistKey(query);
  const named = results.filter((r) => artistKey(r.name).startsWith(q) && artistKey(r.name).length <= q.length + 3);
  if (named.length === 0) return [...results];
  const byFans = [...named].sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0));
  return [...byFans, ...results.filter((r) => !named.includes(r))];
}

/** The single most likely artist, or null. */
export const chooseArtist = (query, results) => rankArtists(query, results)[0] ?? null;

// Pure helpers for reading the song sheet. No file or network access, so they are unit-tested.

/** A song that reaches this many views would cost less to miss than to get right, so it is rejected. */
export const MISS_PENALTY = 10_000_000_000;

/** Categories are imported and embed-filled in this order; any others come after. */
export const CATEGORY_ORDER = ['Rock_Metal', 'Pop'];

const HEADER_NAMES = {
  category: 'category',
  region: 'region',
  level: 'level',
  artistAndSong: 'artist_and_song',
  estimatedViews: 'estimated_views',
  youtubeLink: 'youtube_link',
};

/** Text of a spreadsheet cell, whatever shape the reader gave us (plain, rich text, hyperlink, formula). */
export function cellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim();
    if ('result' in value) return cellText(value.result);
    if ('text' in value) return cellText(value.text);
    if (value instanceof Date) return value.toISOString();
    return '';
  }
  return String(value).trim();
}

/** "1.5B" -> 1500000000, "980M" -> 980000000, "850K" -> 850000, "1,234,567" -> 1234567. Null if unreadable. */
export function parseViews(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  const text = cellText(raw).replace(/,/g, '').replace(/\+$/, '').replace(/\s+/g, '');
  const match = text.match(/^(\d+(?:\.\d+)?)([KMB])?$/i);
  if (!match) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[(match[2] ?? '').toUpperCase()] ?? 1;
  return Math.round(Number(match[1]) * multiplier);
}

/** Finds the header row (the sheet has blank and note rows above it) and maps each column name to its index. */
export function findHeader(grid, searchRows = 15) {
  for (let r = 0; r < Math.min(grid.length, searchRows); r++) {
    const cells = (grid[r] ?? []).map((c) => cellText(c).toLowerCase());
    if (!cells.includes(HEADER_NAMES.artistAndSong)) continue;
    const columns = {};
    for (const [key, name] of Object.entries(HEADER_NAMES)) columns[key] = cells.indexOf(name);
    return { rowIndex: r, columns };
  }
  return null;
}

/**
 * Reads one sheet tab (an array of rows, each an array of cell values).
 * Rows that cannot be used are left out and listed in `problems`; nothing is silently "fixed".
 */
export function extractRows(sheetName, grid) {
  const header = findHeader(grid);
  if (!header) {
    return { rows: [], problems: [`${sheetName}: no header row with Artist_and_Song found`] };
  }
  const missing = Object.entries(header.columns).filter(([, i]) => i < 0).map(([key]) => HEADER_NAMES[key]);
  if (missing.length) {
    return { rows: [], problems: [`${sheetName}: missing column(s) ${missing.join(', ')}`] };
  }

  const { columns } = header;
  const rows = [];
  const problems = [];

  for (let r = header.rowIndex + 1; r < grid.length; r++) {
    const cells = grid[r] ?? [];
    const artistAndSong = cellText(cells[columns.artistAndSong]);
    if (!artistAndSong) continue; // blank row, or only the side-panel notes
    const where = `${sheetName} row ${r + 1} (${artistAndSong})`;

    const category = cellText(cells[columns.category]);
    const region = cellText(cells[columns.region]);
    const level = Number(cellText(cells[columns.level]));
    const estimatedViews = cellText(cells[columns.estimatedViews]);
    const exactViews = parseViews(cells[columns.estimatedViews]);

    if (!category) problems.push(`${where}: empty Category`);
    else if (!region) problems.push(`${where}: empty Region`);
    else if (!Number.isInteger(level) || level < 1 || level > 5) problems.push(`${where}: Level must be 1-5, got "${cellText(cells[columns.level])}"`);
    else if (exactViews === null) problems.push(`${where}: cannot read views "${estimatedViews}"`);
    else if (exactViews >= MISS_PENALTY) problems.push(`${where}: ${exactViews.toLocaleString('en-US')} views is not below the ${MISS_PENALTY.toLocaleString('en-US')} penalty, row skipped`);
    else {
      rows.push({
        category,
        region,
        level,
        artist_and_song: artistAndSong,
        estimated_views: estimatedViews,
        exact_views: exactViews,
        youtube_link: cellText(cells[columns.youtubeLink]) || null,
        sheet: sheetName,
        row: r + 1,
      });
    }
  }
  return { rows, problems };
}

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
export const rowKey = (row) => `${norm(row.category)}|${norm(row.region)}|${norm(row.artist_and_song)}`;

/** Keeps the first of each category+region+song. A repeated key would make an upsert fail. */
export function dedupeRows(rows) {
  const seen = new Map();
  const kept = [];
  const duplicates = [];
  for (const row of rows) {
    const key = rowKey(row);
    if (seen.has(key)) duplicates.push({ row, firstSeen: seen.get(key) });
    else {
      seen.set(key, row);
      kept.push(row);
    }
  }
  return { rows: kept, duplicates };
}

/** Rows whose category is wanted (case-insensitive), ordered by CATEGORY_ORDER, then sheet order. */
export function selectAndOrder(rows, only = null) {
  const wanted = only ? new Set(only.map((c) => c.toLowerCase())) : null;
  const rank = (row) => {
    const i = CATEGORY_ORDER.findIndex((c) => c.toLowerCase() === row.category.toLowerCase());
    return i < 0 ? CATEGORY_ORDER.length : i;
  };
  return rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => !wanted || wanted.has(row.category.toLowerCase()))
    .sort((a, b) => rank(a.row) - rank(b.row) || a.i - b.i)
    .map(({ row }) => row);
}

/** Counts, the highest view count, and adjacent levels whose view ranges overlap (a sign of mislabelled levels). */
export function analyze(rows) {
  const counts = {};
  const groups = new Map();
  let max = null;

  for (const row of rows) {
    const label = `${row.category} / ${row.region}`;
    counts[label] ??= { total: 0, byLevel: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    counts[label].total++;
    counts[label].byLevel[row.level]++;

    if (!groups.has(label)) groups.set(label, new Map());
    const levels = groups.get(label);
    const range = levels.get(row.level) ?? { min: row, max: row };
    if (row.exact_views < range.min.exact_views) range.min = row;
    if (row.exact_views > range.max.exact_views) range.max = row;
    levels.set(row.level, range);

    if (!max || row.exact_views > max.exact_views) max = row;
  }

  const overlaps = [];
  for (const [label, levels] of groups) {
    for (let level = 1; level < 5; level++) {
      const easier = levels.get(level);
      const harder = levels.get(level + 1);
      if (easier && harder && easier.min.exact_views < harder.max.exact_views) {
        overlaps.push(
          `${label}: level ${level} has "${easier.min.artist_and_song}" at ${easier.min.exact_views.toLocaleString('en-US')} views, ` +
            `but level ${level + 1} has "${harder.max.artist_and_song}" at ${harder.max.exact_views.toLocaleString('en-US')}`,
        );
      }
    }
  }
  return { counts, max, overlaps };
}

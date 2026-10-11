import { categoryLabel } from '../categoryLabel';
import { formatViews } from '../format';
import type { Song } from '../types';

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * One self-contained, printable, phone-friendly page that maps each on-screen song number to its title.
 * It reveals every answer, so it is for the host only.
 */
export function buildSongIndexHtml(songs: readonly Song[], generatedOn: string): string {
  const rows = [...songs]
    .sort((a, b) => a.number - b.number)
    .map((song) => {
      const genre = song.category ? categoryLabel(song.category) : '';
      return `<tr><td class="n">${song.number}</td><td dir="auto" class="t">${escapeHtml(song.songName)}</td><td>${escapeHtml(genre)}</td><td>${escapeHtml(song.region ?? '')}</td><td class="c">${song.level}</td><td class="v">${formatViews(song.exactViews)}</td></tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Golf Trivia: host song list</title>
<style>
  body{font:16px system-ui,sans-serif;margin:16px;color:#111}
  h1{font-size:1.2rem;margin:0 0 4px} p{margin:0 0 12px;color:#555}
  input{width:100%;box-sizing:border-box;font-size:1.1rem;padding:10px;margin-bottom:12px;border:2px solid #999;border-radius:10px}
  table{border-collapse:collapse;width:100%} th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left}
  th{position:sticky;top:0;background:#fff} .n{font-weight:700;font-variant-numeric:tabular-nums}
  .c{text-align:center} .v{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  @media print{input{display:none}th{position:static}}
</style></head><body>
<h1>Golf Trivia: host song list (private, shows every answer)</h1>
<p>${songs.length} songs · made ${escapeHtml(generatedOn)}</p>
<input id="q" type="search" placeholder="Type a song number or a name" autofocus>
<table><thead><tr><th>#</th><th>Song</th><th>Genre</th><th>Region</th><th>Level</th><th>Views</th></tr></thead>
<tbody id="rows">
${rows}
</tbody></table>
<script>
  var q=document.getElementById('q'),trs=document.querySelectorAll('#rows tr');
  q.addEventListener('input',function(){var s=q.value.trim().toLowerCase();
    trs.forEach(function(tr){tr.style.display=!s||tr.textContent.toLowerCase().indexOf(s)>-1?'':'none'})});
</script>
</body></html>`;
}

/** Saves the list as a file in the browser. */
export function downloadSongIndex(songs: readonly Song[]): void {
  const html = buildSongIndexHtml(songs, new Date().toLocaleDateString('en-GB'));
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'golf-trivia-song-list.html';
  link.click();
  URL.revokeObjectURL(url);
}

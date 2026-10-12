#!/bin/bash
# Daily job: runs `node scripts/fill-embed-urls.mjs --limit=95`, logs it, shows a notification.
# Started by the LaunchAgent that install-daily-fill.sh sets up. When no songs are left
# without a video it removes that schedule itself.
set -euo pipefail

LABEL="com.golftrivia.fill"
LOG="$HOME/Library/Logs/golf-trivia-fill.log"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$HERE/../.." && pwd)"

# GOLF_NODE_DIR is the folder of the node found at install time (set in the plist).
export PATH="${GOLF_NODE_DIR:+$GOLF_NODE_DIR:}/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$(dirname "$LOG")"

notify() {
  # $1 = message. Passed as an argument so quotes in it cannot break the AppleScript.
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "Golf Trivia video search"' -e 'end run' "$1" >/dev/null 2>&1 || true
}

stamp() { date '+%Y-%m-%d %H:%M:%S'; }

OUT="$(mktemp -t golf-trivia-fill)"
trap 'rm -f "$OUT"' EXIT

# The 21:00 run is only a retry: skip it when this morning's run already succeeded.
if [ "$(date +%H)" -ge 12 ] && grep -q "^\[$(date +%F) [0-9:]*\] RESULT ok" "$LOG" 2>/dev/null; then
  echo "[$(stamp)] evening retry skipped: today's run already succeeded" >> "$LOG"
  exit 0
fi

echo "=== $(stamp) run started ===" >> "$LOG"

cd "$PROJECT"
status=0
node scripts/fill-embed-urls.mjs --limit=95 >"$OUT" 2>&1 || status=$?

while IFS= read -r line || [ -n "$line" ]; do
  printf '[%s] %s\n' "$(stamp)" "$line" >> "$LOG"
done <"$OUT"
echo "[$(stamp)] exit code: $status" >> "$LOG"

# Rewrite the "no result" report from the whole log: songs whose latest search found nothing.
REPORT="$PROJECT/no-result-report.md"
{
  echo "# Songs with no video found (to fix later)"
  echo
  echo "Updated $(stamp). The script retries these on every run. If one keeps failing, paste"
  echo "\`https://www.youtube.com/embed/<videoId>\` into that row's \`embed_url\` in Supabase (costs no quota)."
  echo
  awk '
    match($0, /^\[[0-9-]+ [0-9:]+\] \[[0-9]+\/[0-9]+\] /) {
      day = substr($0, 2, 10)
      rest = substr($0, RLENGTH + 1)
      i = index(rest, " -> ")
      if (i == 0) next
      song = substr(rest, 1, i - 1)
      if (!(song in first)) { first[song] = ++n; order[n] = song }
      if (rest ~ / -> no result/) { bad[song] = 1; when[song] = day } else { delete bad[song] }
    }
    END {
      for (k = 1; k <= n; k++) if (order[k] in bad) { c++; rows = rows "| " c " | " order[k] " | " when[order[k]] " |\n" }
      if (c == 0) print "No songs are waiting: every searched song found a video."
      else { print c " song(s) with no result (Category: Song, last tried):\n"; print "| # | Song | Last tried |"; print "|---|------|------------|"; printf "%s", rows }
    }' "$LOG"
} > "$REPORT" 2>/dev/null || true

if grep -q "^0 song(s) without a video" "$OUT"; then
  notify "All songs have a video"
  echo "[$(stamp)] nothing left to do, removing the schedule" >> "$LOG"
  # Last step: the uninstall also stops this job.
  exec "$HERE/install-daily-fill.sh" --uninstall
elif grep -q "YouTube quota used up" "$OUT"; then
  echo "[$(stamp)] RESULT failed (quota)" >> "$LOG"
  notify "Quota used up; will retry at 21:00 (or tomorrow 10:15)"
elif [ "$status" -ne 0 ]; then
  echo "[$(stamp)] RESULT failed (error)" >> "$LOG"
  notify "Error: $(grep -v '^[[:space:]]*$' "$OUT" | tail -n 1 | cut -c1-150)"
else
  echo "[$(stamp)] RESULT ok" >> "$LOG"
  summary="$(grep '^Done' "$OUT" | tail -n 1 || true)"
  added="$(printf '%s' "$summary" | sed -n 's/.*videos saved: \([0-9]*\).*/\1/p')"
  left="$(printf '%s' "$summary" | sed -n 's/.*still without a video: \([0-9]*\).*/\1/p')"
  if [ -n "$added" ] && [ -n "$left" ]; then
    notify "$added videos added, $left songs left"
  else
    notify "Finished, see ~/Library/Logs/golf-trivia-fill.log"
  fi
fi

#!/bin/bash
# Installs (or removes) a macOS LaunchAgent that runs run-daily-fill.sh every day at 06:35, plus a 21:00 retry if the morning run failed.
#   ./install-daily-fill.sh              install and load
#   ./install-daily-fill.sh --run-now    run the job now (to test)
#   ./install-daily-fill.sh --status     loaded or not, plus the last log lines
#   ./install-daily-fill.sh --uninstall  unload and delete the plist
# Touches only the plist below and ~/Library/Logs/golf-trivia-fill.log. No sudo.
set -euo pipefail

LABEL="com.golftrivia.fill"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/golf-trivia-fill.log"
DOMAIN="gui/$(id -u)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$HERE/../.." && pwd)"
RUNNER="$HERE/run-daily-fill.sh"

xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
is_loaded() { launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; }

case "${1:-install}" in
  install|--install)
    NODE_BIN="$(command -v node || true)"
    [ -n "$NODE_BIN" ] || { echo "node not found on PATH" >&2; exit 1; }
    NODE_DIR="$(dirname "$NODE_BIN")"
    [ -f "$PROJECT/scripts/fill-embed-urls.mjs" ] || { echo "fill-embed-urls.mjs not found in $PROJECT" >&2; exit 1; }
    chmod +x "$RUNNER" "$HERE/install-daily-fill.sh"
    mkdir -p "$HOME/Library/LaunchAgents" "$(dirname "$LOG")"
    cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$(xml_escape "$RUNNER")</string>
  </array>
  <key>WorkingDirectory</key><string>$(xml_escape "$PROJECT")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>GOLF_NODE_DIR</key><string>$(xml_escape "$NODE_DIR")</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>35</integer></dict>
    <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$(xml_escape "$LOG")</string>
  <key>StandardErrorPath</key><string>$(xml_escape "$LOG")</string>
</dict>
</plist>
PLISTEOF
    plutil -lint "$PLIST" >/dev/null
    is_loaded && launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "Installed: runs daily at 06:35, with a retry at 21:00 if that failed (a missed run happens when the Mac wakes)."
    echo "  node:    $NODE_BIN"
    echo "  project: $PROJECT"
    echo "  plist:   $PLIST"
    echo "  log:     $LOG"
    ;;
  --run-now)
    is_loaded || { echo "Not installed. Run $0 first." >&2; exit 1; }
    launchctl kickstart -k "$DOMAIN/$LABEL"
    echo "Started. Follow it with: tail -f \"$LOG\""
    ;;
  --status)
    if is_loaded; then echo "Status: loaded"; else echo "Status: not loaded"; fi
    [ -f "$PLIST" ] && echo "Plist: $PLIST" || echo "Plist: none"
    if [ -f "$LOG" ]; then echo "--- last log lines ($LOG) ---"; tail -n 15 "$LOG"; else echo "No log yet."; fi
    ;;
  --uninstall)
    # Delete the plist first so the job is gone even if unloading stops this very process.
    rm -f "$PLIST"
    is_loaded && launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    echo "Uninstalled. (The log file $LOG was left in place.)"
    ;;
  *)
    echo "Usage: $0 [--run-now | --status | --uninstall]" >&2; exit 2 ;;
esac

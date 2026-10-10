#!/usr/bin/env bash
# =============================================================================
# Planet Oops-a-Daisy: Local Game Server Launcher
# =============================================================================

# Resolve game directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

PORT=8000

# Try to find local IP address for iPad / local network play
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi

echo "============================================================"
echo "🚀 PLANET OOPS-A-DAISY: LOCAL SERVER"
echo "============================================================"
echo ""
echo "  🖥️  Play on this Mac:"
echo "      http://localhost:${PORT}"
echo ""
if [ -n "$LOCAL_IP" ]; then
  echo "  📱 Play on your iPad (Safari on same Wi-Fi):"
  echo "      http://${LOCAL_IP}:${PORT}"
  echo ""
  echo "  💡 Pro Tip for iPad: In Safari, tap Share -> 'Add to Home Screen'!"
fi
echo "============================================================"
echo "Press Ctrl+C to stop the server."
echo ""

# Automatically open the game in your Mac browser
(sleep 1 && open "http://localhost:${PORT}") &

# Start python static server
python3 -m http.server "$PORT"

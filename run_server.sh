#!/usr/bin/env bash
# =============================================================================
# Planet Oops-a-Daisy: Local Game Server Launcher
#   ./run_server.sh        build the game and serve it (like the real app, works offline once installed)
#   ./run_server.sh --dev  live-reloading dev server (for making changes)
# =============================================================================

# Resolve game directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

PORT=8000

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ Node.js is not installed. Get it from https://nodejs.org (or: brew install node)"
  exit 1
fi

# Install dependencies the first time (or after package.json changes)
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "📦 Installing game dependencies..."
  npm install || exit 1
  touch node_modules
fi

# Try to find local IP address for iPad / local network play
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi

if [ "$1" != "--dev" ]; then
  echo "🔨 Building the game..."
  npm run build >/dev/null || { echo "❌ Build failed. Run 'npm run build' to see why."; exit 1; }
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
(sleep 2 && open "http://localhost:${PORT}") &

if [ "$1" = "--dev" ]; then
  npx vite --host --port "$PORT" --strictPort
else
  npx vite preview --host --port "$PORT" --strictPort
fi

# 🚀 Planet Oops-a-Daisy

A funny stealth-maze game made up by a parent and their kid. Leo the tourist crash-landed on a planet where
everyone's legs face backwards, so **their eyes look where they've been, not where they're going**.
Sneak, run, honk, moonwalk and donut your way to the ship parts.

See **[DESIGN.md](DESIGN.md)** for the rules, alien cast, level plan and tech notes.

## Play / develop

```bash
npm install        # uses the public npm registry (see .npmrc)
npm run dev        # http://localhost:8000, also on your Wi-Fi IP for the iPad
npm test           # mechanic tests + level validation (runs the real sim)
npm run build      # static site in dist/
```

On iPad: open the dev/preview URL in Safari → Share → **Add to Home Screen**. It installs with an app icon, runs
full screen and works offline after the first visit (production build: `npm run build && npm run preview`).

Controls: arrows/WASD move · Shift run (noisy!) · 1/Space honk · 2/Q moonwalk · 3/E donut · P pause.
Touch: left stick, right buttons.

## Levels

12 campaign levels in 4 zones (Suburbia, School, Market, Spaceport) plus a sandbox. All are unlocked; stars are
saved in the browser.

* The campaign maps come from `tools/gen-campaign.py`:
  `python3 tools/gen-campaign.py && for f in levels/drafts/[0-9]*.mjs; do node tools/draft-level.mjs $f; done`
* Or open any `levels/<id>.tmj` in [Tiled](https://www.mapeditor.org/) and edit it there (conventions in DESIGN.md).
* The campaign order lives in `src/sim/campaign.ts`.
* `npm test` validates every map and has bots play every level on every difficulty.

## Extras

* Opening comic, zone cutscenes and an ending (`src/game/StoryScene.ts`); living title screen (`TitleScene.ts`).
* Rewards: outfits unlocked by stars, a hidden sock in every level, a sticker book, share cards (`src/game/progress.ts`).
* Characters are drawn in code (`src/game/art/`); open the game with `?gallery` to see every character in every pose.
* Music: CC0 tracks by Juhani Junkala (see `public/music/CREDITS.txt`). App icons: `node tools/make-icons.mjs`.

## Layout

```
src/sim/    game rules (pure TypeScript, deterministic 60 Hz) — tested directly
src/game/   Phaser rendering, controls, sound, UI
levels/     Tiled maps + tileset
tests/      Vitest
tools/      tileset + ASCII level drafting
legacy/     the original prototype (open legacy/index.html)
```

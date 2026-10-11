# 🎓 Learn how Planet Oops-a-Daisy works

Never made a game before? Good, this is for you, whether you're 10 or 40.

## Two ways to learn

1. **🎮 Oops Academy (interactive).** Run `./run_server.sh` and open **http://localhost:8000/learn.html**, or press
   🎓 *How it's made* on the title screen. It has 12 chapters with live demos you can poke, sliders, quizzes and
   small coding challenges, all running the real game code.
2. **📖 Read the code.** Every file starts with a **📘 LESSON** explaining the big idea, then comments explain
   each part. Look out for:

| Marker | Meaning |
|---|---|
| 📘 LESSON | The big idea of this file or section |
| 💡 EXAMPLE | A worked example with real numbers |
| 🧪 TRY IT | Change something, save, and see what happens |
| 🧠 QUIZ Qn | Test yourself (answers in [ANSWERS.md](ANSWERS.md)) |

## Suggested reading order

| # | File | What you learn |
|---|---|---|
| 1 | `src/sim/config.ts` | All the numbers that make the game feel the way it does |
| 2 | `src/sim/level.ts` | How a level is stored: grids, tiles, objects |
| 3 | `src/sim/grid.ts` | Collision, line of sight, pathfinding |
| 4 | `src/sim/world.ts` | **The rules**: the game loop step, Leo's movement, alien brains, vision, chases, gadgets, hugs |
| 5 | `src/game/GameScene.ts` | The game loop with a fixed timestep; turning events into sounds and effects |
| 6 | `src/game/controls.ts` | Keyboard and touch input |
| 7 | `src/game/art/characters.ts` | Drawing characters; walking with sine waves |
| 8 | `src/game/draw.ts`, `art/themes.ts`, `fx.ts` | Shapes, colours, vision cones, zone looks, particles |
| 9 | `src/game/sound.ts` | Making sound effects from maths; music crossfades |
| 10 | `src/game/StoryScene.ts`, `TitleScene.ts`, `src/main.ts` | Story panels, menus, how it all starts |
| 11 | `src/sim/bot.ts`, `tests/` | The bots that prove every level can be beaten, and the tests |

## Change something!

The best way to learn is to break things (you can always undo with git):
- Make Leo super fast: `walkSpeed` in `src/sim/config.ts`.
- Give aliens eagle eyes: the Stroller's `vision` in `KINDS`.
- Add your own speech bubbles: `LINES` in `src/game/GameScene.ts`.
- Design a level: copy a draft in `levels/drafts/` and run `node tools/draft-level.mjs levels/drafts/<yours>.mjs`.

Then run `npm test` and see whether the robots can still beat your level.

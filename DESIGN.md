# Planet Oops-a-Daisy — Game Design

A funny stealth-maze game for a 10-year-old (and their parent). Leo the tourist crash-landed on a planet
where everyone's legs face backwards. Sneak through 4 zones, collect 4 ship parts, blast off.

**Pillars**
1. **Funny first.** Every mechanic comes from the joke: their eyes face one way, their feet the other.
2. **Readable.** A 10-year-old can look at the screen and know what an alien can see and what it will do.
3. **Fair.** Being caught is always the player's fault and never costs much. No soft-locks, no luck.
4. **Choices.** Every level has at least two ways through: sneaky and slow, or fast and risky.

---

## 1. The core joke as the core mechanic

> **"They see where they've been, not where they're going."**

* An alien's **vision cone points behind its walking direction.** Its eyes face backwards relative to its feet.
* Standing **in front of** a walking alien is invisible but in its path. Standing **behind** it is in plain view.
* When an alien turns around, **its gaze flips.** That instant is both the danger and the opening.
* Cones are drawn on the floor (soft wedge) so the rule is visible, not memorised.

## 2. Player

| Action | Keyboard | Touch | Effect |
|---|---|---|---|
| Walk | Arrows / WASD | Left thumb stick | Quiet. Default speed. |
| Run | Hold **Shift** | Hold RUN | ~1.6x faster. Every footstep makes a **noise ring** (3 tiles) that aliens hear through walls. |
| Honk | **1** / Space | HONK | Stuns aliens within 2 tiles for 1.5s. **Loud:** every alien within 7 tiles comes to investigate. |
| Moonwalk | **2** | MOON | Disguise: walk backwards like a local. Aliens that see you shrug it off. Half speed, no running, touching still bonks. |
| Donut | **3** / E | DONUT | Thrown up to 3 tiles in the facing direction (stops at walls). The nearest alien within smelling range walks over and eats for 3s. |

Gadgets use cooldowns (tuned per difficulty and per level).

## 3. Detection and chases

* **Suspicion meter.** When you're in a cone, a "?" meter fills (faster when close). The alien stops and stares.
  Leave the cone and it drains. Full meter = "!" = chase.
* **Chasing = hug attempt.** Aliens love tourists. A chasing alien shouts "HUG!" and sprints along the maze.
* **Backwards legs can't corner.** Chasers are faster than walking on straights (about running speed), but at every
  turn they must stop and untangle their legs ("SKRRT!"). **Straight hallways are deadly, corners are your friend.**
* **Losing them.** Out of sight for a moment → the alien goes to where it last saw you, looks around, gives up and
  returns to its route.
* **Noise.** Running footsteps and honks pull aliens to the spot of the noise (investigate, not chase).

## 4. Getting hugged

* Contact with an awake alien = a **HUG** ("I LOVE TOURISTS!"): you're stuck for 1.2s with hearts popping out,
  then you wriggle free. Lose 1 heart.
* "Ooh, shiny!": a carried key is put back where you found it.
* You respawn at the **last checkpoint flag**. Aliens calm down. Other progress (gates, levers, terminals) is kept.
* Chasers give up when they lose you, and get **tired** after ~8s even if they can still see you ("Huff... puff...").
* Out of hearts → retry the level (fast, no game-over shame).

## 5. Stars (replay and difficulty)

Each level awards up to 3 stars: ⭐ finish · ⭐ under par time · ⭐ never chased.
A kid can finish everything; three-starring is the parent challenge. Easy / Normal / Hard tunes hearts, alien speed
and cooldowns.

## 6. Alien cast

| Alien | Behaviour | How to beat it |
|---|---|---|
| **Stroller** | Walks a fixed route, cone behind | Approach from the front, slip past when it turns |
| **Lookout** | Stands still, swings its gaze every few seconds | Timing |
| **Texter** | Glued to phone: blind, wanders randomly | Positioning; it still bonks |
| **Hugger** (Blorp) | Dozes. Wakes on sight or noise and sprints. Awful at corners. | Escape through twisty paths |
| **Recess Kid** | Fast, short wide sight, loops the playground | One donut pulls in every kid nearby |
| **Heavy** | Slow, huge, wears headphones (deaf), too big to honk. The only one heavy enough for pressure plates | Donut-lure it |
| **Scooter rider** | Fixed lane, very fast, blind, can't stop | Frogger-style timing; honk makes it wobble |
| **Drone** | Looks FORWARDS, not fooled by moonwalk, can't hug. When its meter fills it BEEPs and calls everyone over | Timing, cover |

Locals' backwards feet make them immune to conveyor belts (only Leo gets carried).

## 7. Levels — 4 zones × 3 levels

Each level introduces one idea, then the zone finale combines them.

**Zone 1 — Suburbia: reading aliens** (part: ⚡ Spark Plug)
* **1-1 Hello Blorp.** Tutorial lawn, 2 Strollers. Learn the backwards cone. Key → garden gate.
* **1-2 Neighbourhood Watch.** Lookouts at junctions, hedge nooks to hide in.
* **1-3 Hug Run.** Grabbing the spark-plug key sets off the alarm and wakes Blorp. Escape through twisty hedges to the ship.

**Zone 2 — School: noise and speed** (part: 🔋 Hyper-Battery)
* **2-1 Hall Monitors.** Run vs walk. Squeaky tiles make noise even when walking; carpets are silent.
* **2-2 Conveyor Halls.** Belts are faster than walking. Levers flip every belt. Or take the noisy side hall.
* **2-3 Recess.** Groups of kids. Donut introduced. Collect 3 battery cells.

**Zone 3 — Market: donut tactics** (part: 🛞 Steering Wheel)
* **3-1 Snack Stall.** A deaf, honk-proof Heavy blocks the shop door. Donut it out (or let it chase you away).
* **3-2 Plate Alley.** Only the Heavy holds the plate; the gate is open only while it eats. Lure, then sprint.
* **3-3 Scooter Alley.** Cross the scooter lanes. Honk makes riders wobble.

**Zone 4 — Spaceport: everything** (part: 🔑 Launch Key)
* **4-1 Terminals.** Each hack takes 2s standing still.
* **4-2 Searchlights.** Drones on tracks; moonwalk doesn't fool them.
* **4-3 Launch!** Grabbing the key sets off the alarm: everyone investigates and patrols faster. Escape to the rocket.

## 8. Level rules (checked by automated tests)

1. Every objective is reachable, and gated objectives are **not** reachable without their gate.
2. A careful player can finish without gadgets, unless the level hands you a gadget to teach it.
3. No soft-locks: gates never close on the player; the player can always get back to a checkpoint.
4. One new idea per level.
5. Bot playthroughs on the real simulation (`tests/bot.ts`): the careful bot wins every level on Easy, Normal and Hard
   without gadgets; the "run straight and spam gadgets" bot never gets a clean run (it loses, gets chased or hugged).

---

## 9. Presentation

* Side-view character rigs over a top-down map, so the backwards knees and toes are visible (`src/game/art/characters.ts`).
* Juice: particles, skid marks, hit pause, camera punch, chase slow-mo, level-start reveal.
* Four zone looks (floors, walls, obstacles, decorations, sky life) from the same tile codes (`art/themes.ts`).
* Story: opening comic, zone cutscenes, ending + credits; living title screen with the ship being rebuilt.
* Sound: CC0 music per zone with a chase layer crossfade, footsteps per surface, heartbeat, alien voices.
* Rewards: outfits (stars), hidden socks, sticker book, share card. Installable, offline-capable web app.

## 10. Technology

* **TypeScript + Vite**, static build, playable in iPad Safari (Add to Home Screen).
* **`src/sim/`**: pure TypeScript game rules, fixed 60 Hz step, no browser APIs. Same input → same result.
  Emits events (spotted, bonk, skid, honk…) that the renderer turns into sounds, text and shakes.
* **`src/game/`**: Phaser scenes that draw the sim state and feed it input. No game rules here.
* **`levels/`**: maps made in **Tiled** (free editor, mapeditor.org), saved as `.tmj` JSON.
* **`tests/`**: Vitest. Mechanic tests, level validation, bot playthroughs.

### Tiled conventions

* Tile size 48px. Tileset `levels/tiles.tsx` (`tiles.png`).
* Tile layer **`ground`** (tile ids in `tiles.tsx`): 1 floor, 2 wall, 3 hedge, 4 gate (opens with a key, stays open),
  5 carpet (silent), 6 squeaky (always noisy), 7-10 conveyor up/right/down/left, 11 pressure plate, 12 laser (open while a
  Heavy stands on any plate), 13 shield (drops once every terminal is hacked).
* Map properties: `name`, `hint`, `parTime` (seconds), `alarmAfter` (pickups before the alarm, 0 = none).
* Object layer **`objects`**. Use the object's **Class** (type) field:
  * `PlayerStart` (point)
  * `Checkpoint` (point)
  * `Key`, `Item`, `Lever`, `Terminal` (point). Collect every Item to win.
  * `Alien` (point or polyline). Properties: `kind` (`stroller`, `lookout`, `hugger`, `kid`, `heavy`, `scooter`, `drone`),
    optional `speed`, `facing` (degrees), `turnEvery` (lookouts), `pause` (seconds at each waypoint). A polyline is the
    patrol route (ping-pong); set `loop = true` to cycle instead.
* Campaign maps are generated from `tools/gen-campaign.py` → `levels/drafts/*.mjs` → `tools/draft-level.mjs` → `levels/*.tmj`.
  Either edit the generator and regenerate, or edit the `.tmj` in Tiled directly (then stop regenerating that level).

## 11. Tunable numbers (src/sim/config.ts)

Per-alien-kind numbers (speed, sight, radius, deaf/honk-proof…) are in `KINDS`.

| Thing | Normal |
|---|---|
| Walk / run / moonwalk speed | 150 / 240 / 75 px/s |
| Stroller patrol / chase top speed | 70 / 225 px/s |
| Chase gives up: no sight / tired | 3s / 8s |
| Alarm: vision / patrol speed | x1.25 / x1.25 |
| Conveyor speed | 200 px/s |
| Chase corner: stop + untangle | 0.45s |
| Vision range / half-angle | 5 tiles / 40° |
| Suspicion fill time (mid range) | ~0.7s |
| Run noise radius | 3 tiles |
| Honk stun radius / time / hear radius / cooldown | 2 tiles / 1.5s / 7 tiles / 8s |
| Moonwalk time / cooldown | 4s / 10s |
| Donut range / eat time / smell radius / cooldown | 3 tiles / 3s / 8 tiles / 10s |
| Hearts | 5 Easy / 3 Normal / 2 Hard |

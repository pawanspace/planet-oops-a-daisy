// =============================================================================
// 📘 LESSON: The World, where all the game RULES live
// =============================================================================
// This file is the heart of the game. It knows where everyone is and what they're doing, and it has ONE main
// job: `step(input)` moves the whole world forward by a tiny slice of time (1/60 of a second).
//
// Think of it like a flip-book. Each call to step() draws the next page:
//   1. Read what the player is pressing (the `Input`).
//   2. Move Leo.          3. Check pickups (keys, ship parts...).
//   4. Run every alien's brain.          5. Check if anyone got hugged.
// Do that 60 times a second and it looks like smooth motion.
//
// IMPORTANT DESIGN RULE: this file never draws anything, never plays sounds and never reads the clock.
// It only changes numbers. Things it wants other parts of the game to know about (a hug! a skid!) are written
// down as EVENTS, and the drawing code (src/game/GameScene.ts) reads them afterwards to show effects.
//
// Why bother? Because then the SAME rules can run:
//   • in the real game (with graphics),
//   • in the tests (no screen at all, 1000s of times faster),
//   • inside the bots that play every level to prove it can be beaten,
//   • in the Oops Academy demos.
// And because it never uses randomness or the clock, the same inputs always give exactly the same result
// ("deterministic"). That makes bugs repeatable and tests reliable.
//
// 🧠 QUIZ Q13: Why would it be a problem for the tests if this file used Math.random()?
// =============================================================================
import { CONFIG, DIFFICULTY, DT, KINDS, TILE, type AlienKind, type Difficulty, type KindSpec } from './config';
import { Grid, center, tileOf } from './grid';
import { CONVEYOR_DIR, T, isConveyor, type AlienSpec, type LevelData, type TileCode, type Vec } from './level';

/**
 * What the player is doing during one step.
 * 💡 EXAMPLE: holding the right arrow and Shift = { x: 1, y: 0, run: true, honk: false, ... }
 *    A thumb stick pushed half-way up-left could be { x: -0.35, y: -0.35, ... }.
 */
export interface Input {
  x: number;          // -1 (left) .. 1 (right)
  y: number;          // -1 (up)   .. 1 (down)
  run: boolean;
  honk: boolean;      // gadget buttons are "edge-triggered": true only for the ONE step they were pressed
  moonwalk: boolean;
  donut: boolean;
}
export const NO_INPUT: Input = { x: 0, y: 0, run: false, honk: false, moonwalk: false, donut: false };

/**
 * 📘 An alien's "state" is its current mood or job. Its brain (updateAlien) does something different in each.
 * This idea is called a STATE MACHINE. The most important moves between states are:
 *
 *    patrol ──sees you──▶ suspicious ──meter full──▶ chase ──loses you / gets tired──▶ search ──▶ return ──▶ patrol
 *       │                      └──meter empties──▶ (back to what it was doing)
 *       └──hears a noise──▶ investigate ──looks around──▶ return
 *
 * plus: stunned (honked), toDonut → eating, sleep → waking (huggers), hugging (caught you!).
 * 🧠 QUIZ Q14: An alien is 'eating'. Can it see you? (Look for AWAKE_CALM below.)
 */
export type AlienState =
  | 'patrol' | 'suspicious' | 'chase' | 'search' | 'investigate' | 'return'
  | 'stunned' | 'toDonut' | 'eating' | 'sleep' | 'waking' | 'hugging';

/** Everything that changes about one alien while the game runs. */
export interface Alien {
  id: number;
  kind: AlienKind;
  spec: AlienSpec;     // what the level file said (route, speed...) — never changes
  x: number;
  y: number;
  heading: Vec;        // which way it's walking: (1,0) right, (0,-1) up... or (0,0) when standing
  speed: number;       // px/s right now
  look: number;        // where its EYES point, in radians (0 = right, π/2 = down, π = left, -π/2 = up)
  state: AlienState;
  resume: AlienState;  // what to go back to after being suspicious
  stateT: number;      // a timer whose meaning depends on the state (time left eating, time spent chasing...)
  sus: number;         // the "?" suspicion meter: 0 (calm) .. 1 (full → chase!)
  routeIdx: number;    // which waypoint of its route it's walking to
  routeDir: 1 | -1;    // walking forwards or backwards along the route (for ping-pong routes)
  pauseT: number;      // time left pausing at a waypoint
  skidding: boolean;   // sliding to a stop at a corner
  untangle: number;    // time left untangling its legs after a skid
  lastSeen: Vec;       // where it last saw Leo
  lostT: number;       // how long it has been unable to see Leo during a chase
  goal: Vec;           // where it's walking to when investigating / searching (px)
  lookoutT: number;    // lookouts: time until the next turn
  baseLook: number;    // lookouts: the direction they swing back to
  alarmT: number;      // drones: cooldown between alarms
}

/** Everything that changes about Leo while the game runs. */
export interface Player {
  x: number;
  y: number;
  facing: 0 | 1 | 2 | 3; // 0 up, 1 right, 2 down, 3 left (used to aim the donut)
  moving: boolean;
  running: boolean;
  hearts: number;
  maxHearts: number;
  invuln: number;      // seconds of "can't be hugged" left after a hug
  keys: number;        // keys being carried
  carried: Vec[];      // where each carried key came from (so a hug can put it back)
  moonwalkT: number;   // seconds of moonwalk disguise left
  cd: { honk: number; moonwalk: number; donut: number }; // gadget cooldowns: seconds until usable again
  footT: number;       // time until the next running footstep noise
  respawn: Vec;        // where you come back after a hug (the last checkpoint flag)
}

export interface Pickup { x: number; y: number; taken: boolean; home?: Vec }
export interface Lever { x: number; y: number; armed: boolean; flipped: boolean }
export interface Terminal { x: number; y: number; progress: number; done: boolean }
export interface Donut { x: number; y: number; eater: number; age: number }
export interface Hug { alien: number; t: number }

/**
 * EVENTS: little notes the world leaves for the drawing/sound code. "Alien 3 skidded at (240, 96)".
 * The world never makes noise itself; GameScene reads these notes every frame and plays sounds, shows text,
 * shakes the camera... (see GameScene.onEvent).
 */
type AlienEventType = 'spotted' | 'suspicious' | 'lost' | 'skid' | 'bump' | 'stun' | 'investigate' | 'fooled'
  | 'eat' | 'wake' | 'calm' | 'hug' | 'stolen' | 'beep' | 'tired';
type PlaceEventType = 'sock' | 'bonk' | 'honk' | 'moonwalk' | 'donut' | 'noDonutRoom' | 'key' | 'gate' | 'item' | 'checkpoint'
  | 'win' | 'lose' | 'squeak' | 'lever' | 'hack' | 'shieldDown' | 'laserOpen' | 'laserClose' | 'tooLight' | 'alarm';

export type GameEvent =
  | { type: AlienEventType; alien: number; x: number; y: number }
  | { type: PlaceEventType; x: number; y: number }
  | { type: 'noise'; x: number; y: number; radius: number };

export type Status = 'playing' | 'won' | 'lost';

/** Leo's facing (0..3) as a direction: up, right, down, left. */
const FACING_VEC: Vec[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const ZERO: Vec = { x: 0, y: 0 };
/** States in which an alien is awake, calm and USING ITS EYES. (Eating, sleeping, stunned... aliens can't see.) */
const AWAKE_CALM: AlienState[] = ['patrol', 'return', 'search', 'investigate'];
/** What each belt turns into when a lever is pulled. */
const FLIP: Partial<Record<TileCode, TileCode>> = {
  [T.ConvUp]: T.ConvDown, [T.ConvDown]: T.ConvUp, [T.ConvLeft]: T.ConvRight, [T.ConvRight]: T.ConvLeft,
};

// #region angleDiff
/**
 * The difference between two angles, always between -π and +π (that is, -180° .. +180°).
 * Angles wrap around: 350° and 10° are only 20° apart, not 340°! This function handles that.
 * 💡 EXAMPLE: angleDiff(10°, 350°) = +20°.   angleDiff(90°, 0°) = +90°.
 */
function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// #endregion angleDiff

export class World {
  readonly level: LevelData;
  readonly grid: Grid;
  readonly difficulty: Difficulty;
  readonly player: Player;
  readonly aliens: Alien[];
  readonly keys: Pickup[];
  readonly items: Pickup[];
  readonly checkpoints: Vec[];
  readonly levers: Lever[];
  readonly terminals: Terminal[];
  readonly socks: Pickup[];
  donut: Donut | null = null;     // the donut on the floor (only one at a time)
  hug: Hug | null = null;         // non-null while Leo is being hugged
  alarm = false;
  status: Status = 'playing';
  time = 0;                       // seconds since the level started
  timesChased = 0;                // for the "never chased" star
  pickups = 0;                    // keys + items picked up (for the alarm)
  private events: GameEvent[] = [];
  /** Pathfinding results we've already worked out, so we don't redo them every frame (a "cache"). */
  private fields = new Map<number, Float64Array>();
  private lastTile = -1;

  /** Build a fresh world from level data: copy everything that can change, so the level itself stays untouched. */
  constructor(level: LevelData, difficulty: Difficulty = 'normal') {
    this.level = level;
    this.difficulty = difficulty;
    this.grid = new Grid(level.width, level.height, level.tiles);
    const d = DIFFICULTY[difficulty];
    this.player = {
      x: level.start.x, y: level.start.y, facing: 1, moving: false, running: false,
      hearts: d.hearts, maxHearts: d.hearts, invuln: 0, keys: 0, carried: [], moonwalkT: 0,
      cd: { honk: 0, moonwalk: 0, donut: 0 }, footT: 0, respawn: { ...level.start },
    };
    // `{ ...k }` copies an object ("spread"). We copy so that taking a key in one game doesn't remove it from the level.
    this.keys = level.keys.map(k => ({ ...k, taken: false, home: { ...k } }));
    this.items = level.items.map(k => ({ ...k, taken: false }));
    this.checkpoints = level.checkpoints.map(c => ({ ...c }));
    this.levers = level.levers.map(l => ({ ...l, armed: true, flipped: false }));
    this.terminals = level.terminals.map(t => ({ ...t, progress: 0, done: false }));
    this.socks = level.socks.map(k => ({ ...k, taken: false }));
    this.aliens = level.aliens.map((spec, id) => this.makeAlien(spec, id));
  }

  /** Create an alien from its level spec. It starts looking AWAY from where it's about to walk (backwards eyes!). */
  private makeAlien(spec: AlienSpec, id: number): Alien {
    const k = KINDS[spec.kind];
    let look = spec.facing ?? 0;
    if (spec.facing === undefined && spec.route.length > 1) {
      const dx = spec.route[1].x - spec.x, dy = spec.route[1].y - spec.y;
      // Math.atan2(dy, dx) turns a direction into an angle. Flipping the signs points it the opposite way.
      look = k.backwards ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx);
    }
    return {
      id, kind: spec.kind, spec, x: spec.x, y: spec.y, heading: { ...ZERO }, speed: 0, look,
      state: spec.kind === 'hugger' ? 'sleep' : 'patrol', resume: 'patrol', stateT: 0, sus: 0,
      routeIdx: spec.route.length > 1 ? 1 : 0, routeDir: 1, pauseT: 0, skidding: false, untangle: 0,
      lastSeen: { x: spec.x, y: spec.y }, lostT: 0, goal: { x: spec.x, y: spec.y },
      lookoutT: spec.turnEvery ?? CONFIG.alien.lookoutTurnEvery, baseLook: look, alarmT: 0,
    };
  }

  /** The numbers for this alien's kind (speed, vision...) from config.ts. */
  kindOf(a: Alien): KindSpec {
    return KINDS[a.kind];
  }

  /** How far this alien can see, in px (0 = blind). The alarm makes everyone see 25% further. */
  visionRange(a: Alien): number {
    return this.kindOf(a).vision * TILE * (this.alarm ? CONFIG.alarm.visionMult : 1);
  }

  /**
   * An independent COPY of the whole world. The bots (tests/bot.ts) use this to "imagine the future":
   * copy the world, try a move in the copy, see if Leo gets hugged, then throw the copy away.
   * Every object that can change must be copied, otherwise the copy and the original would share it.
   */
  clone(): World {
    const w = Object.create(World.prototype) as World;
    const src = this as unknown as Record<string, unknown>;
    const dst = w as unknown as Record<string, unknown>;
    for (const k of Object.keys(src)) dst[k] = src[k];
    const p = this.player;
    const grid = new Grid(this.grid.w, this.grid.h, this.grid.tiles);
    grid.lasersOpen = this.grid.lasersOpen;
    dst.grid = grid;
    dst.player = { ...p, cd: { ...p.cd }, respawn: { ...p.respawn }, carried: p.carried.map(v => ({ ...v })) };
    dst.aliens = this.aliens.map(a => ({ ...a, heading: { ...a.heading }, lastSeen: { ...a.lastSeen }, goal: { ...a.goal } }));
    dst.keys = this.keys.map(k => ({ ...k, home: k.home && { ...k.home } }));
    dst.items = this.items.map(k => ({ ...k }));
    dst.checkpoints = this.checkpoints.map(c => ({ ...c }));
    dst.levers = this.levers.map(l => ({ ...l }));
    dst.terminals = this.terminals.map(t => ({ ...t }));
    dst.socks = this.socks.map(k => ({ ...k }));
    dst.donut = this.donut ? { ...this.donut } : null;
    dst.hug = this.hug ? { ...this.hug } : null;
    dst.events = [];
    dst.fields = new Map(this.fields); // cached fields are never mutated, only cleared
    return w;
  }

  /** Hand over all events since last time, and start a fresh list. (GameScene calls this every frame.) */
  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(e: GameEvent): void {
    this.events.push(e);
  }

  // #region step
  // ---------------------------------------------------------------------------
  // 📘 The main step: one 1/60 s "page of the flip-book"
  // ---------------------------------------------------------------------------
  /**
   * Move the whole world forward by dt seconds (always 1/60).
   * 💡 EXAMPLE: the honk cooldown is 8 s. Each step subtracts 1/60, so after 480 steps (8 × 60) it's 0 again.
   */
  step(input: Input, dt = DT): void {
    if (this.status !== 'playing') return;
    this.time += dt;
    const p = this.player;
    // Count down all of Leo's timers. Math.max(0, ...) stops them going below zero.
    if (p.invuln > 0) p.invuln -= dt;
    if (p.moonwalkT > 0) p.moonwalkT -= dt;
    p.cd.honk = Math.max(0, p.cd.honk - dt);
    p.cd.moonwalk = Math.max(0, p.cd.moonwalk - dt);
    p.cd.donut = Math.max(0, p.cd.donut - dt);

    if (this.hug) {
      // Being hugged: Leo can't move or use gadgets until the hug timer runs out.
      this.hug.t -= dt;
      if (this.hug.t <= 0) this.endHug();
    } else {
      if (input.honk) this.honk();
      if (input.moonwalk) this.moonwalk();
      if (input.donut) this.throwDonut();
      this.movePlayer(input, dt);
      this.updatePickups();
      this.updateDevices(dt);
    }
    this.updatePlates();
    this.updateDonut(dt);
    for (const a of this.aliens) this.updateAlien(a, dt); // every alien's brain gets a turn
    if (!this.hug) this.checkContacts();
  }
  // #endregion step

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------
  // #region movePlayer
  /**
   * Move Leo according to the input.
   *
   * 💡 EXAMPLE: holding right while walking: speed = 150 px/s, dt = 1/60 s
   *    → this step Leo moves 1 × 150 × (1/60) = 2.5 px to the right.
   *
   * Diagonals: pressing right AND down gives (1, 1), whose length is √2 ≈ 1.41, so Leo would move 41% faster
   * diagonally! Dividing by the length ("normalising") fixes that: (0.707, 0.707) has length 1.
   * 🧠 QUIZ Q15: Without normalising, how fast would Leo walk diagonally?
   */
  private movePlayer(input: Input, dt: number): void {
    const p = this.player, cfg = CONFIG.player;
    let ix = input.x, iy = input.y;
    const len = Math.hypot(ix, iy);                // Math.hypot(a, b) = √(a² + b²), the length of the arrow
    if (len > 1) { ix /= len; iy /= len; }
    p.moving = len > 0.05;                          // ignore tiny thumb-stick wobbles
    const moon = p.moonwalkT > 0;
    p.running = p.moving && input.run && !moon;     // can't run while moonwalking
    const speed = moon ? cfg.moonwalkSpeed : p.running ? cfg.runSpeed : cfg.walkSpeed;

    if (p.moving) {
      // Remember which way Leo faces (for the donut throw): whichever of x/y is pushed more.
      if (Math.abs(ix) > Math.abs(iy)) p.facing = ix > 0 ? 1 : 3;
      else p.facing = iy > 0 ? 2 : 0;
      // Move left/right and up/down SEPARATELY. If only one is blocked, Leo slides along the wall.
      this.slide(ix * speed * dt, 'x', speed * dt);
      this.slide(iy * speed * dt, 'y', speed * dt);
    }

    // Conveyor belts push you (moonwalk shoes grip the belt)
    const c = tileOf(p.x), r = tileOf(p.y), tile = this.grid.get(c, r), ti = r * this.grid.w + c;
    if (isConveyor(tile) && !moon) {
      const [dx, dy] = CONVEYOR_DIR[tile];
      this.slide(dx * cfg.conveyorSpeed * dt, 'x', 0);
      this.slide(dy * cfg.conveyorSpeed * dt, 'y', 0);
    }

    // Noise: running footsteps (silent on carpet) and squeaky tiles (always)
    if (p.running && tile !== T.Carpet) {
      p.footT -= dt;
      if (p.footT <= 0) {
        p.footT = cfg.footstepEvery;
        this.noise(p.x, p.y, cfg.runNoiseRadius);
      }
    } else {
      p.footT = 0;
    }
    // Only react to a tile the moment we step ONTO it (not every frame we stand on it).
    if (ti !== this.lastTile) {
      if (tile === T.Squeaky) {
        this.emit({ type: 'squeak', x: p.x, y: p.y });
        this.noise(p.x, p.y, cfg.squeakNoiseRadius);
      }
      if (tile === T.Plate) this.emit({ type: 'tooLight', x: p.x, y: p.y });
    }
    this.lastTile = ti;
  }
  // #endregion movePlayer

  // #region slide
  /**
   * Try to move Leo by `delta` px along one axis. If a wall is in the way, he doesn't move...
   * ...UNLESS he's just slightly off-centre from an opening. Then we nudge him sideways into it. This is
   * "corner assist": without it, slipping into a 1-tile corridor would need pixel-perfect steering.
   *
   * 💡 EXAMPLE: Leo walks right along a wall, with a gap one tile below. He's 10 px too high to fit.
   *    Moving right is blocked, but the lane below is open and only 10 px away (less than 45% of a tile),
   *    so this step we nudge him 2.5 px down. A few frames later he slips into the gap.
   */
  private slide(delta: number, axis: 'x' | 'y', maxNudge: number): void {
    if (delta === 0) return;
    const p = this.player, rad = CONFIG.player.radius, g = this.grid;
    const nx = axis === 'x' ? p.x + delta : p.x;
    const ny = axis === 'y' ? p.y + delta : p.y;
    if (g.canStand(nx, ny, rad)) { p.x = nx; p.y = ny; return; } // the easy case: nothing in the way
    if (maxNudge <= 0) return;

    // Blocked: find the lane (row for x-moves, column for y-moves) whose next tile is open.
    const along = axis === 'x' ? p.x : p.y;
    const across = axis === 'x' ? p.y : p.x;
    const ahead = tileOf(along + Math.sign(delta) * (rad + 1));
    const assist = CONFIG.player.cornerAssist * TILE;
    let best: number | null = null;
    for (const lane of [tileOf(across - rad), tileOf(across + rad)]) {
      const laneCenter = center(lane);
      const open = axis === 'x' ? !g.solid(ahead, lane) : !g.solid(lane, ahead);
      if (open && Math.abs(laneCenter - across) <= assist && (best === null || Math.abs(laneCenter - across) < Math.abs(best - across))) {
        best = laneCenter;
      }
    }
    if (best === null || Math.abs(best - across) < 0.01) return;
    const nudge = Math.sign(best - across) * Math.min(Math.abs(best - across), maxNudge);
    const tx = axis === 'x' ? p.x : p.x + nudge;
    const ty = axis === 'x' ? p.y + nudge : p.y;
    if (g.canStand(tx, ty, rad)) { p.x = tx; p.y = ty; }
  }
  // #endregion slide

  /** Is Leo within d px of this point? */
  private near(v: Vec, d: number): boolean {
    return Math.hypot(v.x - this.player.x, v.y - this.player.y) < d;
  }

  /** Keys, checkpoints, socks and ship parts: grab anything Leo is standing on. Also checks for the win. */
  private updatePickups(): void {
    const p = this.player;
    for (const k of this.keys) {
      if (!k.taken && this.near(k, 24)) {
        k.taken = true;
        p.keys++;
        p.carried.push(k.home ?? { x: k.x, y: k.y });
        this.pickups++;
        this.emit({ type: 'key', x: k.x, y: k.y });
      }
    }
    if (p.keys > 0) this.tryOpenGate();
    for (const cp of this.checkpoints) {
      if (this.near(cp, 24) && (p.respawn.x !== cp.x || p.respawn.y !== cp.y)) {
        p.respawn = { ...cp };
        this.emit({ type: 'checkpoint', x: cp.x, y: cp.y });
      }
    }
    for (const sk of this.socks) {
      if (!sk.taken && this.near(sk, 24)) {
        sk.taken = true;
        this.emit({ type: 'sock', x: sk.x, y: sk.y });
      }
    }
    for (const it of this.items) {
      if (!it.taken && this.near(it, 24)) {
        it.taken = true;
        this.pickups++;
        this.emit({ type: 'item', x: it.x, y: it.y });
      }
    }
    const got = this.items.filter(i => i.taken).length;
    if (!this.alarm && this.level.alarmAfter > 0 && this.pickups >= this.level.alarmAfter && got < this.items.length) this.raiseAlarm();
    if (this.items.length > 0 && got === this.items.length) {
      this.status = 'won';
      this.emit({ type: 'win', x: p.x, y: p.y });
    }
  }

  /** A carried key opens a gate the player is pushing against. Gates never close again. */
  private tryOpenGate(): void {
    const p = this.player, reach = CONFIG.player.radius + 6, g = this.grid;
    // Check just past Leo's body in all four directions.
    for (const [dx, dy] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]]) {
      const c = tileOf(p.x + dx), r = tileOf(p.y + dy);
      if (g.get(c, r) !== T.Gate) continue;
      this.floodReplace(c, r, T.Gate, T.Floor);
      p.keys--;
      p.carried.shift();
      this.emit({ type: 'gate', x: center(c), y: center(r) });
      return;
    }
  }

  /**
   * "Flood fill": change a tile and every touching tile of the same kind, like the paint bucket in a paint
   * program. A 3-tile-wide gate opens all at once with one key.
   */
  private floodReplace(c: number, r: number, from: TileCode, to: TileCode): void {
    const g = this.grid, stack = [[c, r]];
    while (stack.length) {
      const [sc, sr] = stack.pop()!;
      if (g.get(sc, sr) !== from) continue;
      g.set(sc, sr, to);
      stack.push([sc + 1, sr], [sc - 1, sr], [sc, sr + 1], [sc, sr - 1]);
    }
    this.fields.clear(); // the map changed, so old pathfinding results are wrong now
  }

  /** Levers flip every conveyor; terminals hack while you stand on them. */
  private updateDevices(dt: number): void {
    for (const lv of this.levers) {
      if (this.near(lv, 22)) {
        // "armed" stops the lever flipping back and forth every frame while you stand on it.
        if (lv.armed) {
          lv.armed = false;
          lv.flipped = !lv.flipped;
          const g = this.grid;
          for (let i = 0; i < g.tiles.length; i++) g.tiles[i] = FLIP[g.tiles[i]] ?? g.tiles[i];
          this.emit({ type: 'lever', x: lv.x, y: lv.y });
        }
      } else if (!this.near(lv, 34)) lv.armed = true; // walked away: ready to be pulled again
    }
    for (const t of this.terminals) {
      if (t.done) continue;
      if (this.near(t, 18)) {
        t.progress += dt;
        if (t.progress >= CONFIG.player.hackTime) {
          t.done = true;
          this.emit({ type: 'hack', x: t.x, y: t.y });
          if (this.terminals.every(q => q.done)) {
            const g = this.grid;
            for (let i = 0; i < g.tiles.length; i++) if (g.tiles[i] === T.Shield) g.tiles[i] = T.Floor;
            this.fields.clear();
            this.emit({ type: 'shieldDown', x: t.x, y: t.y });
          }
        }
      } else t.progress = Math.max(0, t.progress - dt * 2); // step off and the progress drains away
    }
  }

  /**
   * Lasers are open while a Heavy stands on any plate.
   * Safety rule: a laser never closes while someone is standing in it (that would trap them inside a wall!).
   */
  private updatePlates(): void {
    const g = this.grid;
    let held = this.aliens.some(a => a.kind === 'heavy' && g.get(tileOf(a.x), tileOf(a.y)) === T.Plate);
    if (!held && g.lasersOpen) {
      const p = this.player, pr = CONFIG.player.radius;
      const inside = (x: number, y: number, r: number) => {
        for (const cx of [x - r, x + r]) for (const cy of [y - r, y + r]) if (g.get(tileOf(cx), tileOf(cy)) === T.Laser) return true;
        return false;
      };
      held = inside(p.x, p.y, pr) || this.aliens.some(a => inside(a.x, a.y, this.kindOf(a).radius));
    }
    if (held !== g.lasersOpen) {
      g.lasersOpen = held;
      this.fields.clear();
      const plate = this.aliens.find(a => a.kind === 'heavy') ?? this.player;
      this.emit({ type: held ? 'laserOpen' : 'laserClose', x: plate.x, y: plate.y });
    }
  }

  /** 🚨 Everyone who can hear comes to look where Leo is right now. */
  private raiseAlarm(): void {
    const p = this.player;
    this.alarm = true;
    this.emit({ type: 'alarm', x: p.x, y: p.y });
    for (const a of this.aliens) {
      if (!this.kindOf(a).hears) continue;
      if (a.state === 'sleep') { this.wake(a, p); continue; }
      if (AWAKE_CALM.includes(a.state) || a.state === 'suspicious') this.investigate(a, p);
    }
  }

  // ---------------------------------------------------------------------------
  // Gadgets
  // ---------------------------------------------------------------------------
  /** Cooldowns are longer on Hard and shorter on Easy. */
  private cooldown(base: number): number {
    return base * DIFFICULTY[this.difficulty].cooldown;
  }

  // #region honk
  /**
   * 🎺 HONK. A trade-off on purpose:
   *   GOOD: aliens within 2 tiles (that can see you) are stunned for 1.5 s and can't hug you.
   *   BAD:  it's loud — every alien within 7 tiles comes to investigate.
   * So it's an escape button, not a free pass. (The old version froze everyone for 3 s: way too strong!)
   */
  private honk(): void {
    const p = this.player, cfg = CONFIG.honk;
    if (p.cd.honk > 0) return; // still recharging
    p.cd.honk = this.cooldown(cfg.cooldown);
    this.emit({ type: 'honk', x: p.x, y: p.y });
    for (const a of this.aliens) {
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d <= cfg.stunRadius && this.grid.lineOfSight(a, p) && !this.kindOf(a).honkProof) {
        this.setState(a, 'stunned');
        a.stateT = cfg.stunTime;
        a.speed = 0;
        a.skidding = false;
        a.sus = 0;
        this.emit({ type: 'stun', alien: a.id, x: a.x, y: a.y });
      }
    }
    this.noise(p.x, p.y, cfg.hearRadius);
  }
  // #endregion honk

  /** 👟 MOONWALK: for 4 s, aliens who look at you think you're a local. Anyone chasing you gets confused. */
  private moonwalk(): void {
    const p = this.player, cfg = CONFIG.moonwalk;
    if (p.cd.moonwalk > 0) return;
    p.cd.moonwalk = this.cooldown(cfg.cooldown);
    p.moonwalkT = cfg.duration;
    this.emit({ type: 'moonwalk', x: p.x, y: p.y });
    for (const a of this.aliens) {
      if (this.kindOf(a).fooled && (a.state === 'chase' || a.state === 'suspicious')) {
        a.sus = 0;
        a.goal = { x: a.x, y: a.y };
        this.setState(a, 'search');
        a.stateT = CONFIG.alien.searchLookTime;
        this.emit({ type: 'fooled', alien: a.id, x: a.x, y: a.y });
      }
    }
  }

  // #region throwDonut
  /**
   * 🍩 DONUT: flies up to 3 tiles in the direction Leo faces, stopping early at a wall.
   * 💡 EXAMPLE: Leo faces right at tile (2,5) and (4,5) is a wall: the donut lands on (3,5) after 1 tile.
   */
  private throwDonut(): void {
    const p = this.player, cfg = CONFIG.donut;
    if (p.cd.donut > 0) return;
    const f = FACING_VEC[p.facing];
    let c = tileOf(p.x), r = tileOf(p.y), flew = 0;
    for (let i = 0; i < cfg.range; i++) {
      if (this.grid.solid(c + f.x, r + f.y)) break;
      c += f.x; r += f.y; flew++;
    }
    if (flew === 0) {
      this.emit({ type: 'noDonutRoom', x: p.x, y: p.y });
      return;
    }
    p.cd.donut = this.cooldown(cfg.cooldown);
    for (const a of this.aliens) if (a.state === 'toDonut') this.backToWork(a);
    this.donut = { x: center(c), y: center(r), eater: -1, age: 0 };
    this.emit({ type: 'donut', x: this.donut.x, y: this.donut.y });
  }
  // #endregion throwDonut

  /** Can this alien be tempted by a donut right now? */
  private hungry(a: Alien): boolean {
    return this.kindOf(a).eatTime > 0 && !['stunned', 'eating', 'sleep', 'waking', 'toDonut', 'hugging'].includes(a.state);
  }

  /**
   * Each step, if nobody is heading for the donut yet, pick the nearest hungry alien BY WALKING DISTANCE
   * (using pathfinding, so an alien behind a wall counts as far away). Recess kids all race for it together.
   */
  private updateDonut(dt: number): void {
    const dn = this.donut;
    if (!dn) return;
    dn.age += dt;
    if (dn.eater >= 0) return;
    const field = this.fieldTo(tileOf(dn.x), tileOf(dn.y));
    const smell = CONFIG.donut.smellRadius + 0.5;
    let best = -1, bestD = smell;
    for (const a of this.aliens) {
      if (!this.hungry(a)) continue;
      const d = this.grid.dist(field, tileOf(a.x), tileOf(a.y));
      if (d < bestD) { bestD = d; best = a.id; }
    }
    if (best < 0) return;
    dn.eater = best;
    for (const a of this.aliens) {
      if (a.id !== best && !(a.kind === 'kid' && this.hungry(a) && this.grid.dist(field, tileOf(a.x), tileOf(a.y)) < smell)) continue;
      a.sus = 0;
      this.setState(a, 'toDonut');
    }
  }

  // #region noise
  // ---------------------------------------------------------------------------
  // Noise
  // ---------------------------------------------------------------------------
  /**
   * Make a noise. Every alien that can hear and is within `radius` px (straight-line distance, so THROUGH
   * walls!) walks over to investigate. Sleeping huggers wake up.
   * 💡 EXAMPLE: running makes a 144 px noise every 0.28 s. An alien 2 tiles (96 px) away in the next corridor
   *    hears it; one 4 tiles (192 px) away does not.
   */
  noise(x: number, y: number, radius: number): void {
    this.emit({ type: 'noise', x, y, radius });
    for (const a of this.aliens) {
      if (!this.kindOf(a).hears || Math.hypot(a.x - x, a.y - y) > radius) continue;
      if (a.state === 'sleep') this.wake(a, { x, y });
      else if (AWAKE_CALM.includes(a.state) || (a.state === 'suspicious' && a.resume !== 'chase')) this.investigate(a, { x, y });
    }
  }
  // #endregion noise

  private investigate(a: Alien, at: Vec): void {
    if (a.state !== 'investigate') this.emit({ type: 'investigate', alien: a.id, x: a.x, y: a.y });
    a.goal = { x: at.x, y: at.y };
    a.stateT = CONFIG.alien.investigateLookTime;
    this.setState(a, 'investigate');
  }

  // ---------------------------------------------------------------------------
  // Aliens
  // ---------------------------------------------------------------------------
  private setState(a: Alien, s: AlienState): void {
    a.state = s;
    a.pauseT = 0;
  }

  /** A speed adjusted for difficulty (and the alarm, unless alarmBoost is false: chases don't get faster). */
  private alienSpeed(base: number, alarmBoost = true): number {
    return base * DIFFICULTY[this.difficulty].alienSpeed * (this.alarm && alarmBoost ? CONFIG.alarm.speedMult : 1);
  }

  private wake(a: Alien, at: Vec): void {
    this.setState(a, 'waking');
    a.stateT = CONFIG.alien.huggerWakeTime;
    a.lastSeen = { x: at.x, y: at.y };
    this.emit({ type: 'wake', alien: a.id, x: a.x, y: a.y });
  }

  private startChase(a: Alien): void {
    this.setState(a, 'chase');
    a.sus = 1;
    a.lostT = 0;
    a.stateT = 0;
    a.lastSeen = { x: this.player.x, y: this.player.y };
    this.timesChased++;
    this.emit({ type: 'spotted', alien: a.id, x: a.x, y: a.y });
  }

  /** "Nothing to see here": calm down and walk back to the patrol route. */
  private backToWork(a: Alien): void {
    a.sus = 0;
    a.stateT = 0;
    this.setState(a, 'return');
  }

  // #region canSee
  /**
   * 👀 CAN THIS ALIEN SEE LEO? Three tests, all must pass:
   *   1. CLOSE ENOUGH:   distance ≤ vision range.
   *   2. INSIDE THE CONE: the angle from the alien to Leo is within `half` degrees of where its eyes point.
   *   3. NOTHING IN THE WAY: a clear line of sight (no walls or hedges between them).
   * (And the moonwalk disguise fools anyone who can be fooled.)
   *
   * 💡 EXAMPLE: a Stroller at (100,100) looks LEFT (look = π, i.e. 180°). Leo stands at (40,110).
   *    1. distance = √(60² + 10²) ≈ 61 px, well inside 5 tiles (240 px).      ✓
   *    2. angle to Leo = atan2(10, -60) ≈ 170°. Difference from 180° = 10°, less than 40°. ✓
   *    3. if no wall is between them: SEEN!  The "?" meter starts filling.
   *    If Leo stood at (160,100) instead (to the RIGHT, where the alien is walking), the angle would be 0°,
   *    180° away from where it looks: NOT seen. That's the backwards-eyes trick!
   * 🧠 QUIZ Q16: Why is the cone test skipped when d ≤ k.radius (Leo is touching the alien)?
   */
  private canSee(a: Alien): boolean {
    const p = this.player, k = this.kindOf(a), range = this.visionRange(a);
    if (range <= 0 || (p.moonwalkT > 0 && k.fooled)) return false;
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
    if (d > range) return false;
    if (d > k.radius && Math.abs(angleDiff(Math.atan2(dy, dx), a.look)) > (k.half * Math.PI) / 180) return false;
    return this.grid.lineOfSight(a, p);
  }
  // #endregion canSee

  /** 🧠 THE ALIEN BRAIN. Runs once per alien per step. First the eyes, then whatever its current state does. */
  private updateAlien(a: Alien, dt: number): void {
    const cfg = CONFIG.alien, p = this.player, k = this.kindOf(a);

    // Drones never stop: their meter fills while they fly, then they BEEP and call everyone over.
    if (a.kind === 'drone') {
      if (a.alarmT > 0) a.alarmT -= dt;
      if (a.state === 'patrol' && a.alarmT <= 0 && this.canSee(a)) {
        a.sus += dt / (cfg.suspicionFillTime * 0.7 * DIFFICULTY[this.difficulty].suspicionFill);
        if (a.sus >= 1) {
          a.sus = 0;
          a.alarmT = cfg.droneCooldown;
          this.timesChased++;
          this.emit({ type: 'beep', alien: a.id, x: a.x, y: a.y });
          this.callOver(p, cfg.droneAlarmRadius);
        }
      } else if (a.sus > 0) a.sus = Math.max(0, a.sus - cfg.suspicionDrain * dt);
      if (a.state === 'patrol') this.patrol(a, dt);
      else if (a.state === 'stunned') { a.stateT -= dt; if (a.stateT <= 0) this.setState(a, 'patrol'); }
      return;
    }

    // #region suspicion
    // THE "?" METER. While Leo is in view, the meter fills — faster when he's close:
    //   fill per second = (1 / fillTime) × (1.5 − distance / range)
    // 💡 EXAMPLE (Normal, fillTime 0.7 s, range 240 px):
    //    Leo right next to it (d ≈ 0):   1.5 / 0.7 ≈ 2.1 per second → full in ~0.47 s
    //    Leo at the edge (d = 240):      0.5 / 0.7 ≈ 0.7 per second → full in 1.4 s
    // When Leo leaves the cone, the meter drains at 0.6 per second. Full meter = chase!
    if (AWAKE_CALM.includes(a.state) || a.state === 'suspicious') {
      if (this.canSee(a)) {
        const d = Math.hypot(p.x - a.x, p.y - a.y);
        const fill = cfg.suspicionFillTime * DIFFICULTY[this.difficulty].suspicionFill;
        a.sus += (dt / fill) * (1.5 - d / this.visionRange(a));
        if (a.state !== 'suspicious') {
          a.resume = a.state;
          this.setState(a, 'suspicious');
          this.emit({ type: 'suspicious', alien: a.id, x: a.x, y: a.y });
        }
        // Slowly turn the eyes towards Leo (at most stareTurnRate radians per second).
        const want = Math.atan2(p.y - a.y, p.x - a.x);
        const diff = angleDiff(want, a.look);
        a.look += Math.sign(diff) * Math.min(Math.abs(diff), cfg.stareTurnRate * dt);
        if (a.sus >= 1) {
          if (k.chase > 0) { this.startChase(a); return; }
          a.sus = 0;
        }
      } else if (a.sus > 0) {
        a.sus = Math.max(0, a.sus - cfg.suspicionDrain * dt);
      }
    }
    // #endregion suspicion
    // 🧠 QUIZ Q17: Leo stands at the very edge of a Stroller's view on Normal. Roughly how long until it chases him?

    switch (a.state) {
      case 'suspicious':
        a.speed = 0; // stop and stare
        if (a.sus <= 0) {
          this.setState(a, a.resume);
          this.emit({ type: 'calm', alien: a.id, x: a.x, y: a.y });
        }
        break;

      case 'patrol': this.patrol(a, dt); break;

      // #region chase
      case 'chase': {
        // While chasing, aliens track you in ANY direction (they turn their heads), up to 8 tiles.
        const sees = Math.hypot(p.x - a.x, p.y - a.y) <= cfg.chaseSightRange && this.grid.lineOfSight(a, p);
        if (sees) { a.lastSeen = { x: p.x, y: p.y }; a.lostT = 0; }
        else {
          a.lostT += dt;
          // Hunch: they heard you round the corner and keep following for a moment.
          if (a.lostT < cfg.chaseHunch && Math.hypot(p.x - a.lastSeen.x, p.y - a.lastSeen.y) < cfg.chaseHunchRadius) {
            a.lastSeen = { x: p.x, y: p.y };
          }
        }
        // Run to where we last saw Leo. `true` = "skiddy": accelerate, and skid at every corner.
        const arrived = this.moveToward(a, tileOf(a.lastSeen.x), tileOf(a.lastSeen.y), this.alienSpeed(k.chase, false), true, dt);
        a.stateT += dt;
        const tired = a.stateT > cfg.chaseMaxTime;
        // Give up if tired, or if we can't see Leo and either reached his last spot or waited too long.
        if (tired || (!sees && (arrived || a.lostT > cfg.chaseGiveUp))) {
          a.goal = { x: a.x, y: a.y };
          a.stateT = cfg.searchLookTime;
          a.sus = 0;
          a.skidding = false;
          a.untangle = 0;
          this.setState(a, 'search');
          this.emit({ type: tired ? 'tired' : 'lost', alien: a.id, x: a.x, y: a.y });
          break;
        }
        if (sees && !a.skidding && a.untangle <= 0) a.look = Math.atan2(p.y - a.y, p.x - a.x);
        else this.lookAlong(a, true);
        break;
      }
      // #endregion chase

      case 'search':
      case 'investigate': {
        const arrived = this.moveToward(a, tileOf(a.goal.x), tileOf(a.goal.y), this.alienSpeed(cfg.investigateSpeed), false, dt);
        this.lookAlong(a);
        if (arrived) {
          a.look += 2.5 * dt; // look around, puzzled (spin the eyes slowly)
          a.stateT -= dt;
          if (a.stateT <= 0) this.backToWork(a);
        }
        break;
      }

      case 'return': {
        const home = this.homeTarget(a);
        if (this.moveToward(a, tileOf(home.x), tileOf(home.y), this.alienSpeed(this.patrolSpeed(a)), false, dt)) {
          if (a.kind === 'hugger') {
            a.stateT += dt;
            if (a.stateT >= cfg.huggerSleepAfter) { this.setState(a, 'sleep'); a.stateT = 0; }
          } else {
            this.setState(a, 'patrol');
            if (a.kind === 'lookout') a.look = a.baseLook;
            else if (a.spec.facing !== undefined) a.look = a.spec.facing;
          }
        } else this.lookAlong(a);
        break;
      }

      case 'stunned':
        a.speed = 0;
        a.stateT -= dt;
        if (a.stateT <= 0) {
          if (!k.hears) { this.setState(a, 'patrol'); break; }
          a.goal = { x: a.x, y: a.y };
          a.stateT = cfg.searchLookTime;
          this.setState(a, 'search');
        }
        break;

      case 'toDonut': {
        const dn = this.donut;
        if (!dn) { this.backToWork(a); break; } // somebody else ate it
        if (this.moveToward(a, tileOf(dn.x), tileOf(dn.y), this.alienSpeed(cfg.investigateSpeed * 1.3), false, dt)) {
          this.donut = null;
          this.setState(a, 'eating');
          a.stateT = k.eatTime;
          this.emit({ type: 'eat', alien: a.id, x: a.x, y: a.y });
        } else this.lookAlong(a);
        break;
      }

      case 'eating':
        a.speed = 0;
        a.stateT -= dt;
        if (a.stateT <= 0) this.backToWork(a);
        break;

      case 'sleep':
        a.speed = 0;
        if (Math.hypot(p.x - a.x, p.y - a.y) < cfg.huggerSmellRadius && this.grid.lineOfSight(a, p)) this.wake(a, p);
        break;

      case 'waking':
        a.stateT -= dt;
        a.look = Math.atan2(a.lastSeen.y - a.y, a.lastSeen.x - a.x);
        if (a.stateT <= 0) {
          if (this.grid.lineOfSight(a, p) && Math.hypot(p.x - a.x, p.y - a.y) < cfg.chaseSightRange && p.moonwalkT <= 0) this.startChase(a);
          else { a.goal = { ...a.lastSeen }; a.stateT = cfg.searchLookTime; this.setState(a, 'search'); }
        }
        break;

      case 'hugging':
        a.speed = 0;
        break;
    }
  }

  /** A drone alarm: every alien that can hear within radius rushes to the spot. */
  private callOver(at: Vec, radius: number): void {
    for (const a of this.aliens) {
      if (!this.kindOf(a).hears || Math.hypot(a.x - at.x, a.y - at.y) > radius) continue;
      if (a.state === 'sleep') this.wake(a, at);
      else if (AWAKE_CALM.includes(a.state) || a.state === 'suspicious') this.investigate(a, at);
    }
  }

  private patrolSpeed(a: Alien): number {
    return a.spec.speed ?? this.kindOf(a).speed;
  }

  /** Where "home" is: the waypoint it was walking to, or its starting spot. */
  private homeTarget(a: Alien): Vec {
    const r = a.spec.route;
    return r.length > 1 ? r[a.routeIdx] : { x: a.spec.x, y: a.spec.y };
  }

  // #region lookAlong
  /**
   * Point the eyes along the walking direction: BACKWARDS for locals (the joke!), forwards for drones (or chasers).
   * 💡 EXAMPLE: walking right, heading = (1, 0). Backwards eyes: atan2(-0, -1) = π → looking LEFT.
   */
  private lookAlong(a: Alien, forwards = false): void {
    if (a.heading.x === 0 && a.heading.y === 0) return;
    const fwd = forwards || !this.kindOf(a).backwards;
    a.look = fwd ? Math.atan2(a.heading.y, a.heading.x) : Math.atan2(-a.heading.y, -a.heading.x);
  }
  // #endregion lookAlong

  // #region patrol
  /**
   * Walk the route: A → B → C, pause, then either loop back to A or turn around (ping-pong).
   * Lookouts don't walk: they swing their gaze 180° every few seconds.
   */
  private patrol(a: Alien, dt: number): void {
    const route = a.spec.route;
    if (a.kind === 'lookout' || route.length < 2) {
      a.speed = 0;
      if (a.kind === 'lookout') {
        a.lookoutT -= dt;
        if (a.lookoutT <= 0) {
          a.lookoutT = a.spec.turnEvery ?? CONFIG.alien.lookoutTurnEvery;
          a.baseLook += Math.PI; // + π radians = turn around (180°)
        }
        a.look = a.baseLook;
      }
      return;
    }
    if (a.pauseT > 0) { a.pauseT -= dt; a.speed = 0; return; }
    const wp = route[a.routeIdx];
    if (this.moveToward(a, tileOf(wp.x), tileOf(wp.y), this.alienSpeed(this.patrolSpeed(a)), false, dt)) {
      a.pauseT = a.spec.pause ?? CONFIG.alien.waypointPause;
      if (a.spec.loop) a.routeIdx = (a.routeIdx + 1) % route.length; // % wraps around: 3 % 3 = 0
      else {
        if (a.routeIdx + a.routeDir < 0 || a.routeIdx + a.routeDir >= route.length) a.routeDir = (-a.routeDir) as 1 | -1;
        a.routeIdx += a.routeDir;
      }
    } else {
      this.lookAlong(a);
    }
  }
  // #endregion patrol

  /** Pathfinding towards tile (c, r), remembered ("cached") so many aliens can share the work. */
  private fieldTo(c: number, r: number): Float64Array {
    const key = r * this.grid.w + c;
    let f = this.fields.get(key);
    if (!f) { f = this.grid.distField(c, r); this.fields.set(key, f); }
    return f;
  }

  // #region moveToward
  /**
   * Walk along tile centres toward tile (gc, gr), following the pathfinding numbers. Returns true on arrival.
   *
   * Aliens walk down the MIDDLE of corridors: before turning a corner they first line up with the centre of
   * the tile. That's why they look tidy and never cut corners through walls.
   *
   * `skiddy` (used for chases) adds the backwards-legs physics:
   *   • speed builds up gradually (chaseAccel), instead of jumping straight to top speed;
   *   • when the path TURNS while they're going fast, they can't just turn: they SKID forward, slowing down
   *     (skidDecel), bump into whatever's ahead, then spend untangleTime sorting out their legs.
   * 💡 EXAMPLE: at 225 px/s, a skid takes about 0.25 s to stop, plus 0.45 s untangling, plus ~0.4 s to get back
   *    up to speed. That's over a second lost at EVERY corner — which is why twisty paths save you!
   * 🧠 QUIZ Q18: In a long straight hallway, who is faster: a walking Leo (150) or a chasing Stroller (225)?
   *              And in a zig-zag with a corner every 2 tiles?
   */
  private moveToward(a: Alien, gc: number, gr: number, vmax: number, skiddy: boolean, dt: number): boolean {
    const cfg = CONFIG.alien, rad = this.kindOf(a).radius;
    if (a.untangle > 0) { a.untangle -= dt; a.speed = 0; return false; }
    if (a.skidding) {
      a.speed = Math.max(0, a.speed - cfg.skidDecel * dt);
      const nx = a.x + a.heading.x * a.speed * dt, ny = a.y + a.heading.y * a.speed * dt;
      if (this.grid.canStand(nx, ny, Math.min(rad, 20))) { a.x = nx; a.y = ny; }
      else { a.speed = 0; this.emit({ type: 'bump', alien: a.id, x: a.x, y: a.y }); }
      if (a.speed <= 0) { a.skidding = false; a.untangle = cfg.untangleTime; a.heading = { ...ZERO }; }
      return false;
    }

    a.speed = skiddy ? Math.min(vmax, a.speed + cfg.chaseAccel * dt) : vmax;
    // `budget` = how many px we may move this step. We may reach a tile centre part-way through and need to
    // turn, so we spend the budget in up to 3 small hops.
    let budget = a.speed * dt;
    for (let iter = 0; iter < 3 && budget > 1e-6; iter++) {
      const cc = tileOf(a.x), cr = tileOf(a.y), cx = center(cc), cy = center(cr);
      let tx = cx, ty = cy;
      if (cc !== gc || cr !== gr) {
        const nxt = this.grid.stepDown(this.fieldTo(gc, gr), cc, cr);
        if (!nxt) { a.speed = 0; return false; }
        tx = center(nxt.c); ty = center(nxt.r);
        // Line up with the corridor centre first, then go.
        if (nxt.c !== cc && Math.abs(a.y - cy) > 0.5) { tx = a.x; ty = cy; }
        else if (nxt.r !== cr && Math.abs(a.x - cx) > 0.5) { tx = cx; ty = a.y; }
      }
      const dx = tx - a.x, dy = ty - a.y, len = Math.hypot(dx, dy);
      if (len < 1e-6) break;
      const dir: Vec = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      const turning = (a.heading.x !== 0 || a.heading.y !== 0) && (dir.x !== a.heading.x || dir.y !== a.heading.y);
      if (skiddy && turning && a.speed > cfg.skidMinSpeed) {
        a.skidding = true;
        this.emit({ type: 'skid', alien: a.id, x: a.x, y: a.y });
        return false;
      }
      a.heading = dir;
      const stepLen = Math.min(budget, len);
      a.x += (dx / len) * stepLen;
      a.y += (dy / len) * stepLen;
      budget -= stepLen;
    }
    return tileOf(a.x) === gc && tileOf(a.y) === gr && Math.hypot(a.x - center(gc), a.y - center(gr)) < 0.5;
  }
  // #endregion moveToward

  // #region checkContacts
  // ---------------------------------------------------------------------------
  // Hugs: getting caught
  // ---------------------------------------------------------------------------
  /**
   * Did an alien touch Leo? Two circles touch when the distance between their centres is less than the sum of
   * their radii. 💡 EXAMPLE: Leo (14) and a Stroller (16) touch when they're closer than 14 + 16 − 2 = 28 px.
   */
  private checkContacts(): void {
    const p = this.player;
    for (const a of this.aliens) {
      const k = this.kindOf(a);
      if (Math.hypot(a.x - p.x, a.y - p.y) >= CONFIG.player.radius + k.radius - 2) continue;
      if (a.state === 'sleep') { this.wake(a, p); continue; }
      if (k.harmless || ['stunned', 'eating', 'waking'].includes(a.state) || p.invuln > 0) continue;
      this.hug = { alien: a.id, t: CONFIG.player.hugTime };
      this.setState(a, 'hugging');
      a.speed = 0;
      a.skidding = false;
      a.untangle = 0;
      this.emit({ type: 'hug', alien: a.id, x: a.x, y: a.y });
      return;
    }
  }
  // #endregion checkContacts

  /** End of a hug: lose a heart, the alien puts your key back where it was ("Ooh, shiny!"), back to the checkpoint. */
  private endHug(): void {
    const p = this.player, a = this.aliens[this.hug!.alien];
    this.hug = null;
    this.emit({ type: 'bonk', x: p.x, y: p.y });
    p.hearts--;
    if (p.keys > 0) {
      for (const home of p.carried) this.keys.push({ ...home, taken: false, home: { ...home } });
      p.keys = 0;
      p.carried = [];
      this.emit({ type: 'stolen', alien: a.id, x: a.x, y: a.y });
    }
    p.x = p.respawn.x;
    p.y = p.respawn.y;
    p.invuln = CONFIG.player.invulnAfterHug;
    for (const t of this.terminals) if (!t.done) t.progress = 0;
    for (const o of this.aliens) {
      if (o === a || ['chase', 'suspicious', 'search', 'hugging'].includes(o.state)) this.backToWork(o);
    }
    if (p.hearts <= 0) {
      this.status = 'lost';
      this.emit({ type: 'lose', x: p.x, y: p.y });
    }
  }
}

/** ⭐ finish · ⭐ under par time · ⭐ never chased.   🧠 QUIZ Q19: What's the most stars you can get if you were chased once? */
export function starsFor(w: World): number {
  if (w.status !== 'won') return 0;
  return 1 + (w.time <= w.level.parTime ? 1 : 0) + (w.timesChased === 0 ? 1 : 0);
}

// The whole game simulation. Pure: no DOM, no time source, no randomness.
// Call step(input) at a fixed 60 Hz; read state and drain events for rendering/sound.
import { CONFIG, DIFFICULTY, DT, KINDS, TILE, type AlienKind, type Difficulty, type KindSpec } from './config';
import { Grid, center, tileOf } from './grid';
import { CONVEYOR_DIR, T, isConveyor, type AlienSpec, type LevelData, type TileCode, type Vec } from './level';

export interface Input {
  x: number;          // -1..1 (analog stick or keys)
  y: number;
  run: boolean;
  honk: boolean;      // gadget buttons are edge-triggered: true for the step they were pressed
  moonwalk: boolean;
  donut: boolean;
}
export const NO_INPUT: Input = { x: 0, y: 0, run: false, honk: false, moonwalk: false, donut: false };

export type AlienState =
  | 'patrol' | 'suspicious' | 'chase' | 'search' | 'investigate' | 'return'
  | 'stunned' | 'toDonut' | 'eating' | 'sleep' | 'waking' | 'hugging';

export interface Alien {
  id: number;
  kind: AlienKind;
  spec: AlienSpec;
  x: number;
  y: number;
  heading: Vec;        // cardinal unit vector, or zero when standing
  speed: number;
  look: number;        // radians: where the eyes point
  state: AlienState;
  resume: AlienState;  // state to go back to after being suspicious
  stateT: number;
  sus: number;         // suspicion 0..1
  routeIdx: number;
  routeDir: 1 | -1;
  pauseT: number;
  skidding: boolean;
  untangle: number;
  lastSeen: Vec;
  lostT: number;
  goal: Vec;           // investigate / search target (px)
  lookoutT: number;
  baseLook: number;    // lookouts: the direction they swing back to
  alarmT: number;      // drones: cooldown between alarms
}

export interface Player {
  x: number;
  y: number;
  facing: 0 | 1 | 2 | 3; // up, right, down, left
  moving: boolean;
  running: boolean;
  hearts: number;
  maxHearts: number;
  invuln: number;
  keys: number;
  carried: Vec[];      // where each carried key came from
  moonwalkT: number;
  cd: { honk: number; moonwalk: number; donut: number };
  footT: number;
  respawn: Vec;
}

export interface Pickup { x: number; y: number; taken: boolean; home?: Vec }
export interface Lever { x: number; y: number; armed: boolean; flipped: boolean }
export interface Terminal { x: number; y: number; progress: number; done: boolean }
export interface Donut { x: number; y: number; eater: number; age: number }
export interface Hug { alien: number; t: number }

type AlienEventType = 'spotted' | 'suspicious' | 'lost' | 'skid' | 'bump' | 'stun' | 'investigate' | 'fooled'
  | 'eat' | 'wake' | 'calm' | 'hug' | 'stolen' | 'beep' | 'tired';
type PlaceEventType = 'sock' | 'bonk' | 'honk' | 'moonwalk' | 'donut' | 'noDonutRoom' | 'key' | 'gate' | 'item' | 'checkpoint'
  | 'win' | 'lose' | 'squeak' | 'lever' | 'hack' | 'shieldDown' | 'laserOpen' | 'laserClose' | 'tooLight' | 'alarm';

export type GameEvent =
  | { type: AlienEventType; alien: number; x: number; y: number }
  | { type: PlaceEventType; x: number; y: number }
  | { type: 'noise'; x: number; y: number; radius: number };

export type Status = 'playing' | 'won' | 'lost';

const FACING_VEC: Vec[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const ZERO: Vec = { x: 0, y: 0 };
const AWAKE_CALM: AlienState[] = ['patrol', 'return', 'search', 'investigate'];
const FLIP: Partial<Record<TileCode, TileCode>> = {
  [T.ConvUp]: T.ConvDown, [T.ConvDown]: T.ConvUp, [T.ConvLeft]: T.ConvRight, [T.ConvRight]: T.ConvLeft,
};

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

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
  donut: Donut | null = null;
  hug: Hug | null = null;
  alarm = false;
  status: Status = 'playing';
  time = 0;
  timesChased = 0;
  pickups = 0;
  private events: GameEvent[] = [];
  private fields = new Map<number, Float64Array>();
  private lastTile = -1;

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
    this.keys = level.keys.map(k => ({ ...k, taken: false, home: { ...k } }));
    this.items = level.items.map(k => ({ ...k, taken: false }));
    this.checkpoints = level.checkpoints.map(c => ({ ...c }));
    this.levers = level.levers.map(l => ({ ...l, armed: true, flipped: false }));
    this.terminals = level.terminals.map(t => ({ ...t, progress: 0, done: false }));
    this.socks = level.socks.map(k => ({ ...k, taken: false }));
    this.aliens = level.aliens.map((spec, id) => this.makeAlien(spec, id));
  }

  private makeAlien(spec: AlienSpec, id: number): Alien {
    const k = KINDS[spec.kind];
    let look = spec.facing ?? 0;
    if (spec.facing === undefined && spec.route.length > 1) {
      const dx = spec.route[1].x - spec.x, dy = spec.route[1].y - spec.y;
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

  kindOf(a: Alien): KindSpec {
    return KINDS[a.kind];
  }

  /** Vision range in px (0 = blind). */
  visionRange(a: Alien): number {
    return this.kindOf(a).vision * TILE * (this.alarm ? CONFIG.alarm.visionMult : 1);
  }

  /** Independent copy of the current state (used by bots to look ahead). */
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

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(e: GameEvent): void {
    this.events.push(e);
  }

  // ---------------------------------------------------------------------------
  // Main step
  // ---------------------------------------------------------------------------
  step(input: Input, dt = DT): void {
    if (this.status !== 'playing') return;
    this.time += dt;
    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.moonwalkT > 0) p.moonwalkT -= dt;
    p.cd.honk = Math.max(0, p.cd.honk - dt);
    p.cd.moonwalk = Math.max(0, p.cd.moonwalk - dt);
    p.cd.donut = Math.max(0, p.cd.donut - dt);

    if (this.hug) {
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
    for (const a of this.aliens) this.updateAlien(a, dt);
    if (!this.hug) this.checkContacts();
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------
  private movePlayer(input: Input, dt: number): void {
    const p = this.player, cfg = CONFIG.player;
    let ix = input.x, iy = input.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    p.moving = len > 0.05;
    const moon = p.moonwalkT > 0;
    p.running = p.moving && input.run && !moon;
    const speed = moon ? cfg.moonwalkSpeed : p.running ? cfg.runSpeed : cfg.walkSpeed;

    if (p.moving) {
      if (Math.abs(ix) > Math.abs(iy)) p.facing = ix > 0 ? 1 : 3;
      else p.facing = iy > 0 ? 2 : 0;
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
    if (ti !== this.lastTile) {
      if (tile === T.Squeaky) {
        this.emit({ type: 'squeak', x: p.x, y: p.y });
        this.noise(p.x, p.y, cfg.squeakNoiseRadius);
      }
      if (tile === T.Plate) this.emit({ type: 'tooLight', x: p.x, y: p.y });
    }
    this.lastTile = ti;
  }

  /** Move along one axis; if blocked, nudge sideways into a nearby opening (corner assist). */
  private slide(delta: number, axis: 'x' | 'y', maxNudge: number): void {
    if (delta === 0) return;
    const p = this.player, rad = CONFIG.player.radius, g = this.grid;
    const nx = axis === 'x' ? p.x + delta : p.x;
    const ny = axis === 'y' ? p.y + delta : p.y;
    if (g.canStand(nx, ny, rad)) { p.x = nx; p.y = ny; return; }
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

  private near(v: Vec, d: number): boolean {
    return Math.hypot(v.x - this.player.x, v.y - this.player.y) < d;
  }

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

  private floodReplace(c: number, r: number, from: TileCode, to: TileCode): void {
    const g = this.grid, stack = [[c, r]];
    while (stack.length) {
      const [sc, sr] = stack.pop()!;
      if (g.get(sc, sr) !== from) continue;
      g.set(sc, sr, to);
      stack.push([sc + 1, sr], [sc - 1, sr], [sc, sr + 1], [sc, sr - 1]);
    }
    this.fields.clear();
  }

  /** Levers flip every conveyor; terminals hack while you stand on them. */
  private updateDevices(dt: number): void {
    for (const lv of this.levers) {
      if (this.near(lv, 22)) {
        if (lv.armed) {
          lv.armed = false;
          lv.flipped = !lv.flipped;
          const g = this.grid;
          for (let i = 0; i < g.tiles.length; i++) g.tiles[i] = FLIP[g.tiles[i]] ?? g.tiles[i];
          this.emit({ type: 'lever', x: lv.x, y: lv.y });
        }
      } else if (!this.near(lv, 34)) lv.armed = true;
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
      } else t.progress = Math.max(0, t.progress - dt * 2);
    }
  }

  /** Lasers are open while a Heavy stands on any plate (and never close on anyone). */
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
  private cooldown(base: number): number {
    return base * DIFFICULTY[this.difficulty].cooldown;
  }

  private honk(): void {
    const p = this.player, cfg = CONFIG.honk;
    if (p.cd.honk > 0) return;
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

  private hungry(a: Alien): boolean {
    return this.kindOf(a).eatTime > 0 && !['stunned', 'eating', 'sleep', 'waking', 'toDonut', 'hugging'].includes(a.state);
  }

  private updateDonut(dt: number): void {
    const dn = this.donut;
    if (!dn) return;
    dn.age += dt;
    if (dn.eater >= 0) return;
    // Nearest hungry alien by walking distance gets it; every kid in range joins the race.
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

  // ---------------------------------------------------------------------------
  // Noise
  // ---------------------------------------------------------------------------
  noise(x: number, y: number, radius: number): void {
    this.emit({ type: 'noise', x, y, radius });
    for (const a of this.aliens) {
      if (!this.kindOf(a).hears || Math.hypot(a.x - x, a.y - y) > radius) continue;
      if (a.state === 'sleep') this.wake(a, { x, y });
      else if (AWAKE_CALM.includes(a.state) || (a.state === 'suspicious' && a.resume !== 'chase')) this.investigate(a, { x, y });
    }
  }

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

  private backToWork(a: Alien): void {
    a.sus = 0;
    a.stateT = 0;
    this.setState(a, 'return');
  }

  private canSee(a: Alien): boolean {
    const p = this.player, k = this.kindOf(a), range = this.visionRange(a);
    if (range <= 0 || (p.moonwalkT > 0 && k.fooled)) return false;
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
    if (d > range) return false;
    if (d > k.radius && Math.abs(angleDiff(Math.atan2(dy, dx), a.look)) > (k.half * Math.PI) / 180) return false;
    return this.grid.lineOfSight(a, p);
  }

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

    // Suspicion from the vision cone (all calm, awake states)
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

    switch (a.state) {
      case 'suspicious':
        a.speed = 0;
        if (a.sus <= 0) {
          this.setState(a, a.resume);
          this.emit({ type: 'calm', alien: a.id, x: a.x, y: a.y });
        }
        break;

      case 'patrol': this.patrol(a, dt); break;

      case 'chase': {
        const sees = Math.hypot(p.x - a.x, p.y - a.y) <= cfg.chaseSightRange && this.grid.lineOfSight(a, p);
        if (sees) { a.lastSeen = { x: p.x, y: p.y }; a.lostT = 0; }
        else {
          a.lostT += dt;
          // Hunch: they heard you round the corner and keep following for a moment.
          if (a.lostT < cfg.chaseHunch && Math.hypot(p.x - a.lastSeen.x, p.y - a.lastSeen.y) < cfg.chaseHunchRadius) {
            a.lastSeen = { x: p.x, y: p.y };
          }
        }
        const arrived = this.moveToward(a, tileOf(a.lastSeen.x), tileOf(a.lastSeen.y), this.alienSpeed(k.chase, false), true, dt);
        a.stateT += dt;
        const tired = a.stateT > cfg.chaseMaxTime;
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

      case 'search':
      case 'investigate': {
        const arrived = this.moveToward(a, tileOf(a.goal.x), tileOf(a.goal.y), this.alienSpeed(cfg.investigateSpeed), false, dt);
        this.lookAlong(a);
        if (arrived) {
          a.look += 2.5 * dt; // look around, puzzled
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
        if (!dn) { this.backToWork(a); break; }
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

  private homeTarget(a: Alien): Vec {
    const r = a.spec.route;
    return r.length > 1 ? r[a.routeIdx] : { x: a.spec.x, y: a.spec.y };
  }

  /** Point the eyes along the walking direction: backwards for locals, forwards for drones (or chasers). */
  private lookAlong(a: Alien, forwards = false): void {
    if (a.heading.x === 0 && a.heading.y === 0) return;
    const fwd = forwards || !this.kindOf(a).backwards;
    a.look = fwd ? Math.atan2(a.heading.y, a.heading.x) : Math.atan2(-a.heading.y, -a.heading.x);
  }

  private patrol(a: Alien, dt: number): void {
    const route = a.spec.route;
    if (a.kind === 'lookout' || route.length < 2) {
      a.speed = 0;
      if (a.kind === 'lookout') {
        a.lookoutT -= dt;
        if (a.lookoutT <= 0) {
          a.lookoutT = a.spec.turnEvery ?? CONFIG.alien.lookoutTurnEvery;
          a.baseLook += Math.PI;
        }
        a.look = a.baseLook;
      }
      return;
    }
    if (a.pauseT > 0) { a.pauseT -= dt; a.speed = 0; return; }
    const wp = route[a.routeIdx];
    if (this.moveToward(a, tileOf(wp.x), tileOf(wp.y), this.alienSpeed(this.patrolSpeed(a)), false, dt)) {
      a.pauseT = a.spec.pause ?? CONFIG.alien.waypointPause;
      if (a.spec.loop) a.routeIdx = (a.routeIdx + 1) % route.length;
      else {
        if (a.routeIdx + a.routeDir < 0 || a.routeIdx + a.routeDir >= route.length) a.routeDir = (-a.routeDir) as 1 | -1;
        a.routeIdx += a.routeDir;
      }
    } else {
      this.lookAlong(a);
    }
  }

  private fieldTo(c: number, r: number): Float64Array {
    const key = r * this.grid.w + c;
    let f = this.fields.get(key);
    if (!f) { f = this.grid.distField(c, r); this.fields.set(key, f); }
    return f;
  }

  /**
   * Walk along tile centers toward (gc, gr). Returns true when standing on the goal center.
   * `skiddy` (chasing): accelerates, and must stop + untangle its backwards legs at every turn.
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
    let budget = a.speed * dt;
    for (let iter = 0; iter < 3 && budget > 1e-6; iter++) {
      const cc = tileOf(a.x), cr = tileOf(a.y), cx = center(cc), cy = center(cr);
      let tx = cx, ty = cy;
      if (cc !== gc || cr !== gr) {
        const nxt = this.grid.stepDown(this.fieldTo(gc, gr), cc, cr);
        if (!nxt) { a.speed = 0; return false; }
        tx = center(nxt.c); ty = center(nxt.r);
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

  // ---------------------------------------------------------------------------
  // Hugs: getting caught
  // ---------------------------------------------------------------------------
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

/** ⭐ finish · ⭐ under par time · ⭐ never chased */
export function starsFor(w: World): number {
  if (w.status !== 'won') return 0;
  return 1 + (w.time <= w.level.parTime ? 1 : 0) + (w.timesChased === 0 ? 1 : 0);
}

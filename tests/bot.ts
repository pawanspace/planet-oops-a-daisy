// Bots that play the real simulation. Used to prove levels are solvable (careful bot) and that
// brute force doesn't trivialise them (rush bot).
import type { Difficulty } from '../src/sim/config';
import { DT } from '../src/sim/config';
import { Grid, center, tileOf } from '../src/sim/grid';
import { CONVEYOR_DIR, T, isConveyor, type LevelData } from '../src/sim/level';
import { NO_INPUT, World, type Input } from '../src/sim/world';

type Tile = [number, number];
export interface BotResult {
  won: boolean; status: string; time: number; chased: number; heartsLost: number; gadgets: number; where: string;
}
export interface BotOpts {
  difficulty?: Difficulty; maxTime?: number; plan?: Tile[]; gadgets?: boolean; log?: (s: string) => void;
}

const DECIDE = 6;          // steps between decisions (0.1s)
const HORIZON = 96;        // lookahead steps (1.6s)

// Tiles the careful bot has decided to route around (after waiting too long in front of them).
let AVOID = new Set<number>();

/** Grid the bot plans on: gates count as open if it carries a key, lasers as open (it waits at them). */
function planningGrid(w: World, avoid = true, standing = avoid): Grid {
  const g = new Grid(w.grid.w, w.grid.h, w.grid.tiles);
  g.lasersOpen = true;
  if (w.player.keys > 0) for (let i = 0; i < g.tiles.length; i++) if (g.tiles[i] === T.Gate) g.tiles[i] = T.Floor;
  if (avoid) for (const i of AVOID) g.tiles[i] = T.Wall;
  if (standing) {
    // Walk around aliens that are standing still (lookouts, door guards, sleepers).
    for (const a of w.aliens) {
      if (a.speed === 0 && ['patrol', 'sleep'].includes(a.state)) g.tiles[tileOf(a.y) * g.w + tileOf(a.x)] = T.Wall;
    }
  }
  return g;
}

function nextGoal(w: World, plan: Tile[]): Tile | null {
  const p = w.player, g = planningGrid(w, false);
  g.lasersOpen = true;
  const d = g.distField(tileOf(p.x), tileOf(p.y));
  const reach = ([c, r]: Tile) => g.dist(d, c, r) < Infinity;
  const nearest = (list: Tile[]) => list.filter(reach).sort((a, b) => g.dist(d, a[0], a[1]) - g.dist(d, b[0], b[1]))[0] ?? null;
  if (plan.length) return plan[0];
  // Long belt against us on the way? Pull a lever first.
  const target = rawGoal(w, nearest);
  if (target && w.levers.length) {
    let against = 0;
    const fd = g.distField(target[0], target[1]);
    for (const [c, r] of pathTo(w, target)) {
      const t = w.grid.get(c, r);
      if (!isConveyor(t)) continue;
      const [bx, by] = CONVEYOR_DIR[t];
      if (g.dist(fd, c + bx, r + by) > g.dist(fd, c, r)) against++;
    }
    if (against > 4) {
      const lv = nearest(w.levers.map(l => [tileOf(l.x), tileOf(l.y)] as Tile));
      if (lv) return lv;
    }
  }
  return target;
}

function rawGoal(w: World, nearest: (l: Tile[]) => Tile | null): Tile | null {
  const p = w.player;
  const gates = w.grid.tiles.includes(T.Gate);
  if (gates && p.keys === 0) {
    const k = nearest(w.keys.filter(k => !k.taken).map(k => [tileOf(k.x), tileOf(k.y)] as Tile));
    if (k) return k;
  }
  const t = nearest(w.terminals.filter(t => !t.done).map(t => [tileOf(t.x), tileOf(t.y)] as Tile));
  if (t) return t;
  return nearest(w.items.filter(i => !i.taken).map(i => [tileOf(i.x), tileOf(i.y)] as Tile));
}

function pathTo(w: World, goal: Tile): Tile[] {
  let c = tileOf(w.player.x), r = tileOf(w.player.y);
  let g = planningGrid(w), d = g.distField(goal[0], goal[1]);
  if (g.dist(d, c, r) === Infinity && AVOID.size) { // detours made it impossible: forget them
    AVOID = new Set();
    g = planningGrid(w);
    d = g.distField(goal[0], goal[1]);
  }
  if (g.dist(d, c, r) === Infinity) { // only way is past a standing alien: wait for it to move
    g = planningGrid(w, false, false);
    d = g.distField(goal[0], goal[1]);
  }
  const path: Tile[] = [[c, r]];
  for (let i = 0; i < 400 && !(c === goal[0] && r === goal[1]); i++) {
    const n = g.stepDown(d, c, r);
    if (!n) break;
    c = n.c; r = n.r;
    path.push([c, r]);
  }
  return path;
}

/** Steering input toward the next tile of a path (null = blocked by a closed laser, wait). */
function steer(w: World, path: Tile[], run: boolean): Input | null {
  const p = w.player, pc = tileOf(p.x), pr = tileOf(p.y);
  let i = path.findIndex(([c, r]) => c === pc && r === pr);
  if (i < 0) i = 0;
  const [tc, tr] = path[Math.min(i + 1, path.length - 1)];
  if (w.grid.get(tc, tr) === T.Laser && !w.grid.lasersOpen) return null;
  const dx = center(tc) - p.x, dy = center(tr) - p.y;
  // fight conveyors by running when they push against us
  let fightBelt = false;
  for (const belt of [w.grid.get(pc, pr), w.grid.get(tc, tr)]) {
    if (!isConveyor(belt)) continue;
    const [bx, by] = CONVEYOR_DIR[belt];
    if (bx * Math.sign(dx) + by * Math.sign(dy) < 0) fightBelt = true;
  }
  return { ...NO_INPUT, x: Math.abs(dx) > 2 ? Math.sign(dx) : 0, y: Math.abs(dy) > 2 ? Math.sign(dy) : 0, run: run || fightBelt };
}

type Policy = (w: World) => Input;
interface Risk { hug: number; seen: number } // steps until it happens (> horizon = never)

function risk(w: World, first: Input[], policy: Policy, horizon: number): Risk {
  const sim = w.clone();
  const out: Risk = { hug: horizon + 1, seen: horizon + 1 };
  for (let i = 0; i < horizon; i++) {
    sim.step(i < first.length ? first[i] : policy(sim));
    for (const e of sim.drainEvents()) {
      if ((e.type === 'spotted' || e.type === 'beep') && out.seen > horizon) out.seen = i;
      if (e.type === 'hug') { out.hug = i; return out; }
    }
    if (sim.status === 'lost') { out.hug = i; return out; }
  }
  return out;
}

const better = (a: Risk, b: Risk) => (a.hug !== b.hug ? a.hug > b.hug : a.seen > b.seen);

export function carefulBot(level: LevelData, opts: BotOpts = {}): BotResult {
  const w = new World(level, opts.difficulty ?? 'normal');
  const plan = [...(opts.plan ?? [])];
  const maxSteps = Math.round((opts.maxTime ?? 240) / DT);
  let gadgets = 0, waited = 0, stuck = 0;
  AVOID = new Set();

  for (let s = 0; s < maxSteps && w.status === 'playing'; s += DECIDE) {
    if (w.hug) { for (let i = 0; i < DECIDE; i++) w.step(NO_INPUT); w.drainEvents(); continue; }
    const pc = tileOf(w.player.x), pr = tileOf(w.player.y);
    if (plan.length && plan[0][0] === pc && plan[0][1] === pr) plan.shift();
    const goal = nextGoal(w, plan);
    if (!goal) break;
    const path = pathTo(w, goal);
    const chased = w.aliens.some(a => a.state === 'chase');

    // Follow the path; once this goal is done, head straight for the next one (e.g. flee after the alarm).
    const adv = (run: boolean): Policy => sim => {
      const done = (sim.player.keys > w.player.keys || sim.pickups > w.pickups || sim.terminals.some((t, i) => t.done && !w.terminals[i]?.done));
      const g = done ? nextGoal(sim, []) ?? goal : goal;
      return steer(sim, pathTo(sim, g), run) ?? NO_INPUT;
    };
    const hold: Policy = () => NO_INPUT;
    type Cand = { name: string; first: Input[]; policy: Policy; gadget?: boolean; horizon?: number };
    const cands: Cand[] = [];
    const walk = steer(w, path, false);
    if (walk) {
      cands.push({ name: 'walk', first: [walk], policy: adv(false) });
      cands.push({ name: 'run', first: [{ ...walk, run: true }], policy: adv(true) });
    }
    cands.push({ name: 'wait', first: [NO_INPUT], policy: hold });
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (w.grid.solid(pc + dc, pr + dr)) continue;
      const esc: Tile[] = [[pc, pr], [pc + dc, pr + dr]];
      cands.push({ name: `dodge${dc},${dr}`, first: [steer(w, esc, chased)!], policy: sim => steer(sim, esc, chased) ?? NO_INPUT });
    }
    if (opts.gadgets && walk && (waited > 4 || chased)) {
      if (w.player.cd.honk <= 0) cands.push({ name: 'honk', first: [{ ...walk, honk: true }], policy: adv(false), gadget: true });
      if (w.player.cd.moonwalk <= 0) cands.push({ name: 'moon', first: [{ ...walk, moonwalk: true }], policy: adv(false), gadget: true });
      if (w.player.cd.donut <= 0 && waited > 4) {
        // Lure: face a direction, throw, wait for someone to go eat, then walk on.
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (w.grid.solid(pc + dx, pr + dy)) continue;
          const throwIt: Input[] = [{ ...NO_INPUT, x: dx, y: dy }, { ...NO_INPUT, donut: true }, ...Array<Input>(150).fill(NO_INPUT)];
          cands.push({ name: `donut${dx},${dy}`, first: throwIt, policy: adv(false), gadget: true, horizon: throwIt.length + HORIZON });
        }
      }
    }

    // Prefer the first fully safe option; otherwise whatever delays a hug (then being seen) the longest.
    let pick = cands[0], best: Risk = { hug: -1, seen: -1 };
    for (const c of cands) {
      const h = c.horizon ?? HORIZON;
      const r = risk(w, c.first, c.policy, h);
      // After a long wait, being seen is acceptable (some levels make you trigger a chase).
      if (r.hug > h && (r.seen > h || chased || stuck > 8)) { pick = c; best = r; break; }
      if (better(r, best)) { best = r; pick = c; }
    }
    if (pick.gadget) gadgets++;
    const moving = pick.name === 'walk' || pick.name === 'run';
    waited = moving || pick.gadget ? 0 : waited + DECIDE * DT;
    stuck = moving ? Math.max(0, stuck - DECIDE * DT * 0.5) : stuck + DECIDE * DT;
    if (waited > (opts.gadgets ? 9 : 5) && path.length > 1) {
      // Give up on this way through: block the next few tiles and plan a detour.
      for (const [c, r] of path.slice(1, 4)) if (!(c === goal[0] && r === goal[1])) AVOID.add(r * w.grid.w + c);
      waited = 0;
    }
    if (opts.log && s % 60 === 0) {
      opts.log(`${(s * DT).toFixed(1)}s at ${pc},${pr} goal ${goal} ${pick.name} hug=${best.hug} seen=${best.seen} `
        + w.aliens.map(a => `${a.kind[0]}${tileOf(a.x)},${tileOf(a.y)}:${a.state}`).join(' '));
    }

    // Donut lures commit to the throw (2 steps), everything else to one decision period.
    const steps = pick.first.length > 1 ? 2 : DECIDE;
    for (let i = 0; i < steps; i++) w.step(i < pick.first.length ? pick.first[i] : pick.policy(w));
    s += steps - DECIDE;
    w.drainEvents();
  }
  const p = w.player;
  return {
    won: w.status === 'won', status: w.status, time: Math.round(w.time * 10) / 10, chased: w.timesChased,
    heartsLost: p.maxHearts - p.hearts, gadgets, where: `${tileOf(p.x)},${tileOf(p.y)}`,
  };
}

/** Walks the shortest route at full speed, honking and moonwalking whenever an alien gets close. */
export function rushBot(level: LevelData, difficulty: Difficulty = 'normal', maxTime = 240): BotResult {
  const w = new World(level, difficulty);
  let gadgets = 0;
  AVOID = new Set();
  for (let s = 0; s < maxTime / DT && w.status === 'playing'; s++) {
    const goal = nextGoal(w, []);
    if (!goal) break;
    const input = steer(w, pathTo(w, goal), true) ?? { ...NO_INPUT };
    const close = w.aliens.some(a => Math.hypot(a.x - w.player.x, a.y - w.player.y) < 2.5 * 48);
    if (close && w.player.cd.honk <= 0) { input.honk = true; gadgets++; }
    else if (w.aliens.some(a => a.state === 'chase') && w.player.cd.moonwalk <= 0) { input.moonwalk = true; gadgets++; }
    w.step(input);
    w.drainEvents();
  }
  const p = w.player;
  return {
    won: w.status === 'won', status: w.status, time: Math.round(w.time * 10) / 10, chased: w.timesChased,
    heartsLost: p.maxHearts - p.hearts, gadgets, where: `${tileOf(p.x)},${tileOf(p.y)}`,
  };
}

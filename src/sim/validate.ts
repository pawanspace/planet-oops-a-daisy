// =============================================================================
// 📘 LESSON: Checking a level before anyone plays it
// =============================================================================
// A level can be broken in sneaky ways: a ship part behind a wall, a key nobody can reach, a gate you can just walk
// around. These checks catch that BEFORE a player gets stuck. The level editor shows them live as you build, and
// the tests run them on every campaign level.
//
// Errors   = the level can't be finished (must fix).
// Warnings = it works, but something is probably not what you meant.
// =============================================================================
import { Grid, tileOf } from './grid';
import { T, type LevelData, type Vec } from './level';

const at = (v: Vec) => ({ c: tileOf(v.x), r: tileOf(v.y) });

/**
 * Open up the map the way a player eventually can: lasers open if a Heavy can reach a plate, shields drop once every
 * terminal is reachable, and every reachable key opens one gate next to the reachable area.
 */
export function solveGates(lvl: LevelData): { grid: Grid; gatesOpened: number } {
  const grid = new Grid(lvl.width, lvl.height, lvl.tiles);
  const s = at(lvl.start);
  const heavyOnPlate = lvl.aliens.some(a => {
    if (a.kind !== 'heavy') return false;
    const d = grid.distField(at(a).c, at(a).r);
    return lvl.tiles.some((t, i) => t === T.Plate && d[i] < Infinity);
  });
  grid.lasersOpen = heavyOnPlate;
  const fromStart = grid.distField(s.c, s.r);
  if (lvl.terminals.length && lvl.terminals.every(t => grid.dist(fromStart, at(t).c, at(t).r) < Infinity)) {
    for (let i = 0; i < grid.tiles.length; i++) if (grid.tiles[i] === T.Shield) grid.tiles[i] = T.Floor;
  }
  let keysLeft = 0, gatesOpened = 0;
  const usedKeys = new Set<number>();
  for (;;) {
    const d = grid.distField(s.c, s.r);
    lvl.keys.forEach((k, i) => {
      if (!usedKeys.has(i) && grid.dist(d, at(k).c, at(k).r) < Infinity) { usedKeys.add(i); keysLeft++; }
    });
    if (keysLeft === 0) return { grid, gatesOpened };
    let opened = false;
    for (let r = 0; r < lvl.height && !opened; r++) for (let c = 0; c < lvl.width && !opened; c++) {
      if (grid.get(c, r) !== T.Gate) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => grid.dist(d, c + dc, r + dr) < Infinity);
      if (!near) continue;
      const stack = [[c, r]];
      while (stack.length) {
        const [sc, sr] = stack.pop()!;
        if (grid.get(sc, sr) !== T.Gate) continue;
        grid.set(sc, sr, T.Floor);
        stack.push([sc + 1, sr], [sc - 1, sr], [sc, sr + 1], [sc, sr - 1]);
      }
      opened = true;
    }
    if (!opened) return { grid, gatesOpened };
    keysLeft--;
    gatesOpened++;
  }
}

export interface Report { errors: string[]; warnings: string[] }

export function validateLevel(lvl: LevelData): Report {
  const errors: string[] = [], warnings: string[] = [];
  const grid = new Grid(lvl.width, lvl.height, lvl.tiles);
  const walkable = (v: Vec) => !grid.solid(at(v).c, at(v).r);
  const where = (v: Vec) => `(${at(v).c}, ${at(v).r})`;

  if (!walkable(lvl.start)) errors.push(`Leo starts inside a wall at ${where(lvl.start)}.`);
  if (!lvl.items.length) errors.push('Add at least one ship part ⚡: collecting them all wins the level.');
  const named: [string, Vec[]][] = [['Ship part', lvl.items], ['Key', lvl.keys], ['Flag', lvl.checkpoints], ['Lever', lvl.levers], ['Terminal', lvl.terminals], ['Sock', lvl.socks]];
  for (const [name, list] of named) for (const v of list) if (!walkable(v)) errors.push(`${name} at ${where(v)} is inside a wall.`);
  lvl.aliens.forEach((a, i) => {
    if (!walkable(a)) errors.push(`Alien ${i + 1} (${a.kind}) is inside a wall at ${where(a)}.`);
    const d = grid.distField(at(a).c, at(a).r);
    for (const wp of a.route) if (grid.dist(d, at(wp).c, at(wp).r) === Infinity) errors.push(`Alien ${i + 1} can't walk to its route point ${where(wp)}.`);
  });

  if (walkable(lvl.start)) {
    const { grid: open } = solveGates(lvl);
    const d = open.distField(at(lvl.start).c, at(lvl.start).r);
    const reach = (v: Vec) => open.dist(d, at(v).c, at(v).r) < Infinity;
    for (const it of lvl.items) if (walkable(it) && !reach(it)) errors.push(`Leo can never reach the ship part at ${where(it)}.`);
    for (const k of lvl.keys) if (walkable(k) && !reach(k)) warnings.push(`The key at ${where(k)} can't be reached.`);
    for (const s of lvl.socks) if (walkable(s) && !reach(s)) warnings.push(`The sock at ${where(s)} can't be reached.`);
    const plain = grid.distField(at(lvl.start).c, at(lvl.start).r);
    const hasLock = [T.Gate, T.Laser, T.Shield].some(t => lvl.tiles.includes(t));
    if (hasLock && lvl.items.length && lvl.items.every(it => grid.dist(plain, at(it).c, at(it).r) < Infinity)) {
      warnings.push('You can reach every ship part without going through a gate/laser/shield, so they don\'t matter.');
    }
  }
  const has = (t: number) => lvl.tiles.includes(t as never);
  if (has(T.Gate) && !lvl.keys.length) warnings.push('There\'s a gate but no key 🗝️.');
  if (has(T.Laser) && !(has(T.Plate) && lvl.aliens.some(a => a.kind === 'heavy'))) warnings.push('Lasers only open when a Heavy stands on a pressure plate: add both.');
  if (has(T.Shield) && !lvl.terminals.length) warnings.push('Shields only drop when every terminal 🖥️ is hacked: add some terminals.');
  if ([T.ConvUp, T.ConvDown, T.ConvLeft, T.ConvRight].some(has) && !lvl.levers.length) warnings.push('Tip: add a lever 🕹️ so players can flip the belts.');
  return { errors, warnings };
}

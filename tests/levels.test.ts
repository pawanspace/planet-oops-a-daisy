// Validates every Tiled map in levels/: walkable spawns, reachable objectives, gates that actually matter.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Grid, tileOf } from '../src/sim/grid';
import { T, loadTiled, type LevelData, type TiledMap, type Vec } from '../src/sim/level';

const files = readdirSync('levels').filter(f => f.endsWith('.tmj'));
const at = (v: Vec) => ({ c: tileOf(v.x), r: tileOf(v.y) });

/** Reachable tiles from start, opening one gate per reachable key (like the game does). */
function solveGates(lvl: LevelData): { grid: Grid; gatesOpened: number } {
  const grid = new Grid(lvl.width, lvl.height, lvl.tiles);
  const s = at(lvl.start);
  // Lasers open when a Heavy can reach a plate; shields drop once every terminal is reachable.
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
    // open a gate tile next to the reachable area
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

describe.each(files)('level %s', file => {
  const lvl = loadTiled(JSON.parse(readFileSync(`levels/${file}`, 'utf8')) as TiledMap, file);
  const grid = new Grid(lvl.width, lvl.height, lvl.tiles);
  const walkable = (v: Vec) => !grid.solid(at(v).c, at(v).r);

  it('has a name, a start and at least one item', () => {
    expect(lvl.name).not.toBe('');
    expect(walkable(lvl.start)).toBe(true);
    expect(lvl.items.length).toBeGreaterThan(0);
  });

  it('puts every object on walkable floor', () => {
    for (const v of [...lvl.keys, ...lvl.items, ...lvl.checkpoints, ...lvl.socks]) expect(walkable(v), `${JSON.stringify(at(v))}`).toBe(true);
    for (const a of lvl.aliens) {
      expect(walkable(a), `alien at ${JSON.stringify(at(a))}`).toBe(true);
      for (const wp of a.route) expect(walkable(wp), `route point ${JSON.stringify(at(wp))}`).toBe(true);
    }
  });

  it('every alien can walk its whole route', () => {
    for (const a of lvl.aliens) {
      const d = grid.distField(at(a).c, at(a).r);
      for (const wp of a.route) expect(grid.dist(d, at(wp).c, at(wp).r), `route point ${JSON.stringify(at(wp))}`).toBeLessThan(Infinity);
    }
  });

  it('every item is reachable using the keys', () => {
    const { grid: open } = solveGates(lvl);
    const d = open.distField(at(lvl.start).c, at(lvl.start).r);
    for (const it of lvl.items) expect(open.dist(d, at(it).c, at(it).r), `item ${JSON.stringify(at(it))}`).toBeLessThan(Infinity);
    for (const cp of [...lvl.checkpoints, ...lvl.socks]) expect(open.dist(d, at(cp).c, at(cp).r)).toBeLessThan(Infinity);
  });

  it('gates, lasers and shields cannot be skipped', () => {
    if (![T.Gate, T.Laser, T.Shield].some(t => lvl.tiles.includes(t))) return;
    const d = grid.distField(at(lvl.start).c, at(lvl.start).r);
    const skippable = lvl.items.every(it => grid.dist(d, at(it).c, at(it).r) < Infinity);
    expect(skippable, 'all items reachable with every gate closed').toBe(false);
  });
});

// Validates every Tiled map in levels/: walkable spawns, reachable objectives, gates that actually matter.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Grid, tileOf } from '../src/sim/grid';
import { T, loadTiled, toTiled, type TiledMap, type Vec } from '../src/sim/level';
import { solveGates, validateLevel } from '../src/sim/validate';

const files = readdirSync('levels').filter(f => f.endsWith('.tmj'));
const at = (v: Vec) => ({ c: tileOf(v.x), r: tileOf(v.y) });

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

  it('passes the editor checks with no errors or warnings', () => {
    expect(validateLevel(lvl)).toEqual({ errors: [], warnings: [] });
  });

  it('survives a round trip through toTiled (the editor\'s export)', () => {
    expect(loadTiled(toTiled(lvl) as TiledMap, file)).toEqual(lvl);
  });

  it('gates, lasers and shields cannot be skipped', () => {
    if (![T.Gate, T.Laser, T.Shield].some(t => lvl.tiles.includes(t))) return;
    const d = grid.distField(at(lvl.start).c, at(lvl.start).r);
    const skippable = lvl.items.every(it => grid.dist(d, at(it).c, at(it).r) < Infinity);
    expect(skippable, 'all items reachable with every gate closed').toBe(false);
  });
});

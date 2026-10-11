// The editor's live checks (src/sim/validate.ts) must catch broken levels.
import { describe, expect, it } from 'vitest';
import { loadTiled, toTiled, type TiledMap } from '../src/sim/level';
import { validateLevel } from '../src/sim/validate';
import { alien, ascii } from './helpers';

describe('level checks', () => {
  it('a simple level is fine', () => {
    expect(validateLevel(ascii(['#####', '#P.I#', '#####']))).toEqual({ errors: [], warnings: [] });
  });
  it('no ship part is an error', () => {
    expect(validateLevel(ascii(['#####', '#P..#', '#####'])).errors.join()).toMatch(/ship part/);
  });
  it('an unreachable ship part is an error', () => {
    expect(validateLevel(ascii(['#####', '#P#I#', '#####'])).errors.join()).toMatch(/never reach/);
  });
  it('a key opens the way', () => {
    expect(validateLevel(ascii(['######', '#PKGI#', '######'])).errors).toEqual([]);
  });
  it('a gate you can walk around is a warning', () => {
    expect(validateLevel(ascii(['######', '#PKGI#', '#....#', '######'])).warnings.join()).toMatch(/don't matter/);
  });
  it('an alien that cannot walk its route is an error', () => {
    expect(validateLevel(ascii(['#######', '#P.#.I#', '#######'], [alien('stroller', [[1, 1], [4, 1]])])).errors.join()).toMatch(/route/);
  });
  it('a gate with no key is a warning', () => {
    expect(validateLevel(ascii(['#####', '#PGI#', '#####'])).warnings.join()).toMatch(/no key/);
  });
  it('editor export round-trips aliens with every setting', () => {
    const lvl = ascii(['########', '#P....I#', '########'], [alien('lookout', [[3, 1]], { facing: Math.PI / 2, turnEvery: 2, name: 'Bob' }), alien('stroller', [[2, 1], [5, 1]], { loop: true, speed: 50, pause: 1 })]);
    lvl.theme = 'market';
    expect(loadTiled(toTiled(lvl) as TiledMap, 'test')).toEqual({ ...lvl, name: 'test' });
  });
});

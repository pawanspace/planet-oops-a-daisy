// Tests for the level devices (belts, levers, plates, lasers, terminals, socks) and the special aliens.
// See mechanics.test.ts for how tests work.
import { describe, expect, it } from 'vitest';
import { center, tileOf } from '../src/sim/grid';
import { T } from '../src/sim/level';
import { NO_INPUT, World, type GameEvent } from '../src/sim/world';
import { alien, ascii, place, press, run } from './helpers';

const types = (ev: GameEvent[]) => ev.map(e => e.type);
function collect(w: World, seconds: number, input = {}): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < seconds * 60; i++) { w.step({ ...NO_INPUT, ...input }); ev.push(...w.drainEvents()); }
  return ev;
}

describe('conveyors and levers', () => {
  const belt = () => ascii([
    '##############',
    '#P.<<<<<<<...#',
    '#L...........#',
    '##############',
  ]);

  it('walking cannot beat a belt, running can', () => {
    const w = new World(belt());
    place(w, 2, 1);
    run(w, 2, { x: 1 });
    expect(tileOf(w.player.x)).toBeLessThanOrEqual(2);
    const r = new World(belt());
    place(r, 2, 1);
    run(r, 10, { x: 1, run: true });
    expect(tileOf(r.player.x)).toBeGreaterThanOrEqual(10);
  });

  it('a lever reverses every belt', () => {
    const w = new World(belt());
    place(w, 1, 2);
    w.step(NO_INPUT);
    expect(w.grid.get(5, 1)).toBe(T.ConvRight);
    place(w, 2, 1);
    run(w, 2.5, { x: 1 });
    expect(tileOf(w.player.x)).toBeGreaterThanOrEqual(10);
  });

  it('moonwalk shoes grip the belt', () => {
    const w = new World(belt());
    place(w, 5, 1);
    press(w, 'moonwalk');
    const x0 = w.player.x;
    run(w, 1);
    expect(w.player.x).toBeCloseTo(x0, 0);
  });
});

describe('pressure plates and lasers', () => {
  const yard = (pause = 4) => ascii([
    '##############',
    '#P....|....I.#',
    '######.#######',
    '#.....o......#',
    '##############',
  ], [alien('heavy', [[2, 3], [6, 3]], { pause })]);

  it('only a Heavy holds the laser open', () => {
    const w = new World(yard());
    place(w, 6, 3);
    const ev = collect(w, 0.2);
    expect(types(ev)).toContain('tooLight');
    expect(w.grid.lasersOpen).toBe(false);
  });

  it('the laser opens while the Heavy stands on the plate', () => {
    const w = new World(yard());
    place(w, 1, 1);
    const ev = collect(w, 6);
    expect(types(ev)).toContain('laserOpen');
  });

  it('the laser never closes on the player', () => {
    const w = new World(yard(0.1));
    place(w, 1, 1);
    collect(w, 6);
    w.grid.lasersOpen = true;
    place(w, 6, 1); // standing in the beam
    w.aliens[0].x = center(2);
    w.step(NO_INPUT);
    expect(w.grid.lasersOpen).toBe(true);
    run(w, 1, { x: 1 });
    expect(tileOf(w.player.x)).toBeGreaterThan(6);
  });

  it('a donut lures the Heavy onto the plate', () => {
    const w = new World(ascii([
      '##############',
      '#P....|....I.#',
      '######.#######',
      '#.....o......#',
      '##############',
    ], [alien('heavy', [[1, 3], [3, 3]], { pause: 0.1 })]));
    place(w, 9, 3);
    w.step({ ...NO_INPUT, x: -1 });
    press(w, 'donut');
    expect(tileOf(w.donut!.x)).toBe(6);
    const ev = collect(w, 6);
    expect(types(ev)).toContain('eat');
    expect(w.grid.lasersOpen).toBe(true);
  });
});

describe('terminals and shields', () => {
  it('standing on every terminal drops the shield', () => {
    const w = new World(ascii([
      '###########',
      '#PT...T.=I#',
      '###########',
    ]));
    place(w, 2, 1);
    run(w, 1);
    expect(w.terminals[0].done).toBe(false);
    run(w, 1.2);
    expect(w.terminals[0].done).toBe(true);
    place(w, 6, 1);
    const ev = collect(w, 2.2);
    expect(types(ev)).toContain('shieldDown');
    expect(w.grid.get(8, 1)).toBe(T.Floor);
  });

  it('walking off a terminal loses the progress', () => {
    const w = new World(ascii(['#######', '#PT...#', '#######']));
    place(w, 2, 1);
    run(w, 1.5);
    place(w, 5, 1);
    run(w, 1);
    place(w, 2, 1);
    run(w, 1);
    expect(w.terminals[0].done).toBe(false);
  });
});

describe('new aliens', () => {
  it('one donut pulls in every kid nearby', () => {
    const w = new World(ascii([
      '################',
      '#..............#',
      '################',
    ], [alien('kid', [[9, 1]]), alien('kid', [[11, 1]]), alien('kid', [[13, 1]])]));
    place(w, 3, 1);
    w.step({ ...NO_INPUT, x: 1 });
    press(w, 'donut');
    run(w, 0.1);
    expect(w.aliens.every(a => a.state === 'toDonut')).toBe(true);
  });

  it('scooters are blind but still crash into you', () => {
    const w = new World(ascii(['################', '#..............#', '################'], [alien('scooter', [[2, 1], [14, 1]])]));
    place(w, 13, 1);
    const ev = collect(w, 3);
    expect(types(ev)).not.toContain('suspicious');
    expect(types(ev)).toContain('hug');
  });

  it('drones are not fooled by moonwalk and call everyone over, but cannot hug', () => {
    const w = new World(ascii([
      '################',
      '#..............#',
      '#.############.#',
      '#..............#',
      '################',
    ], [alien('drone', [[4, 1], [12, 1]]), alien('stroller', [[8, 3]])]));
    place(w, 7, 1); // ahead of the drone: drones look forwards
    press(w, 'moonwalk');
    const ev = collect(w, 1.5);
    expect(types(ev)).toContain('beep');
    expect(w.aliens[1].state).toBe('investigate');
    place(w, tileOf(w.aliens[0].x), tileOf(w.aliens[0].y));
    w.step(NO_INPUT);
    expect(w.hug).toBeNull();
  });

  it('the alarm sends everyone after you once the first part is taken', () => {
    const w = new World(ascii([
      '##############',
      '#PI.........I#',
      '##############',
    ], [alien('stroller', [[10, 1]])], { alarmAfter: 1 }));
    const ev = collect(w, 0.5, { x: 1 });
    expect(types(ev)).toContain('alarm');
    expect(w.alarm).toBe(true);
    expect(w.aliens[0].state).toBe('investigate');
  });
});

describe('socks', () => {
  it('a sock is a bonus pickup and not needed to win', () => {
    const w = new World(ascii(['#######', '#PXI..#', '#######']));
    const ev = collect(w, 1, { x: 1 });
    expect(types(ev)).toContain('sock');
    expect(w.status).toBe('won');
    const w2 = new World(ascii(['#######', '#PI.X.#', '#######']));
    collect(w2, 0.4, { x: 1 });
    expect(w2.status).toBe('won');
    expect(w2.socks[0].taken).toBe(false);
  });
});

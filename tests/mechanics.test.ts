import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/config';
import { center, tileOf } from '../src/sim/grid';
import { NO_INPUT, World, type GameEvent } from '../src/sim/world';
import { alien, ascii, place, press, run } from './helpers';

const CORRIDOR = [
  '##############################',
  '#............................#',
  '##############################',
];

const startChase = (w: World, i = 0) => (w as unknown as { startChase(a: unknown): void }).startChase(w.aliens[i]);
const types = (ev: GameEvent[]) => ev.map(e => e.type);

describe('backwards vision cone', () => {
  const lvl = () => ascii(CORRIDOR, [alien('stroller', [[8, 1], [20, 1]])]); // walks right, eyes look left

  it('sees a player standing BEHIND it', () => {
    const w = new World(lvl());
    place(w, 5, 1);
    run(w, 0.3);
    expect(w.aliens[0].state).toBe('suspicious');
    expect(w.aliens[0].sus).toBeGreaterThan(0);
  });

  it('does NOT see a player standing in FRONT of it', () => {
    const w = new World(lvl());
    place(w, 13, 1);
    run(w, 0.5);
    expect(w.aliens[0].state).toBe('patrol');
    expect(w.aliens[0].sus).toBe(0);
  });

  it('a full suspicion meter turns into a chase', () => {
    const w = new World(lvl());
    place(w, 6, 1);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 72; i++) { w.step(NO_INPUT); ev.push(...w.drainEvents()); }
    expect(types(ev)).toContain('spotted');
    expect(w.timesChased).toBe(1);
  });

  it('leaving the cone drains suspicion and the alien calms down', () => {
    const w = new World(ascii([
      '##############################',
      '#............................#',
      '#######.######################',
      '#######.######################',
      '##############################',
    ], [alien('stroller', [[10, 1], [20, 1]])]));
    place(w, 7, 1);
    run(w, 0.25);
    expect(w.aliens[0].state).toBe('suspicious');
    place(w, 7, 3); // duck out of sight
    run(w, 2);
    expect(w.aliens[0].state).toBe('patrol');
  });
});

describe('chases: fast on straights, terrible at corners', () => {
  it('catches a walking player in a long straight hallway', () => {
    const w = new World(ascii(CORRIDOR, [alien('stroller', [[2, 1]])]));
    place(w, 7, 1);
    startChase(w);
    let bonked = false;
    for (let i = 0; i < 6 * 60 && !bonked; i++) {
      w.step({ ...NO_INPUT, x: 1 });
      bonked = types(w.drainEvents()).includes('hug');
    }
    expect(bonked).toBe(true);
  });

  it('a walking player escapes through a zig-zag', () => {
    // Staircase: right 2, down 2, repeat.
    const N = 40, rows: string[][] = Array.from({ length: N }, () => Array(N).fill('#'));
    const path: [number, number][] = [];
    let c = 1, r = 1;
    path.push([c, r]);
    for (let k = 0; path.length < 70; k++) {
      for (let s = 0; s < 2; s++) { if (k % 2 === 0) c++; else r++; path.push([c, r]); }
    }
    for (const [pc, pr] of path) rows[pr][pc] = '.';
    const w = new World(ascii(rows.map(x => x.join('')), [alien('stroller', [path[0]])]));
    let idx = 5;
    place(w, ...path[idx]);
    startChase(w);
    const gap = () => Math.hypot(w.aliens[0].x - w.player.x, w.aliens[0].y - w.player.y);
    const gap0 = gap();
    let bonked = false;
    for (let i = 0; i < 8 * 60 && !bonked; i++) {
      const [tc, tr] = path[Math.min(idx + 1, path.length - 1)];
      const dx = center(tc) - w.player.x, dy = center(tr) - w.player.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) idx++;
      w.step({ ...NO_INPUT, x: Math.abs(dx) > 1 ? Math.sign(dx) : 0, y: Math.abs(dy) > 1 ? Math.sign(dy) : 0 });
      bonked = types(w.drainEvents()).includes('hug');
    }
    expect(bonked).toBe(false);
    expect(gap()).toBeGreaterThan(gap0);
  });

  it('skids at a corner', () => {
    const w = new World(ascii([
      '##########',
      '#........#',
      '########.#',
      '########.#',
      '##########',
    ], [alien('stroller', [[1, 1]])]));
    place(w, 7, 1);
    startChase(w);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 120; i++) { // walk to the corner, then down out of sight
      const toCorner = center(8) - w.player.x;
      w.step({ ...NO_INPUT, x: Math.abs(toCorner) > 1 ? Math.sign(toCorner) : 0, y: Math.abs(toCorner) <= 1 ? 1 : 0 });
      ev.push(...w.drainEvents());
    }
    expect(types(ev)).toContain('skid');
  });

  it('gives up after losing sight and returns to its route', () => {
    const w = new World(ascii([
      '##############',
      '#............#',
      '#.##########.#',
      '#............#',
      '##############',
    ], [alien('stroller', [[6, 1], [9, 1]])]));
    place(w, 10, 1);
    startChase(w);
    run(w, 0.1);
    place(w, 1, 3); // vanish far away, out of sight
    run(w, 3);
    expect(['search', 'return', 'patrol']).toContain(w.aliens[0].state);
    run(w, 8);
    expect(['return', 'patrol']).toContain(w.aliens[0].state);
  });
});

describe('noise', () => {
  const lvl = () => ascii([
    '############',
    '#..........#',
    '#.########.#',
    '#..........#',
    '############',
  ], [alien('stroller', [[5, 3]])]);

  it('running footsteps are heard through walls', () => {
    const w = new World(lvl());
    place(w, 3, 1);
    run(w, 0.5, { x: 1, run: true });
    expect(w.aliens[0].state).toBe('investigate');
  });

  it('walking is silent', () => {
    const w = new World(lvl());
    place(w, 3, 1);
    run(w, 0.5, { x: 1 });
    expect(w.aliens[0].state).toBe('patrol');
  });

  it('running on carpet is silent', () => {
    const w = new World(ascii([
      '############',
      '#~~~~~~~~~~#',
      '#.########.#',
      '#..........#',
      '############',
    ], [alien('stroller', [[5, 3]])]));
    place(w, 3, 1);
    run(w, 0.5, { x: 1, run: true });
    expect(w.aliens[0].state).toBe('patrol');
  });

  it('squeaky tiles squeak even when walking', () => {
    const w = new World(ascii([
      '############',
      '#...!......#',
      '#.########.#',
      '#..........#',
      '############',
    ], [alien('stroller', [[5, 3]])]));
    place(w, 2, 1);
    run(w, 0.8, { x: 1 });
    expect(w.aliens[0].state).toBe('investigate');
  });
});

describe('gadgets', () => {
  it('honk stuns close aliens (harmless) but pulls far ones in', () => {
    const w = new World(ascii([
      '##############',
      '#............#',
      '#.##########.#',
      '#............#',
      '##############',
    ], [alien('stroller', [[3, 1]]), alien('stroller', [[6, 3]])]));
    place(w, 2, 1);
    press(w, 'honk');
    expect(w.aliens[0].state).toBe('stunned');
    expect(w.aliens[1].state).toBe('investigate');
    w.player.x = w.aliens[0].x; // walk right into the stunned alien: no hug
    run(w, 0.5);
    expect(w.hug).toBeNull();
    expect(w.player.hearts).toBe(w.player.maxHearts);
  });

  it('honk has a cooldown', () => {
    const w = new World(ascii(CORRIDOR));
    press(w, 'honk');
    w.drainEvents();
    press(w, 'honk');
    expect(types(w.drainEvents())).not.toContain('honk');
  });

  it('moonwalk disguise: aliens ignore you, but you move at half speed', () => {
    const w = new World(ascii(CORRIDOR, [alien('stroller', [[8, 1], [20, 1]])]));
    place(w, 5, 1);
    press(w, 'moonwalk');
    run(w, 1);
    expect(w.aliens[0].sus).toBe(0);
    const x0 = w.player.x;
    run(w, 1, { x: -1, run: true });
    expect(x0 - w.player.x).toBeCloseTo(75, -1);
  });

  it('moonwalk shakes off a chaser', () => {
    const w = new World(ascii(CORRIDOR, [alien('stroller', [[2, 1]])]));
    place(w, 10, 1);
    startChase(w);
    run(w, 0.2);
    press(w, 'moonwalk');
    expect(w.aliens[0].state).toBe('search');
  });

  it('donut lands 3 tiles ahead and the nearest alien eats it for a while', () => {
    const w = new World(ascii(CORRIDOR, [alien('stroller', [[12, 1]]), alien('stroller', [[25, 1]])]));
    place(w, 3, 1);
    w.step({ ...NO_INPUT, x: 1 }); // face right
    press(w, 'donut');
    expect(tileOf(w.donut!.x)).toBe(tileOf(w.player.x) + 3);
    run(w, 0.1);
    expect(w.aliens[0].state).toBe('toDonut');
    expect(w.aliens[1].state).toBe('patrol');
    run(w, 4);
    expect(w.aliens[0].state).toBe('eating');
    run(w, 3);
    expect(w.aliens[0].state).not.toBe('eating');
  });

  it('donut stops at walls', () => {
    const w = new World(ascii([
      '######',
      '#..#.#',
      '######',
    ]));
    place(w, 1, 1);
    w.step({ ...NO_INPUT, x: 1 });
    press(w, 'donut');
    expect(tileOf(w.donut!.x)).toBe(2);
  });
});

describe('aliens', () => {
  it('lookouts swing their gaze', () => {
    const w = new World(ascii(CORRIDOR, [alien('lookout', [[10, 1]], { facing: 0, turnEvery: 2 })]));
    place(w, 13, 1); // to the right = in view at facing 0
    run(w, 0.2);
    expect(w.aliens[0].state).toBe('suspicious');
    const w2 = new World(ascii(CORRIDOR, [alien('lookout', [[10, 1]], { facing: 0, turnEvery: 2 })]));
    place(w2, 6, 1); // to the left: hidden until it turns
    run(w2, 1.5);
    expect(w2.aliens[0].state).toBe('patrol');
    run(w2, 1);
    expect(w2.aliens[0].state).toBe('suspicious');
  });

  it('huggers sleep through walking but wake up to running and chase', () => {
    const w = new World(ascii(CORRIDOR, [alien('hugger', [[12, 1]])]));
    place(w, 7, 1);
    run(w, 0.5, { x: 1 });
    expect(w.aliens[0].state).toBe('sleep');
    place(w, 10, 1);
    run(w, 0.3, { x: -1, run: true });
    run(w, 1);
    expect(['waking', 'chase']).toContain(w.aliens[0].state);
  });
});

describe('bonks, keys, gates', () => {
  it('a hug holds you, costs a heart, your key goes back to its spot, you respawn at the checkpoint', () => {
    const w = new World(ascii([
      '##############',
      '#P..CK.......#',
      '##############',
    ], [alien('stroller', [[11, 1], [12, 1]])]));
    place(w, 5, 1);
    w.step(NO_INPUT); // pick up the key
    expect(w.player.keys).toBe(1);
    place(w, 11, 1);
    w.player.respawn = { x: center(4), y: center(1) };
    w.step(NO_INPUT);
    expect(w.hug).not.toBeNull();
    run(w, 0.5, { x: -1 });
    expect(tileOf(w.player.x)).toBe(11); // stuck in the hug
    run(w, 1);
    expect(w.hug).toBeNull();
    expect(w.player.hearts).toBe(w.player.maxHearts - 1);
    expect(tileOf(w.player.x)).toBe(4);
    expect(w.player.keys).toBe(0);
    expect(w.keys.some(k => !k.taken && tileOf(k.x) === 5)).toBe(true); // put back where it was
  });

  it('a key opens the gate for good; collecting all items wins', () => {
    const w = new World(ascii([
      '##########',
      '#PK..G.I.#',
      '##########',
    ]));
    run(w, 3, { x: 1 });
    expect(w.status).toBe('won');
    expect(w.grid.get(5, 1)).toBe(1);
  });

  it('loses when out of hearts', () => {
    const w = new World(ascii(CORRIDOR, [alien('stroller', [[3, 1]])]), 'hard');
    for (let i = 0; i < 2; i++) { place(w, 3, 1); w.player.invuln = 0; run(w, 1.3); }
    expect(w.status).toBe('lost');
  });
});

describe('determinism', () => {
  it('same inputs give the same result', () => {
    const make = () => new World(ascii([
      '##############',
      '#P...........#',
      '#.##.#####.#.#',
      '#............#',
      '##############',
    ], [alien('stroller', [[6, 1], [12, 1], [12, 3], [6, 3]], { loop: true }), alien('lookout', [[3, 3]])]));
    const script = (w: World) => {
      for (let i = 0; i < 600; i++) w.step({ ...NO_INPUT, x: Math.sin(i / 30), y: Math.cos(i / 47), run: i % 90 < 30, honk: i === 200 });
    };
    const a = make(), b = make();
    script(a); script(b);
    expect(JSON.stringify([a.player, a.aliens])).toBe(JSON.stringify([b.player, b.aliens]));
    expect(a.player.x / TILE).not.toBeNaN();
  });
});

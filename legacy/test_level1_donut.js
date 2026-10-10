/**
 * Level 1 donut heist test — runs the REAL game.js (not a re-implementation).
 *
 * Loads game.js in a Node VM with a stubbed DOM, then drives the actual sim_update()
 * with keyboard input at the game's fixed 60 Hz timestep.
 *
 * Run: node test_level1_donut.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ---------- Minimal DOM stub ----------
function fakeEl() {
  const el = {
    style: {}, dataset: {}, textContent: '', innerHTML: '', value: '', disabled: false, checked: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute() { return null; }, querySelector() { return fakeEl(); },
    querySelectorAll() { return []; }, getContext() { return null; }, focus() {}, blur() {},
    play() { return Promise.resolve(); }, pause() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; },
  };
  el.children = [];
  return el;
}
const windowStub = {
  __OOPS_TEST__: true,
  addEventListener() {},
  devicePixelRatio: 1,
};
const sandbox = {
  window: windowStub,
  document: { getElementById: () => fakeEl(), querySelector: () => fakeEl(), querySelectorAll: () => [], createElement: () => fakeEl(), addEventListener() {}, body: fakeEl() },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  requestAnimationFrame() {}, performance: { now: () => 0 }, console, Math, setTimeout, clearTimeout, setInterval, clearInterval,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8'), sandbox);
const G = windowStub.__OOPS_TEST__;
if (!G || !G.sim_update) { console.error('Test hook not exposed'); process.exit(1); }

const { state, input, TILE } = G;
const DT = 1 / 60;
const cx = (c) => c * TILE + TILE / 2;
const tileOf = (x) => Math.floor(x / TILE);

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
}

function fresh(alien_warmup_s) {
  state.difficulty = 'MEDIUM';
  G.load_level(0);
  state.game_state = 'PLAY';
  Object.keys(input).forEach(k => { if (typeof input[k] === 'boolean') input[k] = false; });
  // Park the player at the doorway approach (3,8) so other guards are irrelevant
  state.player_x = cx(3); state.player_y = cx(8);
  // Let guard 1 run its patrol for a while so we test many patrol phases
  for (let t = 0; t < alien_warmup_s; t += DT) G.sim_update(DT);
}
function release() { input.up = input.down = input.left = input.right = false; }
function step(n = 1) { for (let i = 0; i < n; i++) G.sim_update(DT); }
const g1 = () => state.aliens[0];

// Move the player one axis at a time to a tile center using real input. Returns false if bonked.
function walkTo(c, r, maxT = 6) {
  const hearts0 = state.hearts;
  const tx = cx(c), ty = cx(r);
  for (let t = 0; t < maxT; t += DT) {
    release();
    const dx = tx - state.player_x, dy = ty - state.player_y;
    if (Math.abs(dx) <= 2.7 && Math.abs(dy) <= 2.7) return true;
    if (Math.abs(dy) > 2.7) { if (dy > 0) input.down = true; else input.up = true; }
    else { if (dx > 0) input.right = true; else input.left = true; }
    step();
    if (state.hearts < hearts0) { release(); return false; }
  }
  release();
  return true;
}
function waitFor(pred, maxT) { for (let t = 0; t < maxT; t += DT) { if (pred()) return t; step(); } return -1; }

// ---------- 1. Map: the only way to the key is through the junction (3,10) ----------
{
  fresh(0);
  const blocked = G.bfs_dist(1, 1, { c: 3, r: 10 });
  check('Key unreachable from start if junction (3,10) is blocked', blocked[10][1] === Infinity);
  const open = G.bfs_dist(1, 1, null);
  check('Key reachable from start normally', open[10][1] < Infinity, `${open[10][1]} steps`);
  check('Walls above pocket at (1,9) and (2,9)', state.grid[9][1] === 'W' && state.grid[9][2] === 'W');
}

// ---------- 2. Without a donut, the player cannot get the key ----------
{
  let got = 0, tries = 0;
  for (let warm = 0; warm < 3; warm += 0.25) {
    fresh(warm); tries++;
    walkTo(3, 9);
    const ok = walkTo(3, 10) && walkTo(1, 10);
    if (ok && state.has_key) got++;
  }
  check('No-donut rush fails at every patrol phase', got === 0, `${got}/${tries} got the key`);
}

// ---------- 3. Donut lands down the hallway, 3 steps away, targeting guard 1 ----------
{
  const spots = new Set();
  let wrongEater = 0;
  for (let warm = 0; warm < 3; warm += 0.25) {
    fresh(warm);
    walkTo(3, 9);
    const L = G.find_donut_landing();
    spots.add(`(${L.c},${L.r})`);
    if (L.eater !== 0) wrongEater++;
  }
  check('Donut from doorway (3,9) always lands at (5,10)', spots.size === 1 && spots.has('(5,10)'), [...spots].join(' '));
  check('Donut always targets guard 1', wrongEater === 0);
}

// ---------- 4. Full heist: throw, wait for guard to pass, grab key, escape ----------
let windows = [];
{
  let success = 0, tries = 0, details = [];
  for (let warm = 0; warm < 3; warm += 0.25) {
    fresh(warm); tries++;
    walkTo(3, 9);
    G.use_gadget(3);
    // Wait until the guard has walked past the junction (or is already eating down the hall)
    const passX = cx(3) + 30;
    waitFor(() => g1().x > passX, 6);
    const tOpen = 0;
    let t = 0;
    const tick = () => { t += DT; };
    const hearts0 = state.hearts;
    const ok = walkTo(3, 10) && walkTo(1, 10) && state.has_key && walkTo(3, 10) && walkTo(3, 9) && walkTo(3, 8);
    // keep watching for 3 more seconds to make sure the returning guard doesn't get us
    step(180);
    const safe = ok && state.hearts === hearts0 && state.has_key;
    if (safe) success++; else details.push(`warm=${warm}`);
  }
  check('Heist succeeds at every patrol phase when executed promptly', success === tries, `${success}/${tries} ${details.join(',')}`);
}

// ---------- 5. Measure the real window (guard clear of junction -> back at junction) ----------
{
  for (let warm = 0; warm < 3; warm += 0.5) {
    fresh(warm);
    walkTo(3, 9);
    G.use_gadget(3);
    const clearX = cx(3) + 28; // bonk distance is 28px
    waitFor(() => g1().x > clearX, 6);
    let t = 0;
    while (t < 8 && !(g1().x <= clearX)) { step(); t += DT; }
    windows.push(t);
  }
  const lo = Math.min(...windows).toFixed(2), hi = Math.max(...windows).toFixed(2);
  check('Window is tense (between 1.6s and 3.0s)', Math.min(...windows) >= 1.6 && Math.max(...windows) <= 3.0, `${lo}s – ${hi}s`);
}

// ---------- 6. Lingering in the pocket gets you caught; key goes back, gate relocks ----------
{
  fresh(1);
  walkTo(3, 9);
  G.use_gadget(3);
  waitFor(() => g1().x > cx(3) + 30, 6);
  const hearts0 = state.hearts;
  walkTo(3, 10); walkTo(1, 10);
  const hadKey = state.has_key;
  waitFor(() => state.hearts < hearts0, 6);
  check('Player who lingers in pocket gets bonked', hadKey && state.hearts === hearts0 - 1);
  check('Key returns to (1,10) and gate relocks after bonk', !state.has_key && !state.gate_open && state.grid[10][1] === 'K');
}

// ---------- 7. After an escape, guard returns to post and resumes patrol ----------
{
  fresh(1);
  walkTo(3, 9);
  G.use_gadget(3);
  waitFor(() => g1().x > cx(3) + 30, 6);
  walkTo(3, 10); walkTo(1, 10); walkTo(3, 10); walkTo(3, 9); walkTo(3, 7);
  const tBack = waitFor(() => !g1().returning && g1().sugar_rush_t <= 0, 8);
  check('Guard returns to post, Sugar Rush ends', tBack >= 0, `after ${tBack.toFixed(2)}s`);
  step(240);
  const c = g1().x / TILE;
  check('Guard is patrolling cols 1.5–3.5 on row 10 again', tileOf(g1().y) === 10 && c >= 1.4 && c <= 3.6, `col ${c.toFixed(2)}`);
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);

// Oops Academy: interactive demos. Each one runs the REAL game rules (src/sim) and draws them with the Mini canvas.
// A demo is a function that builds its UI inside `host` and returns a cleanup function (stops animations, restores
// any settings it changed).
import { CONFIG, DT, KINDS } from '../sim/config';
import { Grid, center, tileOf } from '../sim/grid';
import { T, type TileCode } from '../sim/level';
import { NO_INPUT, World, type Input } from '../sim/world';
import { carefulBot } from '../sim/bot';
import { sound } from '../game/sound';
import { Mini, alien, ascii, keyInput, runWorld } from './mini';

type Cleanup = () => void;
export type Demo = (host: HTMLElement) => Cleanup;

// ---------------------------------------------------------------------------------------------------------------
// little UI helpers
// ---------------------------------------------------------------------------------------------------------------
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
function controls(host: HTMLElement): HTMLDivElement { const d = el('div', 'controls'); host.appendChild(d); return d; }
function button(parent: HTMLElement, label: string, on: () => void): HTMLButtonElement {
  const b = el('button', '', label); b.onclick = on; parent.appendChild(b); return b;
}
function slider(parent: HTMLElement, label: string, min: number, max: number, step: number, value: number, on: (v: number) => void): HTMLInputElement {
  const wrap = el('label', 'slider');
  const out = el('b', '', String(value));
  const s = el('input');
  s.type = 'range'; s.min = String(min); s.max = String(max); s.step = String(step); s.value = String(value);
  s.oninput = () => { out.textContent = s.value; on(Number(s.value)); };
  wrap.append(`${label} `, s, out);
  parent.appendChild(wrap);
  return s;
}
function readout(host: HTMLElement): HTMLDivElement { const d = el('div', 'readout'); host.appendChild(d); return d; }
const yes = (b: boolean) => (b ? '✅' : '❌');
/** Remember a config value and put it back when the demo closes. */
function keep<O extends object, K extends keyof O>(o: O, k: K): () => void { const v = o[k]; return () => { o[k] = v; }; }
const startChase = (w: World, i: number) => (w as unknown as { startChase(a: unknown): void }).startChase(w.aliens[i]);

// ---------------------------------------------------------------------------------------------------------------
// 0. The game loop: same speed at any screen refresh rate
// ---------------------------------------------------------------------------------------------------------------
const gameloop: Demo = host => {
  const lvl = ascii(['##################', '#P..............I#', '##################']);
  const mini = new Mini(host, 18, 3);
  const info = readout(host);
  const ui = controls(host);
  let hz = 60, world = new World(lvl), acc = 0, frames = 0, steps = 0, paused = false, last = performance.now();
  let timer = 0;
  const frame = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && world.status === 'playing') {
      acc += dt;
      while (acc >= DT) { world.step({ ...NO_INPUT, x: 1 }); acc -= DT; steps++; }
    }
    frames++;
    mini.drawWorld(world);
    info.innerHTML = `Screen refresh: <b>${hz}</b> frames/s · frames drawn: <b>${frames}</b> · world steps: <b>${steps}</b>
      · game time: <b>${world.time.toFixed(2)} s</b> · Leo x: <b>${world.player.x.toFixed(1)} px</b>
      · time bank (acc): <b>${(acc * 1000).toFixed(1)} ms</b>${world.status === 'won' ? ' · 🎉 arrived!' : ''}`;
  };
  const restartTimer = () => { clearInterval(timer); timer = window.setInterval(frame, 1000 / hz); };
  const reset = () => { world = new World(lvl); acc = 0; frames = 0; steps = 0; last = performance.now(); };
  for (const h of [15, 30, 60, 120]) button(ui, `${h} Hz screen`, () => { hz = h; reset(); restartTimer(); });
  button(ui, '⏸ Pause / ▶ Play', () => { paused = !paused; last = performance.now(); });
  button(ui, '➡️ One step', () => { world.step({ ...NO_INPUT, x: 1 }); steps++; });
  button(ui, '↺ Reset', reset);
  restartTimer();
  return () => clearInterval(timer);
};

// ---------------------------------------------------------------------------------------------------------------
// 1. Grids & coordinates
// ---------------------------------------------------------------------------------------------------------------
const gridDemo: Demo = host => {
  const lvl = ascii(['##########', '#P...H...#', '#.##.H.~.#', '#....!..I#', '##########']);
  const grid = new Grid(lvl.width, lvl.height, lvl.tiles);
  const mini = new Mini(host, lvl.width, lvl.height);
  const info = readout(host);
  let coords = true, hl: { c: number; r: number } | null = null;
  const names: Record<number, string> = { [T.Floor]: 'Floor', [T.Wall]: 'Wall', [T.Hedge]: 'Hedge', [T.Carpet]: 'Carpet', [T.Squeaky]: 'Squeaky' };
  const draw = () => mini.drawGrid(grid, { coords, highlight: hl });
  mini.canvas.onpointermove = e => {
    const p = mini.worldPos(e), c = tileOf(p.x), r = tileOf(p.y);
    hl = { c, r };
    const t: TileCode = grid.get(c, r);
    info.innerHTML = `Mouse at pixel <b>(${p.x.toFixed(0)}, ${p.y.toFixed(0)})</b> → tile <b>(c=${c}, r=${r})</b>
      because ${p.x.toFixed(0)} ÷ 48 = ${(p.x / 48).toFixed(2)} → ${c}.<br>
      This tile covers x ${c * 48}–${c * 48 + 47}, y ${r * 48}–${r * 48 + 47}. Its centre is (${center(c)}, ${center(r)}).<br>
      In the big list it's index r × width + c = ${r} × ${grid.w} + ${c} = <b>${r * grid.w + c}</b>.
      It's a <b>${names[t] ?? 'tile ' + t}</b> → solid? ${yes(grid.solid(c, r))}`;
    draw();
  };
  const ui = controls(host);
  button(ui, '🔢 Toggle coordinates', () => { coords = !coords; draw(); });
  info.textContent = 'Move the mouse (or your finger) over the map.';
  draw();
  return () => {};
};

// ---------------------------------------------------------------------------------------------------------------
// 2. Moving Leo: speed × time, collision boxes, corner assist
// ---------------------------------------------------------------------------------------------------------------
const movement: Demo = host => {
  const restore = [keep(CONFIG.player, 'walkSpeed'), keep(CONFIG.player, 'cornerAssist')];
  const lvl = ascii(['###############', '#P............#', '#.###.###.###.#', '#.............#', '#####.###.#####', '#.............#', '###############']);
  const mini = new Mini(host, lvl.width, lvl.height);
  const info = readout(host);
  const keys = keyInput(mini.canvas);
  let boxes = true;
  const r = runWorld(() => new World(lvl), w => {
    mini.drawWorld(w, { boxes, cones: false });
    const p = w.player;
    info.innerHTML = `Click the map, then use the arrow keys (Shift = run).<br>
      Leo at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) · moving: ${yes(p.moving)} · speed: <b>${p.running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed} px/s</b>
      → <b>${((p.running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed) / 60).toFixed(2)} px</b> per step.
      The green square is Leo's collision box (28 × 28 px).`;
  }, keys.read);
  const ui = controls(host);
  slider(ui, 'Walk speed', 50, 400, 10, CONFIG.player.walkSpeed, v => { CONFIG.player.walkSpeed = v; });
  slider(ui, 'Corner assist', 0, 0.5, 0.05, CONFIG.player.cornerAssist, v => { CONFIG.player.cornerAssist = v; });
  button(ui, '🟩 Toggle boxes', () => { boxes = !boxes; });
  button(ui, '↺ Reset', () => r.reset());
  return () => { r.stop(); keys.dispose(); restore.forEach(f => f()); };
};

// ---------------------------------------------------------------------------------------------------------------
// 3 + 4. Alien brain: state machine, and vision (drag Leo around)
// ---------------------------------------------------------------------------------------------------------------
const STATES = ['patrol', 'suspicious', 'chase', 'search', 'return', 'investigate'];

function dragLeo(mini: Mini, getWorld: () => World): void {
  let dragging = false;
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const w = getWorld(), p = mini.worldPos(e);
    if (w.grid.canStand(p.x, p.y, CONFIG.player.radius)) { w.player.x = p.x; w.player.y = p.y; }
  };
  mini.canvas.onpointerdown = e => { dragging = true; mini.canvas.setPointerCapture(e.pointerId); move(e); };
  mini.canvas.onpointermove = move;
  mini.canvas.onpointerup = () => { dragging = false; };
}

const states: Demo = host => {
  const lvl = ascii(['##############', '#............#', '#..HH....HH..#', '#............#', '#P...........#', '##############'],
    [alien('stroller', [[3, 1], [10, 1], [10, 3], [3, 3]], { loop: true, speed: 60 })]);
  const mini = new Mini(host, lvl.width, lvl.height);
  const diagram = el('div', 'states');
  host.appendChild(diagram);
  const info = readout(host);
  const r = runWorld(() => { const w = new World(lvl, 'easy'); w.player.invuln = 1e9; return w; }, w => {
    mini.drawWorld(w);
    const a = w.aliens[0];
    diagram.innerHTML = STATES.map(s => `<span class="${a.state === s ? 'on' : ''}">${s}</span>`).join(' → ');
    info.innerHTML = `Drag Leo (the orange one) around. The alien is <b>${a.state}</b> · "?" meter: <b>${(a.sus * 100).toFixed(0)}%</b>
      · eyes point at ${(a.look * 180 / Math.PI).toFixed(0)}°. (Hugs are switched off in this demo.)`;
  });
  dragLeo(mini, () => r.world);
  const ui = controls(host);
  button(ui, '↺ Reset', () => r.reset());
  return () => r.stop();
};

const vision: Demo = host => {
  const restore = [keep(KINDS.lookout, 'vision'), keep(KINDS.lookout, 'half')];
  const lvl = ascii(['##############', '#............#', '#....H.......#', '#............#', '#P...........#', '##############'],
    [alien('lookout', [[7, 3]], { facing: 180, turnEvery: 4 })]);
  const mini = new Mini(host, lvl.width, lvl.height);
  const info = readout(host);
  const r = runWorld(() => { const w = new World(lvl, 'easy'); w.player.invuln = 1e9; return w; }, w => {
    const a = w.aliens[0], p = w.player, k = KINDS[a.kind];
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), range = w.visionRange(a);
    let diff = (Math.atan2(dy, dx) - a.look) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    const inRange = d <= range, inCone = Math.abs(diff) <= (k.half * Math.PI) / 180, los = w.grid.lineOfSight(a, p);
    mini.drawWorld(w, { ray: { x1: a.x, y1: a.y, x2: p.x, y2: p.y, ok: los } });
    info.innerHTML = `Drag Leo. The lookout turns every 4 s.<br>
      1. Close enough? distance ${d.toFixed(0)} px ≤ range ${range.toFixed(0)} px → ${yes(inRange)}<br>
      2. Inside the cone? angle difference ${Math.abs(diff * 180 / Math.PI).toFixed(0)}° ≤ ${k.half}° → ${yes(inCone)}<br>
      3. Clear line of sight (the dashed line)? → ${yes(los)}<br>
      <b>${inRange && inCone && los ? '👀 SEEN! The meter is filling.' : '🙈 Not seen.'}</b>`;
  });
  dragLeo(mini, () => r.world);
  const ui = controls(host);
  slider(ui, 'Vision (tiles)', 1, 10, 0.5, KINDS.lookout.vision, v => { KINDS.lookout.vision = v; });
  slider(ui, 'Half-angle (°)', 5, 90, 5, KINDS.lookout.half, v => { KINDS.lookout.half = v; });
  return () => { r.stop(); restore.forEach(f => f()); };
};

// ---------------------------------------------------------------------------------------------------------------
// 5. Pathfinding: Breadth-First Search distance field
// ---------------------------------------------------------------------------------------------------------------
const pathfinding: Demo = host => {
  const rows = ['############', '#S.........#', '#.####.###.#', '#....#...#.#', '###..###.#.#', '#........#G#', '############'];
  const lvl = ascii(rows.map(r => r.replace(/[SG]/g, '.')));
  const grid = new Grid(lvl.width, lvl.height, lvl.tiles);
  let start = { c: 1, r: 1 }, goal = { c: 10, r: 5 }, mode: 'wall' | 'start' | 'goal' = 'wall', reveal = Infinity;
  const mini = new Mini(host, lvl.width, lvl.height);
  const info = readout(host);
  let anim = 0;
  const draw = () => {
    const field = grid.distField(goal.c, goal.r);
    const shown = field.map(v => (v <= reveal ? v : Infinity)) as Float64Array;
    const path = [{ ...start }];
    let cur: { c: number; r: number } | null = start;
    for (let i = 0; i < 200 && cur && !(cur.c === goal.c && cur.r === goal.r); i++) { cur = grid.stepDown(field, cur.c, cur.r); if (cur) path.push(cur); }
    mini.drawGrid(grid, { numbers: shown, path: reveal === Infinity ? path : [], highlight: start });
    const ctx = mini.ctx; ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🛸', center(goal.c), center(goal.r)); ctx.fillText('🧑‍🚀', center(start.c), center(start.r));
    const d = grid.dist(field, start.c, start.r);
    info.innerHTML = `Numbers = steps from the 🛸 goal (walking around walls). The pink line walks "downhill" from 🧑‍🚀: always onto a
      smaller number. Distance: <b>${isFinite(d) ? d + ' steps' : 'no way through!'}</b>. Mode: <b>${mode}</b>`;
  };
  mini.canvas.onpointerdown = e => {
    const p = mini.worldPos(e), c = tileOf(p.x), r = tileOf(p.y);
    if (c <= 0 || r <= 0 || c >= grid.w - 1 || r >= grid.h - 1) return;
    if (mode === 'wall') grid.set(c, r, grid.get(c, r) === T.Wall ? T.Floor : T.Wall);
    else if (!grid.solid(c, r)) { if (mode === 'start') start = { c, r }; else goal = { c, r }; }
    draw();
  };
  const ui = controls(host);
  button(ui, '🧱 Click = toggle wall', () => { mode = 'wall'; draw(); });
  button(ui, '🧑‍🚀 Click = move start', () => { mode = 'start'; draw(); });
  button(ui, '🛸 Click = move goal', () => { mode = 'goal'; draw(); });
  button(ui, '🌊 Animate the ripple', () => {
    clearInterval(anim); reveal = 0; draw();
    anim = window.setInterval(() => { reveal++; draw(); if (reveal > 60) { reveal = Infinity; clearInterval(anim); draw(); } }, 160);
  });
  draw();
  return () => clearInterval(anim);
};

// ---------------------------------------------------------------------------------------------------------------
// 6. Chases: straight hallway vs zig-zag
// ---------------------------------------------------------------------------------------------------------------
function zigzag(): { rows: string[]; path: [number, number][] } {
  const N = 14, g = Array.from({ length: N }, () => Array(26).fill('#'));
  const path: [number, number][] = [];
  let c = 1, r = 1;
  path.push([c, r]);
  for (let k = 0; k < 40 && path.length < 40; k++) for (let s = 0; s < 2; s++) { if (k % 2 === 0) c++; else r++; if (c < 25 && r < N - 1) path.push([c, r]); }
  for (const [pc, pr] of path) g[pr][pc] = '.';
  return { rows: g.map(x => x.join('')), path };
}

const chase: Demo = host => {
  const restore = [keep(KINDS.stroller, 'chase'), keep(CONFIG.alien, 'untangleTime')];
  const straightRows = ['##########################', '#........................#', '##########################'];
  const straightPath: [number, number][] = Array.from({ length: 24 }, (_, i) => [i + 1, 1]);
  const zz = zigzag();
  const wrap = el('div', 'race'); host.appendChild(wrap);
  const left = el('div'), right = el('div'); wrap.append(left, right);
  left.appendChild(el('h4', '', 'Straight hallway'));
  right.appendChild(el('h4', '', 'Zig-zag'));
  const miniA = new Mini(left, 26, 3, 330), miniB = new Mini(right, 26, 14, 330);
  const info = readout(host);
  const make = (rows: string[], path: [number, number][]) => {
    const w = new World(ascii(rows, [alien('stroller', [path[0]])]));
    w.player.x = center(path[5][0]); w.player.y = center(path[5][1]);
    startChase(w, 0);
    return { w, path, idx: 5, caught: -1 };
  };
  let A = make(straightRows, straightPath), B = make(zz.rows, zz.path), raf = 0, last = performance.now(), acc = 0;
  const steer = (s: typeof A): Input => {
    const [tc, tr] = s.path[Math.min(s.idx + 1, s.path.length - 1)];
    const dx = center(tc) - s.w.player.x, dy = center(tr) - s.w.player.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) s.idx++;
    return { ...NO_INPUT, x: Math.abs(dx) > 1 ? Math.sign(dx) : 0, y: Math.abs(dy) > 1 ? Math.sign(dy) : 0 };
  };
  const tick = (now: number) => {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= DT) {
      for (const s of [A, B]) {
        if (s.caught >= 0 || s.w.time > 9) continue;
        s.w.step(steer(s));
        if (s.w.drainEvents().some(e => e.type === 'hug')) s.caught = s.w.time;
      }
      acc -= DT;
    }
    miniA.drawWorld(A.w); miniB.drawWorld(B.w);
    const gap = (s: typeof A) => Math.hypot(s.w.aliens[0].x - s.w.player.x, s.w.aliens[0].y - s.w.player.y) / 48;
    const say = (s: typeof A) => (s.caught >= 0 ? `💕 caught after ${s.caught.toFixed(1)} s` : s.w.time > 9 ? '🎉 escaped!' : `gap ${gap(s).toFixed(1)} tiles`);
    info.innerHTML = `Leo always WALKS (150 px/s). The alien chases at <b>${KINDS.stroller.chase} px/s</b> and must untangle its legs for
      <b>${CONFIG.alien.untangleTime} s</b> after every skid.<br>Straight: <b>${say(A)}</b> · Zig-zag: <b>${say(B)}</b>`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const ui = controls(host);
  button(ui, '🏁 Race again', () => { A = make(straightRows, straightPath); B = make(zz.rows, zz.path); });
  slider(ui, 'Chase speed', 100, 400, 25, KINDS.stroller.chase, v => { KINDS.stroller.chase = v; });
  slider(ui, 'Untangle time', 0, 1.5, 0.05, CONFIG.alien.untangleTime, v => { CONFIG.alien.untangleTime = v; });
  return () => { cancelAnimationFrame(raf); restore.forEach(f => f()); };
};

// ---------------------------------------------------------------------------------------------------------------
// 7. Noise & gadgets
// ---------------------------------------------------------------------------------------------------------------
const noise: Demo = host => {
  const lvl = ascii(['################', '#..............#', '#.######.#####.#', '#..............#', '#.######.#####.#', '#P.............#', '################'],
    [alien('stroller', [[3, 1]], { facing: 0 }), alien('stroller', [[12, 3]], { facing: 180 }), alien('stroller', [[6, 5]], { facing: 0 })]);
  const mini = new Mini(host, lvl.width, lvl.height);
  const info = readout(host);
  let radius = 3, honkNext = false;
  const rings: { x: number; y: number; r: number; age: number }[] = [];
  const r = runWorld(() => { const w = new World(lvl, 'easy'); w.player.invuln = 1e9; return w; }, (w, dt) => {
    for (const e of w.drainEvents()) if (e.type === 'noise') rings.push({ x: e.x, y: e.y, r: e.radius, age: 0 });
    for (const g of rings) g.age += dt;
    while (rings.length && rings[0].age > 0.8) rings.shift();
    mini.drawWorld(w, { rings });
    info.innerHTML = `Click anywhere to make a noise with a radius of <b>${radius} tiles</b> (it goes through walls!).
      Aliens inside the circle walk over to investigate. Honk stuns aliens within 2 tiles but makes a 7-tile noise.<br>
      ${w.aliens.map((a, i) => `Alien ${i + 1}: <b>${a.state}</b>`).join(' · ')}`;
  }, () => { const h = honkNext; honkNext = false; return { ...NO_INPUT, honk: h }; });
  mini.canvas.onpointerdown = e => { const p = mini.worldPos(e); r.world.noise(p.x, p.y, radius * 48); };
  const ui = controls(host);
  slider(ui, 'Noise radius (tiles)', 1, 10, 1, radius, v => { radius = v; });
  button(ui, '🎺 Honk (from Leo)', () => { r.world.player.cd.honk = 0; honkNext = true; });
  button(ui, '↺ Reset', () => r.reset());
  return () => r.stop();
};

// ---------------------------------------------------------------------------------------------------------------
// 8. Walking with sine waves (backwards legs!)
// ---------------------------------------------------------------------------------------------------------------
const walk: Demo = host => {
  const cv = el('canvas', 'mini'); cv.width = 1200; cv.height = 520; cv.style.width = '600px'; cv.style.height = '260px';
  host.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  const info = readout(host);
  let speed = 8, stride = 7, backwards = true, phase = 0, last = performance.now(), raf = 0;
  const legsAt = (x: number, y: number, face: number, toe: number, color: string) => {
    for (const i of [0, 1]) {
      const ph = phase + i * Math.PI;
      const hipX = x + (i ? 3 : -3), hipY = y - 13;
      const footX = x + toe * Math.sin(ph) * stride + (i ? 2 : -2), footY = y - Math.max(0, Math.cos(ph)) * 4;
      const kneeX = (hipX + footX) / 2 + toe * 4, kneeY = (hipY + footY) / 2;
      ctx.strokeStyle = i ? color : '#88779a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
      ctx.fillStyle = '#2a1f45'; ctx.beginPath(); ctx.ellipse(footX + toe * 3, footY, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y - 25, 14, 13, 0, 0, Math.PI * 2); ctx.fill();
    for (const d of [-4.5, 4.5]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + face * 5 + d, y - 29, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1f45'; ctx.beginPath(); ctx.arc(x + face * 6.5 + d, y - 29, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  };
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    phase += dt * speed;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, 600, 260);
    ctx.save(); ctx.translate(0, 0); ctx.scale(2, 2);
    legsAt(70, 100, -1, backwards ? 1 : -1, '#37c8b4');
    legsAt(190, 100, 1, 1, '#ff7a2f');
    ctx.restore();
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#2a1f45'; ctx.textAlign = 'center';
    ctx.fillText('Local (face ←, toes →)', 140, 230); ctx.fillText('Leo (face → toes →)', 380, 230);
    // sine plot
    const ox = 420, oy = 60, w = 170, h = 40;
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + w, oy); ctx.stroke();
    for (const [i, col] of [[0, '#88779a'], [1, '#37c8b4']] as const) {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= w; k++) { const ph = phase - (w - k) / 25 + i * Math.PI; const y = oy - Math.sin(ph) * h; k ? ctx.lineTo(ox + k, y) : ctx.moveTo(ox + k, y); }
      ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ox + w, oy - Math.sin(phase + i * Math.PI) * h, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#2a1f45'; ctx.font = '12px sans-serif'; ctx.fillText('sin(phase) for each leg', ox + w / 2, oy + h + 20);
    info.innerHTML = `phase = <b>${(phase % (Math.PI * 2)).toFixed(2)}</b> · leg 1 foot: sin = <b>${Math.sin(phase).toFixed(2)}</b>
      · leg 2 foot: sin(phase + π) = <b>${Math.sin(phase + Math.PI).toFixed(2)}</b> (always the opposite!)`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const ui = controls(host);
  slider(ui, 'Walk speed', 0, 30, 1, speed, v => { speed = v; });
  slider(ui, 'Stride', 0, 16, 1, stride, v => { stride = v; });
  button(ui, '🔁 Toggle backwards legs', () => { backwards = !backwards; });
  return () => cancelAnimationFrame(raf);
};

// ---------------------------------------------------------------------------------------------------------------
// 9. Juice & sound
// ---------------------------------------------------------------------------------------------------------------
const juice: Demo = host => {
  const ui = controls(host);
  const sounds: [string, () => void][] = [
    ['🎺 honk', () => sound.honk()], ['💕 hug', () => sound.hug()], ['💨 skid', () => sound.skid()], ['❗ spotted', () => sound.spotted()],
    ['🗝️ pickup', () => sound.pickup()], ['🎉 win', () => sound.win()], ['🚨 alarm', () => sound.alarm()], ['👽 voice', () => sound.voice(1)],
  ];
  for (const [label, play] of sounds) button(ui, label, () => { sound.unlock(); play(); });
  const cv = el('canvas', 'mini'); cv.width = 1200; cv.height = 500; cv.style.width = '600px'; cv.style.height = '250px';
  host.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  const info = readout(host);
  let gravity = 260, raf = 0, last = performance.now();
  const parts: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
  const colors = ['#ff6eb4', '#ffd23c', '#4ad6ff', '#4ae07a', '#ff8c3c'];
  cv.onpointerdown = e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (600 / r.width), y = (e.clientY - r.top) * (250 / r.height);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 200;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 200, life: 1 + Math.random() * 0.8, color: colors[i % colors.length] });
    }
  };
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (const p of parts) { p.vy += gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = '#efe4ff'; ctx.fillRect(0, 0, 600, 250);
    for (const p of parts) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a1f45'; ctx.font = '14px sans-serif'; ctx.fillText('Click / tap here for confetti!', 12, 20);
    info.innerHTML = `Particles alive: <b>${parts.length}</b>. Each frame: vy += gravity × dt, then x += vx × dt, y += vy × dt.`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  slider(controls(host), 'Gravity', -200, 800, 20, gravity, v => { gravity = v; });
  return () => cancelAnimationFrame(raf);
};

// ---------------------------------------------------------------------------------------------------------------
// 10. Bots that imagine the future
// ---------------------------------------------------------------------------------------------------------------
const botDemo: Demo = host => {
  const lvl = ascii(['################', '#P.............#', '#.####.##.####.#', '#..............#', '#.####.##.####.#', '#.............I#', '################'],
    [alien('stroller', [[4, 3], [12, 3]], { speed: 70 }), alien('lookout', [[7, 1]], { facing: 0, turnEvery: 2.5 })]);
  const mini = new Mini(host, lvl.width, lvl.height);
  const info = readout(host);
  let world = new World(lvl), ghosts: { pts: { x: number; y: number }[]; color: string }[] = [], choice = 'wait', raf = 0, last = performance.now(), acc = 0, decideT = 0;
  const goal = { c: 14, r: 5 };
  const toward = (w: World): Input => {
    const g = w.grid, field = g.distField(goal.c, goal.r);
    const n = g.stepDown(field, tileOf(w.player.x), tileOf(w.player.y));
    if (!n) return NO_INPUT;
    const dx = center(n.c) - w.player.x, dy = center(n.r) - w.player.y;
    return { ...NO_INPUT, x: Math.abs(dx) > 2 ? Math.sign(dx) : 0, y: Math.abs(dy) > 2 ? Math.sign(dy) : 0 };
  };
  const options: [string, (w: World) => Input][] = [
    ['walk', toward], ['wait', () => NO_INPUT],
    ['dodge ↑', () => ({ ...NO_INPUT, y: -1 })], ['dodge ↓', () => ({ ...NO_INPUT, y: 1 })],
    ['dodge ←', () => ({ ...NO_INPUT, x: -1 })], ['dodge →', () => ({ ...NO_INPUT, x: 1 })],
  ];
  const decide = () => {
    ghosts = [];
    let picked: string | null = null;
    for (const [name, pol] of options) {
      const sim = world.clone(), pts = [{ x: sim.player.x, y: sim.player.y }];
      let bad = false;
      for (let i = 0; i < 96 && !bad; i++) {
        sim.step(pol(sim));
        if (i % 6 === 0) pts.push({ x: sim.player.x, y: sim.player.y });
        bad = sim.drainEvents().some(e => e.type === 'hug' || e.type === 'spotted');
      }
      ghosts.push({ pts, color: bad ? 'rgba(224,48,74,0.8)' : 'rgba(45,184,77,0.8)' });
      if (!bad && !picked) picked = name;
    }
    choice = picked ?? 'wait';
  };
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    acc += dt; decideT -= dt;
    if (decideT <= 0 && world.status === 'playing') { decide(); decideT = 0.3; }
    const pol = options.find(o => o[0] === choice)![1];
    while (acc >= DT) { if (world.status === 'playing') world.step(pol(world)); world.drainEvents(); acc -= DT; }
    mini.drawWorld(world, { ghosts });
    info.innerHTML = `Every 0.3 s the bot COPIES the world and imagines 1.6 s of each move (dashed lines).
      <span style="color:#2db84d">Green</span> = safe, <span style="color:#e0304a">red</span> = spotted or hugged in the imagined future.
      It picks the first green one in this order: walk, wait, dodges. Now: <b>${choice}</b>${world.status === 'won' ? ' · 🎉 made it!' : ''}`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const ui = controls(host);
  button(ui, '↺ Restart', () => { world = new World(lvl); ghosts = []; });
  return () => cancelAnimationFrame(raf);
};

// ---------------------------------------------------------------------------------------------------------------
// 11. Make your own level
// ---------------------------------------------------------------------------------------------------------------
const START_LEVEL = [
  '##############',
  '#P....#.....I#',
  '#.##..#.##...#',
  '#..A......O..#',
  '#.##..K.##...#',
  '#......#.....#',
  '##############',
].join('\n');

function parseMine(text: string) {
  const rows = text.split('\n').map(r => r.trimEnd()).filter(r => r.length);
  const aliens: ReturnType<typeof alien>[] = [];
  const w = Math.max(...rows.map(r => r.length));
  const clean = rows.map((row, r) => [...row.padEnd(w, '#')].map((ch, c) => {
    if (ch === 'A' || ch === 'V') { // patrol left-right (A) or up-down (V) as far as the corridor goes
      const dc = ch === 'A' ? 1 : 0, dr = ch === 'V' ? 1 : 0;
      const open = (cc: number, rr: number) => rows[rr]?.[cc] !== undefined && rows[rr][cc] !== '#' && rows[rr][cc] !== 'H';
      let c1 = c, r1 = r, c2 = c, r2 = r;
      while (open(c1 - dc, r1 - dr)) { c1 -= dc; r1 -= dr; }
      while (open(c2 + dc, r2 + dr)) { c2 += dc; r2 += dr; }
      aliens.push(alien('stroller', [[c1, r1], [c2, r2]]));
      return '.';
    }
    if (ch === 'O') { aliens.push(alien('lookout', [[c, r]], { facing: 0, turnEvery: 3 })); return '.'; }
    if (ch === 'B') { aliens.push(alien('hugger', [[c, r]], { facing: 180 })); return '.'; }
    return ch;
  }).join(''));
  return ascii(clean, aliens);
}

const editor: Demo = host => {
  const ta = el('textarea', 'level-text'); ta.value = START_LEVEL; ta.rows = 9; ta.spellcheck = false;
  host.appendChild(ta);
  host.appendChild(el('p', 'small', `Legend: <code>#</code> wall <code>.</code> floor <code>H</code> hedge <code>G</code> gate <code>K</code> key
    <code>I</code> ship part <code>P</code> Leo <code>A</code> alien patrolling ↔ <code>V</code> alien patrolling ↕ <code>O</code> lookout
    <code>B</code> sleeping Blorp <code>~</code> carpet <code>!</code> squeaky`));
  const stage = el('div'); host.appendChild(stage);
  const info = readout(host);
  let runner: ReturnType<typeof runWorld> | null = null, keys: ReturnType<typeof keyInput> | null = null;
  const stop = () => { runner?.stop(); keys?.dispose(); stage.innerHTML = ''; };
  const play = () => {
    stop();
    try {
      const lvl = parseMine(ta.value);
      if (!lvl.items.length) throw new Error('Add at least one ship part: I');
      const mini = new Mini(stage, lvl.width, lvl.height);
      keys = keyInput(mini.canvas);
      runner = runWorld(() => new World(lvl, 'easy'), w => {
        mini.drawWorld(w);
        info.innerHTML = w.status === 'won' ? '🎉 You beat your own level!' : w.status === 'lost' ? '💕 Hugged too many times. Press Play to retry.'
          : `Click the map and use the arrow keys. Hearts: ${'❤️'.repeat(w.player.hearts)}`;
      }, keys.read);
      mini.canvas.focus();
    } catch (e) { info.textContent = `⚠️ ${(e as Error).message}`; }
  };
  const ui = controls(host);
  button(ui, '▶ Play my level', play);
  button(ui, '🤖 Can a robot beat it?', () => {
    try {
      const lvl = parseMine(ta.value);
      info.textContent = '🤖 Thinking...';
      setTimeout(() => {
        const r = carefulBot(lvl, { difficulty: 'normal', maxTime: 90 });
        info.innerHTML = r.won ? `🤖 Yes! The careful robot won in <b>${r.time} s</b>, chased ${r.chased}×. Your level is fair.`
          : `🤖 The careful robot couldn't finish in 90 s (it got stuck near ${r.where}). Maybe a little too hard, or impossible?`;
      }, 30);
    } catch (e) { info.textContent = `⚠️ ${(e as Error).message}`; }
  });
  button(ui, '↺ Example level', () => { ta.value = START_LEVEL; });
  play();
  return stop;
};

export const DEMOS: Record<string, Demo> = {
  gameloop, grid: gridDemo, movement, states, vision, pathfinding, chase, noise, walk, juice, bot: botDemo, editor,
};

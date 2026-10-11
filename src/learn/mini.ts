// Oops Academy: a tiny canvas renderer + helpers so demos can run the REAL game rules (World, Grid) and draw them
// simply. (The real game uses Phaser; here we use the browser's plain 2D canvas so each demo is small.)
import { CONFIG, KINDS, TILE } from '../sim/config';
import { Grid, center } from '../sim/grid';
import { T, emptyLevel, type AlienKind, type AlienSpec, type LevelData, type TileCode } from '../sim/level';
import { NO_INPUT, World, type Alien, type Input } from '../sim/world';

// ---------------------------------------------------------------------------------------------------------------
// Levels from text pictures (same legend as tools/draft-level.mjs)
// ---------------------------------------------------------------------------------------------------------------
const CHARS: Record<string, TileCode> = {
  '#': T.Wall, '.': T.Floor, H: T.Hedge, G: T.Gate, '~': T.Carpet, '!': T.Squeaky,
  P: T.Floor, K: T.Floor, I: T.Floor, C: T.Floor, X: T.Floor,
};

export function ascii(rows: string[], aliens: AlienSpec[] = []): LevelData {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const lvl = { ...emptyLevel(w, h), name: 'demo', aliens };
  const tiles: TileCode[] = [];
  rows.forEach((row, r) => [...row.padEnd(w, '#')].forEach((ch, c) => {
    tiles.push(CHARS[ch] ?? T.Wall);
    const pos = { x: center(c), y: center(r) };
    if (ch === 'P') lvl.start = pos;
    if (ch === 'K') lvl.keys.push(pos);
    if (ch === 'I') lvl.items.push(pos);
    if (ch === 'C') lvl.checkpoints.push(pos);
    if (ch === 'X') lvl.socks.push(pos);
  }));
  lvl.tiles = tiles;
  return lvl;
}

export function alien(kind: AlienKind, route: [number, number][], opts: Partial<AlienSpec> = {}): AlienSpec {
  const pts = route.map(([c, r]) => ({ x: center(c), y: center(r) }));
  return { kind, x: pts[0].x, y: pts[0].y, route: pts.length > 1 ? pts : [], loop: false, ...opts };
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------------------------
const KIND_COLOR: Record<AlienKind, string> = {
  stroller: '#37c8b4', lookout: '#ff8c3c', hugger: '#ff6eb4', kid: '#ffd23c', heavy: '#9b6bd6', scooter: '#4ad6ff', drone: '#b8c4d6',
};
const TILE_COLOR: Partial<Record<TileCode, string>> = {
  [T.Floor]: '#e4daf9', [T.Wall]: '#4a346e', [T.Hedge]: '#3a9654', [T.Gate]: '#ffa028', [T.Carpet]: '#c43c54',
  [T.Squeaky]: '#ffe65a', [T.Empty]: '#2a1f45',
};

export interface DrawOpts {
  cones?: boolean;
  boxes?: boolean;          // collision boxes
  coords?: boolean;         // tile coordinates
  numbers?: Float64Array;   // a distance field to print on tiles
  path?: { c: number; r: number }[];
  highlight?: { c: number; r: number } | null;
  rings?: { x: number; y: number; r: number; age: number }[];
  ghosts?: { pts: { x: number; y: number }[]; color: string }[];
  ray?: { x1: number; y1: number; x2: number; y2: number; ok: boolean } | null;
}

/** A canvas that draws a World (or just a Grid) scaled to fit. */
export class Mini {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  scale = 1; // canvas px per world px

  constructor(host: HTMLElement, cols: number, rows: number, maxWidth = 640) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mini';
    this.canvas.tabIndex = 0;
    const cell = Math.min(48, Math.floor(maxWidth / cols));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = cols * cell * dpr;
    this.canvas.height = rows * cell * dpr;
    this.canvas.style.width = `${cols * cell}px`;
    this.canvas.style.height = `${rows * cell}px`;
    this.ctx = this.canvas.getContext('2d')!;
    this.scale = (cell * dpr) / TILE;
    host.appendChild(this.canvas);
  }

  /** Mouse/touch position in WORLD pixels. */
  worldPos(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const k = this.canvas.width / r.width / this.scale;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  }

  drawGrid(grid: Grid, o: DrawOpts = {}): void {
    const c = this.ctx, s = this.scale;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(s, 0, 0, s, 0, 0);
    for (let r = 0; r < grid.h; r++) for (let col = 0; col < grid.w; col++) {
      const t = grid.get(col, r);
      c.fillStyle = TILE_COLOR[t] ?? '#e4daf9';
      c.fillRect(col * TILE, r * TILE, TILE, TILE);
      c.strokeStyle = 'rgba(42,31,69,0.12)';
      c.lineWidth = 1 / s;
      c.strokeRect(col * TILE, r * TILE, TILE, TILE);
      if (t === T.Hedge) { c.fillStyle = '#5cbf74'; c.beginPath(); c.arc(col * TILE + 24, r * TILE + 24, 16, 0, Math.PI * 2); c.fill(); }
    }
    if (o.highlight) {
      c.strokeStyle = '#ff6eb4'; c.lineWidth = 4;
      c.strokeRect(o.highlight.c * TILE + 2, o.highlight.r * TILE + 2, TILE - 4, TILE - 4);
    }
    if (o.numbers) {
      c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let r = 0; r < grid.h; r++) for (let col = 0; col < grid.w; col++) {
        const d = o.numbers[r * grid.w + col];
        if (!isFinite(d)) continue;
        c.fillStyle = `hsl(${280 - Math.min(d, 30) * 8}, 70%, 45%)`;
        c.fillText(String(d), col * TILE + 24, r * TILE + 25);
      }
    }
    if (o.path && o.path.length > 1) {
      c.strokeStyle = 'rgba(255,110,180,0.55)'; c.lineWidth = 6; c.lineJoin = 'round'; c.beginPath();
      o.path.forEach((p, i) => (i ? c.lineTo(center(p.c), center(p.r)) : c.moveTo(center(p.c), center(p.r))));
      c.stroke();
    }
    if (o.coords) {
      c.font = '10px sans-serif'; c.fillStyle = 'rgba(42,31,69,0.5)'; c.textAlign = 'left'; c.textBaseline = 'top';
      for (let r = 0; r < grid.h; r++) for (let col = 0; col < grid.w; col++) c.fillText(`${col},${r}`, col * TILE + 3, r * TILE + 3);
    }
  }

  drawWorld(w: World, o: DrawOpts = {}): void {
    this.drawGrid(w.grid, o);
    const c = this.ctx;
    for (const k of w.keys) if (!k.taken) this.emoji('🗝️', k.x, k.y, 26);
    for (const it of w.items) if (!it.taken) this.emoji('⚡', it.x, it.y, 28);
    for (const sk of w.socks) if (!sk.taken) this.emoji('🧦', sk.x, sk.y, 24);
    for (const cp of w.checkpoints) this.emoji('🚩', cp.x, cp.y, 24);
    if (w.donut) this.emoji('🍩', w.donut.x, w.donut.y, 24);
    if (o.cones !== false) for (const a of w.aliens) this.cone(w, a);
    for (const g of o.ghosts ?? []) {
      c.strokeStyle = g.color; c.lineWidth = 4; c.setLineDash([6, 6]); c.beginPath();
      g.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke(); c.setLineDash([]);
    }
    if (o.ray) {
      c.strokeStyle = o.ray.ok ? '#2db84d' : '#e0304a'; c.lineWidth = 3; c.setLineDash([8, 5]);
      c.beginPath(); c.moveTo(o.ray.x1, o.ray.y1); c.lineTo(o.ray.x2, o.ray.y2); c.stroke(); c.setLineDash([]);
    }
    for (const r of o.rings ?? []) {
      c.strokeStyle = `rgba(42,31,69,${0.6 * (1 - r.age / 0.8)})`; c.lineWidth = 3;
      c.beginPath(); c.arc(r.x, r.y, r.r * Math.min(1, 0.3 + r.age), 0, Math.PI * 2); c.stroke();
    }
    for (const a of w.aliens) this.alien(a, o.boxes ?? false);
    this.leo(w, o.boxes ?? false);
  }

  private emoji(e: string, x: number, y: number, size: number): void {
    const c = this.ctx;
    c.font = `${size}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(e, x, y);
  }

  /** The vision cone, stopped by walls (same idea as conePoints in src/game/draw.ts). */
  cone(w: World, a: Alien): void {
    const k = KINDS[a.kind], range = w.visionRange(a);
    if (range <= 0 || !['patrol', 'suspicious', 'search', 'investigate', 'return'].includes(a.state)) return;
    const half = (k.half * Math.PI) / 180, c = this.ctx;
    c.beginPath(); c.moveTo(a.x, a.y);
    for (let i = 0; i <= 24; i++) {
      const ang = a.look - half + (2 * half * i) / 24, dx = Math.cos(ang), dy = Math.sin(ang);
      let d = 0;
      while (d < range) { const nd = Math.min(range, d + 6); if (w.grid.solid(Math.floor((a.x + dx * nd) / TILE), Math.floor((a.y + dy * nd) / TILE))) break; d = nd; }
      c.lineTo(a.x + dx * d, a.y + dy * d);
    }
    c.closePath();
    c.fillStyle = a.sus > 0 ? `rgba(255,${Math.round(200 - 150 * a.sus)},40,0.45)` : 'rgba(255,230,90,0.35)';
    c.fill();
  }

  alien(a: Alien, box: boolean): void {
    const c = this.ctx, R = KINDS[a.kind].radius;
    // feet: on the side it's walking towards (backwards legs!)
    const fx = a.heading.x || Math.cos(a.look + Math.PI), fy = a.heading.y || Math.sin(a.look + Math.PI);
    c.fillStyle = '#2a1f45';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(a.x + fx * R * 0.9 - fy * s * 7, a.y + fy * R * 0.9 + fx * s * 7, 5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = KIND_COLOR[a.kind];
    c.beginPath(); c.arc(a.x, a.y, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2a1f45'; c.lineWidth = 2; c.stroke();
    // eyes: on the side it's LOOKING at
    const lx = Math.cos(a.look), ly = Math.sin(a.look);
    for (const s of [-1, 1]) {
      const ex = a.x + lx * R * 0.45 - ly * s * 6, ey = a.y + ly * R * 0.45 + lx * s * 6;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a1f45'; c.beginPath(); c.arc(ex + lx * 2, ey + ly * 2, 2.5, 0, Math.PI * 2); c.fill();
    }
    const label = a.state === 'chase' ? '!' : a.state === 'suspicious' ? '?' : a.state === 'sleep' ? 'z' : a.state === 'eating' ? '🍩' : a.state === 'stunned' ? '✨' : '';
    if (label) { c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillStyle = a.state === 'chase' ? '#e0304a' : '#c08a00'; c.fillText(label, a.x, a.y - R - 14); }
    if (a.sus > 0) {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(a.x - 18, a.y - R - 10, 36, 6);
      c.fillStyle = '#ffd23c'; c.fillRect(a.x - 18, a.y - R - 10, 36 * Math.min(1, a.sus), 6);
    }
    if (box) { c.strokeStyle = '#e0304a'; c.lineWidth = 2; c.beginPath(); c.arc(a.x, a.y, R, 0, Math.PI * 2); c.stroke(); }
  }

  leo(w: World, box: boolean): void {
    const p = w.player, c = this.ctx, R = CONFIG.player.radius;
    if (p.invuln > 0 && p.invuln < 100 && Math.floor(performance.now() / 80) % 2 === 0) return; // demos use a huge invuln to switch hugs off
    c.fillStyle = w.hug ? '#ff9ec7' : '#ff7a2f';
    c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#bfe9ff'; c.beginPath(); c.arc(p.x, p.y - 3, R * 0.65, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd2a8'; c.beginPath(); c.arc(p.x, p.y - 3, R * 0.4, 0, Math.PI * 2); c.fill();
    if (box) { c.strokeStyle = '#2db84d'; c.lineWidth = 2; c.strokeRect(p.x - R, p.y - R, R * 2, R * 2); }
    if (w.hug) { c.font = '22px sans-serif'; c.textAlign = 'center'; c.fillText('💕', p.x, p.y - 26); }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Running a world in real time, with the same fixed-step game loop as the real game
// ---------------------------------------------------------------------------------------------------------------
export interface Runner { stop(): void; world: World; reset(): void }

export function runWorld(make: () => World, frame: (w: World, dt: number) => void, input: () => Input = () => NO_INPUT): Runner {
  let world = make(), acc = 0, last = performance.now(), raf = 0, running = true;
  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= 1 / 60) { world.step(input()); acc -= 1 / 60; }
    frame(world, dt);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    get world() { return world; },
    stop: () => { running = false; cancelAnimationFrame(raf); },
    reset: () => { world = make(); acc = 0; },
  } as Runner;
}

/** Arrow keys / WASD + Shift while `el` has focus → an Input. */
export function keyInput(el: HTMLElement): { read: () => Input; dispose: () => void } {
  const held = new Set<string>();
  const queued = new Set<string>();
  const down = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) queued.add(e.code);
    held.add(e.code);
  };
  const up = (e: KeyboardEvent) => held.delete(e.code);
  el.addEventListener('keydown', down);
  el.addEventListener('keyup', up);
  el.addEventListener('blur', () => held.clear());
  return {
    read: () => {
      const has = (...k: string[]) => k.some(x => held.has(x));
      const input: Input = {
        x: (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0),
        y: (has('ArrowDown', 'KeyS') ? 1 : 0) - (has('ArrowUp', 'KeyW') ? 1 : 0),
        run: has('ShiftLeft', 'ShiftRight'),
        honk: queued.has('Digit1'), moonwalk: queued.has('Digit2'), donut: queued.has('Digit3'),
      };
      queued.clear();
      return input;
    },
    dispose: () => { el.removeEventListener('keydown', down); el.removeEventListener('keyup', up); },
  };
}

export { NO_INPUT, World, Grid, TILE };

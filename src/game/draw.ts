// Procedural drawing of tiles and characters with Phaser Graphics. Render-only: never changes the sim.
import Phaser from 'phaser';
import { CONFIG, KINDS, TILE } from '../sim/config';
import type { Grid } from '../sim/grid';
import { CONVEYOR_DIR, T, isConveyor } from '../sim/level';
import type { Alien, Lever, Terminal, World } from '../sim/world';
import { alienHeight } from './art/characters';
import { drawThemedGround, type ZoneTheme } from './art/themes';

type G = Phaser.GameObjects.Graphics;
const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export const COLORS = {
  bg: 0x2a1f45,
  floor: 0xd6c8f5, floorDot: 0xc4b2ec,
  wall: 0x4a346e, wallTop: 0x6a4c96, wallEdge: 0x2f2147,
  hedge: 0x3a9654, hedgeDark: 0x26763e, hedgeLight: 0x5cbf74,
  gate: 0xffa028, gateBar: 0x8c460a,
  carpet: 0xc43c54, carpetEdge: 0xe06074,
  squeaky: 0xffe65a, squeakyDark: 0xe6be28,
  belt: 0x7a8296, beltDark: 0x5a6070, arrow: 0xfff07a,
  shield: 0x50a0ff,
};

/** Static ground: zone-themed floors/walls/obstacles, then gates, carpets, squeaky floors and shields on top.
 *  Tiles that change every frame (belts, plates, lasers) are drawn by drawDynamicTiles instead. */
export function drawGround(g: G, grid: Grid, theme: ZoneTheme = 'suburbia'): void {
  drawThemedGround(g, grid, theme);
  for (let r = 0; r < grid.h; r++) for (let c = 0; c < grid.w; c++) {
    const t = grid.get(c, r), x = c * TILE, y = r * TILE;
    switch (t) {
      case T.Gate:
        g.fillStyle(COLORS.gateBar).fillRect(x, y + 6, TILE, 6).fillRect(x, y + TILE - 12, TILE, 6);
        g.fillStyle(COLORS.gate);
        for (let i = 0; i < 4; i++) g.fillRect(x + 4 + i * 11, y + 2, 6, TILE - 4);
        g.fillStyle(0xffe08a).fillCircle(x + 24, y + 24, 6);
        g.fillStyle(COLORS.gateBar).fillCircle(x + 24, y + 23, 2).fillRect(x + 23, y + 23, 2, 5);
        break;
      case T.Carpet:
        g.fillStyle(COLORS.carpet).fillRect(x, y + 2, TILE, TILE - 4);
        g.fillStyle(COLORS.carpetEdge).fillRect(x, y + 6, TILE, 2).fillRect(x, y + TILE - 8, TILE, 2);
        break;
      case T.Squeaky:
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          g.fillStyle((i + j) % 2 ? COLORS.squeakyDark : COLORS.squeaky).fillRect(x + i * 12, y + j * 12, 12, 12);
        }
        break;
      case T.Shield:
        g.fillStyle(COLORS.shield, 0.55).fillRect(x, y, TILE, TILE);
        g.lineStyle(2, 0xd0e8ff, 0.9);
        for (let i = 0; i < 3; i++) g.strokeRect(x + 4 + i * 6, y + 4 + i * 6, TILE - 8 - i * 12, TILE - 8 - i * 12);
        break;
    }
  }
}

export function dynamicTiles(grid: Grid): number[] {
  const out: number[] = [];
  grid.tiles.forEach((t, i) => { if (isConveyor(t) || t === T.Plate || t === T.Laser) out.push(i); });
  return out;
}

export function drawDynamicTiles(g: G, w: World, list: number[], t: number): void {
  const grid = w.grid;
  for (const i of list) {
    const c = i % grid.w, r = (i - c) / grid.w, x = c * TILE, y = r * TILE, tile = grid.tiles[i];
    if (isConveyor(tile)) {
      const [dx, dy] = CONVEYOR_DIR[tile];
      g.fillStyle(COLORS.belt).fillRect(x, y, TILE, TILE);
      g.fillStyle(COLORS.beltDark).fillRect(x + (dy ? 0 : 0), y, dy ? 4 : TILE, dy ? TILE : 4).fillRect(dy ? x + TILE - 4 : x, dy ? y : y + TILE - 4, dy ? 4 : TILE, dy ? TILE : 4);
      const shift = ((t * CONFIG.player.conveyorSpeed) % 24) - 12;
      for (const k of [-1, 0, 1]) {
        const ox = x + 24 + dx * (shift + k * 24), oy = y + 24 + dy * (shift + k * 24);
        if (ox < x + 4 || ox > x + TILE - 4 || oy < y + 4 || oy > y + TILE - 4) continue;
        const px = -dy, py = dx;
        g.fillStyle(COLORS.arrow, 0.9).fillTriangle(ox + dx * 7, oy + dy * 7, ox - dx * 5 + px * 7, oy - dy * 5 + py * 7, ox - dx * 5 - px * 7, oy - dy * 5 - py * 7);
      }
    } else if (tile === T.Plate) {
      const held = grid.lasersOpen;
      g.fillStyle(0x555577).fillCircle(x + 24, y + 26, 17);
      g.fillStyle(held ? 0x4ae07a : 0x5ac8ff).fillCircle(x + 24, y + (held ? 26 : 23), 15);
      g.lineStyle(2, 0xffffff, 0.6).strokeCircle(x + 24, y + (held ? 26 : 23), 15);
    } else if (tile === T.Laser) {
      g.fillStyle(0x333344).fillRect(x + 2, y + 2, 8, TILE - 4).fillRect(x + TILE - 10, y + 2, 8, TILE - 4);
      if (!grid.lasersOpen) {
        const flick = 0.75 + 0.25 * Math.sin(t * 30 + c);
        g.fillStyle(0xff2850, 0.35 * flick).fillRect(x + 8, y + 4, TILE - 16, TILE - 8);
        g.lineStyle(3, 0xff5070, flick);
        for (let k = 0; k < 4; k++) g.lineBetween(x + 10, y + 9 + k * 10, x + TILE - 10, y + 9 + k * 10);
      }
    }
  }
}

/** Visibility polygon of a cone, stopped by walls. */
export function conePoints(grid: Grid, x: number, y: number, look: number, range: number, half: number): Phaser.Math.Vector2[] {
  const pts = [V(x, y)];
  const rays = 28;
  for (let i = 0; i <= rays; i++) {
    const a = look - half + (2 * half * i) / rays;
    const dx = Math.cos(a), dy = Math.sin(a);
    let d = 0;
    while (d < range) {
      const nd = Math.min(range, d + 6);
      if (grid.solid(Math.floor((x + dx * nd) / TILE), Math.floor((y + dy * nd) / TILE))) break;
      d = nd;
    }
    pts.push(V(x + dx * d, y + dy * d));
  }
  return pts;
}

export function drawCone(g: G, w: World, a: Alien): void {
  const k = KINDS[a.kind];
  if (k.vision <= 0) return;
  const awake = a.kind === 'drone' ? a.state === 'patrol' : ['patrol', 'suspicious', 'search', 'investigate', 'return'].includes(a.state);
  if (!awake) return;
  const base = a.kind === 'drone' ? 0x8ad8ff : 0xfff07a;
  const color = a.sus > 0 ? Phaser.Display.Color.GetColor(255, Math.round(200 - 150 * a.sus), 40) : base;
  const alpha = a.sus > 0 ? 0.4 + 0.2 * a.sus : 0.34;
  const pts = conePoints(w.grid, a.x, a.y, a.look, w.visionRange(a), (k.half * Math.PI) / 180);
  g.fillStyle(color, alpha).fillPoints(pts, true);
  g.lineStyle(2, color, 0.8).strokePoints(pts, true);
}

export function drawKey(g: G, x: number, y: number, t: number): void {
  const b = Math.sin(t * 4) * 3;
  g.fillStyle(0x000000, 0.15).fillEllipse(x, y + 12, 20, 6);
  g.fillStyle(0xffd23c).fillCircle(x - 7, y + b, 7).fillRect(x - 2, y - 2 + b, 16, 4).fillRect(x + 8, y + 2 + b, 3, 6).fillRect(x + 12, y + 2 + b, 3, 4);
  g.fillStyle(COLORS.floor).fillCircle(x - 7, y + b, 3);
}

export function drawItem(g: G, x: number, y: number, t: number): void {
  const b = Math.sin(t * 3) * 4, glow = 0.25 + 0.15 * Math.sin(t * 5);
  g.fillStyle(0xfff27a, glow).fillCircle(x, y + b, 20);
  g.fillStyle(0xffe14a).fillPoints([
    V(x + 3, y - 15 + b), V(x - 8, y + 2 + b), V(x - 1, y + 2 + b), V(x - 4, y + 15 + b), V(x + 8, y - 3 + b), V(x + 1, y - 3 + b),
  ], true);
  g.lineStyle(2, 0xc08a00).strokeCircle(x, y + b, 20);
}

export function drawCheckpoint(g: G, x: number, y: number, active: boolean, t: number): void {
  g.fillStyle(0x000000, 0.15).fillEllipse(x, y + 14, 16, 5);
  g.lineStyle(3, 0x5a4a3a).lineBetween(x - 6, y + 14, x - 6, y - 16);
  const wave = Math.sin(t * 5) * 2;
  g.fillStyle(active ? 0x4ae07a : 0xbbbbbb).fillTriangle(x - 5, y - 16, x + 14, y - 10 + wave, x - 5, y - 4);
}

export function drawLever(g: G, lv: Lever): void {
  g.fillStyle(0x555566).fillRoundedRect(lv.x - 12, lv.y + 4, 24, 10, 4);
  const ang = lv.flipped ? 0.6 : -0.6;
  g.lineStyle(5, 0x333333).lineBetween(lv.x, lv.y + 8, lv.x + Math.sin(ang) * 20, lv.y + 8 - Math.cos(ang) * 20);
  g.fillStyle(lv.flipped ? 0x4ae07a : 0xff4d6d).fillCircle(lv.x + Math.sin(ang) * 20, lv.y + 8 - Math.cos(ang) * 20, 6);
}

export function drawTerminal(g: G, term: Terminal, t: number): void {
  const x = term.x, y = term.y;
  g.fillStyle(0x000000, 0.18).fillEllipse(x, y + 16, 30, 8);
  g.fillStyle(0x3a4a66).fillRoundedRect(x - 15, y - 16, 30, 28, 4);
  g.fillStyle(term.done ? 0x4ae07a : 0x0c1830).fillRect(x - 11, y - 12, 22, 14);
  if (!term.done) {
    g.fillStyle(0x4ad6ff, 0.6 + 0.4 * Math.sin(t * 8)).fillRect(x - 9, y - 10 + ((t * 20) % 10), 18, 2);
    if (term.progress > 0) {
      const k = term.progress / CONFIG.player.hackTime;
      g.lineStyle(5, 0xffd23c).beginPath().arc(x, y - 4, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k).strokePath();
    }
  } else {
    g.lineStyle(3, 0xffffff).lineBetween(x - 6, y - 5, x - 1, y).lineBetween(x - 1, y, x + 7, y - 9);
  }
}

export function drawDonut(g: G, x: number, y: number, t: number): void {
  const s = 1 + 0.06 * Math.sin(t * 8);
  g.fillStyle(0x000000, 0.15).fillEllipse(x, y + 10, 22, 6);
  g.fillStyle(0xd99a52).fillCircle(x, y, 11 * s);
  g.fillStyle(0xff6eb4).fillCircle(x, y, 9 * s);
  g.fillStyle(COLORS.floor).fillCircle(x, y, 3.5 * s);
  const sprinkles = [0xffffff, 0x4ad6ff, 0xffe14a, 0x7aff7a];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    g.fillStyle(sprinkles[i % 4]).fillRect(x + Math.cos(a) * 6.5 - 1, y + Math.sin(a) * 6.5 - 1, 2.5, 2.5);
  }
}

export function drawStatus(g: G, a: Alien, t: number): void {
  const y = a.y - (a.kind === 'drone' ? 52 : alienHeight(a) + 10);
  if (a.state === 'suspicious' || (a.kind === 'drone' && a.sus > 0)) {
    g.fillStyle(0x000000, 0.35).fillRoundedRect(a.x - 16, y - 4, 32, 8, 4);
    g.fillStyle(a.kind === 'drone' ? 0xff3355 : 0xffd23c).fillRoundedRect(a.x - 15, y - 3, 30 * Math.min(1, a.sus), 6, 3);
  } else if (a.state === 'stunned') {
    for (let i = 0; i < 3; i++) {
      const ang = t * 5 + (i * Math.PI * 2) / 3;
      g.fillStyle(0xffe14a).fillCircle(a.x + Math.cos(ang) * 14, y + 6 + Math.sin(ang) * 5, 3.5);
    }
  }
}

export function drawSock(g: G, x: number, y: number, t: number): void {
  const b = Math.sin(t * 3 + 1) * 2;
  g.fillStyle(0x000000, 0.15).fillEllipse(x, y + 13, 18, 5);
  g.fillStyle(0xffffff).fillRoundedRect(x - 5, y - 12 + b, 10, 16, 3).fillRoundedRect(x - 5, y + 0 + b, 15, 8, 4);
  g.fillStyle(0xff4d6d).fillRect(x - 5, y - 9 + b, 10, 3).fillRect(x - 5, y - 3 + b, 10, 3);
  g.fillStyle(0x4ad6ff).fillRoundedRect(x + 4, y + 1 + b, 6, 7, 3);
  if (Math.floor(t * 3) % 4 === 0) g.fillStyle(0xffffff, 0.9).fillCircle(x + 8, y - 12 + b, 2);
}

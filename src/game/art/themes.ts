// =============================================================================
// 📘 LESSON: One set of rules, four different looks ("themes")
// =============================================================================
// A wall is a wall in every zone (same rules!), but it LOOKS like a garden fence in Suburbia, lockers at School,
// bricks in the Market and metal panels at the Spaceport. This file swaps the artwork only.
//
// Decorations (gnomes, backpacks, bananas, vents...) are placed by a HASH of the tile position:
//   hash(c, r) gives a number from 0 to 1 that looks random but is always the same for that tile.
//   If hash > 0.88 (about 12% of floor tiles), we draw a decoration there.
// So decorations are "random" but the same every time you play, and level designers never have to place them.
// 🧪 TRY IT: change 0.88 in drawThemedGround to 0.5. Gnome invasion!
// =============================================================================
import Phaser from 'phaser';
import { TILE } from '../../sim/config';
import type { Grid } from '../../sim/grid';
import { T } from '../../sim/level';

type G = Phaser.GameObjects.Graphics;
export type ZoneTheme = 'suburbia' | 'school' | 'market' | 'spaceport';
export const ZONE_THEMES: ZoneTheme[] = ['suburbia', 'school', 'market', 'spaceport'];

const hash = (c: number, r: number, k = 0) => {
  const v = Math.sin(c * 127.1 + r * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

interface Theme {
  floor: number; floorAlt: number; wall: number; wallTop: number; wallEdge: number; bg: number;
  drawFloor: (g: G, x: number, y: number, c: number, r: number) => void;
  drawWall: (g: G, x: number, y: number, c: number, r: number, grid: Grid) => void;
  drawObstacle: (g: G, x: number, y: number, c: number, r: number) => void;
  decor: ((g: G, x: number, y: number, c: number, r: number) => void)[];
}

// ---------------------------------------------------------------------------
const suburbia: Theme = {
  floor: 0xd6c8f5, floorAlt: 0xc9b8f0, wall: 0x7a5236, wallTop: 0xa8754e, wallEdge: 0x4a2f1e, bg: 0x2a1f45,
  drawFloor: (g, x, y, c, r) => {
    g.fillStyle((c + r) % 2 ? 0xd6c8f5 : 0xd0c0f2).fillRect(x, y, TILE, TILE);
    for (let i = 0; i < 3; i++) {
      const gx = x + 6 + hash(c, r, i) * 36, gy = y + 8 + hash(r, c, i) * 32;
      g.lineStyle(1.5, 0xb39ee6).lineBetween(gx, gy, gx - 2, gy - 5).lineBetween(gx, gy, gx + 2, gy - 5);
    }
  },
  drawWall: (g, x, y) => { // wooden garden fence
    g.fillStyle(0x4a2f1e).fillRect(x, y, TILE, TILE);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0xa8754e : 0x9a6a44).fillRect(x + 1 + i * 12, y + 4, 10, TILE - 8);
      g.fillStyle(0xc08a5e).fillTriangle(x + 1 + i * 12, y + 4, x + 11 + i * 12, y + 4, x + 6 + i * 12, y - 1);
    }
    g.fillStyle(0x7a5236).fillRect(x, y + 14, TILE, 5).fillRect(x, y + 32, TILE, 5);
  },
  drawObstacle: (g, x, y, c, r) => { // hedge bush
    g.fillStyle(0x26763e).fillCircle(x + 24, y + 28, 22);
    g.fillStyle(0x3a9654).fillCircle(x + 16, y + 20, 14).fillCircle(x + 32, y + 20, 14).fillCircle(x + 24, y + 30, 15);
    g.fillStyle(0x5cbf74).fillCircle(x + 15, y + 15, 5).fillCircle(x + 30, y + 17, 4);
    if (hash(c, r) > 0.7) g.fillStyle(0xff6eb4).fillCircle(x + 34, y + 26, 3).fillCircle(x + 18, y + 32, 3);
  },
  decor: [
    (g, x, y, c, r) => { // flowers
      for (let i = 0; i < 3; i++) {
        const fx = x + 10 + hash(c, r, i + 9) * 28, fy = y + 12 + hash(r, c, i + 9) * 26;
        g.fillStyle([0xff6eb4, 0xffd23c, 0xffffff][i]).fillCircle(fx - 2, fy, 2).fillCircle(fx + 2, fy, 2).fillCircle(fx, fy - 2, 2).fillCircle(fx, fy + 2, 2);
        g.fillStyle(0xff8c3c).fillCircle(fx, fy, 1.4);
      }
    },
    (g, x, y) => { // garden gnome, facing backwards of course
      g.fillStyle(0x000000, 0.15).fillEllipse(x + 24, y + 38, 16, 5);
      g.fillStyle(0x3a6ad6).fillRoundedRect(x + 18, y + 24, 12, 13, 3);
      g.fillStyle(0xffd2a8).fillCircle(x + 24, y + 22, 5);
      g.fillStyle(0xffffff).fillTriangle(x + 19, y + 24, x + 29, y + 24, x + 24, y + 33);
      g.fillStyle(0xff4d6d).fillTriangle(x + 18, y + 20, x + 30, y + 20, x + 24, y + 6);
    },
    (g, x, y, c, r) => { // puddle
      g.fillStyle(0x9fd8ff, 0.55).fillEllipse(x + 24 + hash(c, r) * 6, y + 30, 26, 10);
      g.fillStyle(0xffffff, 0.6).fillEllipse(x + 18, y + 28, 6, 2);
    },
  ],
};

// ---------------------------------------------------------------------------
const school: Theme = {
  floor: 0xeae4f7, floorAlt: 0xd8d0ef, wall: 0x3a6ad6, wallTop: 0x5a88f0, wallEdge: 0x1f3c88, bg: 0x1b2244,
  drawFloor: (g, x, y, c, r) => {
    g.fillStyle((c + r) % 2 ? 0xeae4f7 : 0xd6cdee).fillRect(x, y, TILE, TILE);
    g.lineStyle(1, 0xc6bce6, 0.6).strokeRect(x, y, TILE, TILE);
  },
  drawWall: (g, x, y, c) => { // lockers
    g.fillStyle(0x1f3c88).fillRect(x, y, TILE, TILE);
    for (let i = 0; i < 2; i++) {
      const lx = x + 2 + i * 23;
      g.fillStyle([0x5a88f0, 0xff8c3c, 0x4ae07a, 0xff6eb4][(c + i) % 4]).fillRoundedRect(lx, y + 2, 21, TILE - 6, 2);
      g.fillStyle(0x000000, 0.25).fillRect(lx + 4, y + 8, 13, 2).fillRect(lx + 4, y + 12, 13, 2);
      g.fillStyle(0xdddddd).fillRect(lx + 16, y + 22, 3, 6);
    }
  },
  drawObstacle: (g, x, y, c, r) => { // school desk with a chair
    g.fillStyle(0x000000, 0.15).fillEllipse(x + 24, y + 42, 40, 8);
    g.fillStyle(0x8a5a36).fillRect(x + 8, y + 22, 4, 18).fillRect(x + 36, y + 22, 4, 18);
    g.fillStyle(0xc08a5e).fillRoundedRect(x + 4, y + 10, 40, 16, 3);
    g.fillStyle(0xffffff).fillRect(x + 10 + hash(c, r) * 12, y + 13, 12, 8);
    g.fillStyle(0x3a6ad6).fillRect(x + 28, y + 14, 8, 2);
  },
  decor: [
    (g, x, y, c, r) => { // backpack
      const col = [0xff4d6d, 0x4ae07a, 0xffd23c][Math.floor(hash(c, r) * 3)];
      g.fillStyle(0x000000, 0.15).fillEllipse(x + 24, y + 36, 18, 5);
      g.fillStyle(col).fillRoundedRect(x + 16, y + 20, 16, 16, 5);
      g.fillStyle(0x000000, 0.2).fillRoundedRect(x + 19, y + 28, 10, 6, 2);
    },
    (g, x, y) => { // chalk drawing of an alien (backwards, obviously)
      g.lineStyle(1.5, 0xffffff, 0.7).strokeCircle(x + 24, y + 22, 7);
      g.lineBetween(x + 22, y + 29, x + 26, y + 36).lineBetween(x + 26, y + 29, x + 30, y + 36);
      g.fillStyle(0xffffff, 0.7).fillCircle(x + 21, y + 21, 1.5).fillCircle(x + 26, y + 21, 1.5);
    },
    (g, x, y) => { // basketball
      g.fillStyle(0x000000, 0.15).fillEllipse(x + 26, y + 36, 14, 4);
      g.fillStyle(0xff8c3c).fillCircle(x + 26, y + 30, 6);
      g.lineStyle(1, 0x8a3a10).lineBetween(x + 20, y + 30, x + 32, y + 30).lineBetween(x + 26, y + 24, x + 26, y + 36);
    },
  ],
};

// ---------------------------------------------------------------------------
const market: Theme = {
  floor: 0xd8c4b0, floorAlt: 0xc8b29c, wall: 0xb4523a, wallTop: 0xd06a4e, wallEdge: 0x6e2c1e, bg: 0x2a1626,
  drawFloor: (g, x, y, c, r) => { // cobblestones
    g.fillStyle(0xb8a28c).fillRect(x, y, TILE, TILE);
    for (let i = 0; i < 4; i++) {
      const sx = x + (i % 2) * 24 + ((r % 2) * 12) % 24, sy = y + Math.floor(i / 2) * 24;
      g.fillStyle(hash(c, r, i) > 0.5 ? 0xd8c4b0 : 0xccb6a0).fillRoundedRect(sx + 1, sy + 1, 22, 22, 6);
    }
  },
  drawWall: (g, x, y, c, r, grid) => { // brick with shop awnings on the bottom edge
    g.fillStyle(0x6e2c1e).fillRect(x, y, TILE, TILE);
    for (let row = 0; row < 4; row++) for (let k = 0; k < 3; k++) {
      g.fillStyle(hash(c, r, row * 3 + k) > 0.5 ? 0xb4523a : 0xa44632).fillRect(x + k * 16 + (row % 2) * 8 - 8, y + row * 12 + 1, 15, 10);
    }
    if (!grid.solid(c, r + 1) && hash(c, r) > 0.4) {
      for (let k = 0; k < 4; k++) g.fillStyle(k % 2 ? 0xffffff : [0xff4d6d, 0x4ab0e8, 0x4ae07a][c % 3]).fillTriangle(x + k * 12, y + 34, x + k * 12 + 12, y + 34, x + k * 12 + 6, y + 46);
    }
  },
  drawObstacle: (g, x, y, c, r) => { // fruit crate
    g.fillStyle(0x000000, 0.15).fillEllipse(x + 24, y + 42, 42, 8);
    g.fillStyle(0x8a5a36).fillRect(x + 4, y + 16, 40, 26);
    g.fillStyle(0xc08a5e).fillRect(x + 6, y + 18, 36, 6).fillRect(x + 6, y + 28, 36, 6);
    const fruit = [0xff4d6d, 0xffa028, 0x8be06a, 0xb98cff][Math.floor(hash(c, r) * 4)];
    for (let i = 0; i < 5; i++) g.fillStyle(fruit).fillCircle(x + 10 + i * 7, y + 14 - (i % 2) * 3, 5);
  },
  decor: [
    (g, x, y) => { // dropped banana
      g.lineStyle(4, 0xffd23c).beginPath().arc(x + 24, y + 22, 9, 0.2, 2.4).strokePath();
    },
    (g, x, y, c, r) => { // neon puddle
      g.fillStyle([0xff6eb4, 0x4ad6ff][Math.floor(hash(c, r) * 2)], 0.35).fillEllipse(x + 24, y + 30, 28, 10);
    },
    (g, x, y) => { // little sign
      g.fillStyle(0x5a4a3a).fillRect(x + 23, y + 20, 2, 18);
      g.fillStyle(0xffffff).fillRoundedRect(x + 13, y + 12, 22, 12, 2);
      g.fillStyle(0xff4d6d).fillRect(x + 16, y + 16, 16, 2).fillRect(x + 16, y + 20, 10, 2);
    },
  ],
};

// ---------------------------------------------------------------------------
const spaceport: Theme = {
  floor: 0xb8c4d6, floorAlt: 0xa4b2c8, wall: 0x3e4a66, wallTop: 0x56648a, wallEdge: 0x232a3e, bg: 0x0d1020,
  drawFloor: (g, x, y, c, r) => { // metal plates with rivets
    g.fillStyle((c + r) % 2 ? 0xb8c4d6 : 0xaebbd0).fillRect(x, y, TILE, TILE);
    g.lineStyle(1, 0x8894a8).strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    g.fillStyle(0x8894a8).fillCircle(x + 5, y + 5, 1.5).fillCircle(x + TILE - 5, y + 5, 1.5).fillCircle(x + 5, y + TILE - 5, 1.5).fillCircle(x + TILE - 5, y + TILE - 5, 1.5);
  },
  drawWall: (g, x, y, c, r) => { // bulkhead panel with a blinking light
    g.fillStyle(0x232a3e).fillRect(x, y, TILE, TILE);
    g.fillStyle(0x3e4a66).fillRect(x + 2, y + 2, TILE - 4, TILE - 10);
    g.fillStyle(0x56648a).fillRect(x + 6, y + 6, TILE - 12, 6);
    if (hash(c, r) > 0.6) g.fillStyle([0x4ae07a, 0xff3355, 0x4ad6ff][c % 3]).fillCircle(x + 38, y + 28, 3);
    g.fillStyle(0xffd23c).fillRect(x, y + TILE - 8, TILE, 3);
    for (let k = 0; k < 4; k++) g.fillStyle(0x232a3e).fillTriangle(x + k * 12, y + TILE - 8, x + k * 12 + 6, y + TILE - 8, x + k * 12 + 3, y + TILE - 5);
  },
  drawObstacle: (g, x, y, c, r) => { // cargo container
    g.fillStyle(0x000000, 0.18).fillEllipse(x + 24, y + 42, 44, 8);
    const col = [0xff8c3c, 0x4ab0e8, 0x8be06a][Math.floor(hash(c, r) * 3)];
    g.fillStyle(0x232a3e).fillRect(x + 2, y + 8, 44, 34);
    g.fillStyle(col).fillRect(x + 4, y + 10, 40, 30);
    g.fillStyle(0x000000, 0.18);
    for (let k = 0; k < 5; k++) g.fillRect(x + 7 + k * 8, y + 12, 3, 26);
  },
  decor: [
    (g, x, y) => { // hazard stripes
      for (let k = 0; k < 4; k++) g.fillStyle(k % 2 ? 0x232a3e : 0xffd23c).fillRect(x + 8 + k * 8, y + 36, 8, 5);
    },
    (g, x, y) => { // floor vent
      g.fillStyle(0x56648a).fillRoundedRect(x + 12, y + 16, 24, 16, 3);
      g.fillStyle(0x232a3e);
      for (let k = 0; k < 4; k++) g.fillRect(x + 15, y + 19 + k * 3.5, 18, 2);
    },
    (g, x, y, c, r) => { // cables
      g.lineStyle(3, [0xff3355, 0x4ad6ff][Math.floor(hash(c, r) * 2)]).beginPath().arc(x + 24, y + 48, 20, Math.PI * 1.1, Math.PI * 1.9).strokePath();
    },
  ],
};

const THEMES: Record<ZoneTheme, Theme> = { suburbia, school, market, spaceport };

export function themeBg(theme: ZoneTheme): number {
  return THEMES[theme].bg;
}

/** Static ground: floors, walls, obstacles, decorations and soft wall shadows. */
export function drawThemedGround(g: G, grid: Grid, theme: ZoneTheme): void {
  const th = THEMES[theme];
  g.clear();
  const isWallish = (c: number, r: number) => { const t = grid.get(c, r); return t === T.Wall || t === T.Empty; };
  for (let r = 0; r < grid.h; r++) for (let c = 0; c < grid.w; c++) {
    const t = grid.get(c, r), x = c * TILE, y = r * TILE;
    if (isWallish(c, r)) { th.drawWall(g, x, y, c, r, grid); continue; }
    th.drawFloor(g, x, y, c, r);
    // soft shadow cast by a wall above / to the left
    if (isWallish(c, r - 1)) g.fillStyle(0x000000, 0.14).fillRect(x, y, TILE, 8);
    if (isWallish(c - 1, r)) g.fillStyle(0x000000, 0.08).fillRect(x, y, 6, TILE);
    if (t === T.Floor && hash(c, r, 5) > 0.88) th.decor[Math.floor(hash(c, r, 6) * th.decor.length)](g, x, y, c, r);
  }
  // obstacles & special tiles drawn after floors so they overlap nicely
  for (let r = 0; r < grid.h; r++) for (let c = 0; c < grid.w; c++) {
    const t = grid.get(c, r), x = c * TILE, y = r * TILE;
    if (t === T.Hedge) th.drawObstacle(g, x, y, c, r);
  }
}

/** Ambient sky life drifting over the level, per zone. */
export interface Flyer { x: number; y: number; vx: number; phase: number }

export function drawFlyer(g: G, theme: ZoneTheme, f: Flyer, t: number): void {
  const flap = Math.sin(t * 10 + f.phase);
  switch (theme) {
    case 'suburbia': { // bird flying backwards (tail first)
      g.fillStyle(0x2a1f45, 0.8).fillEllipse(f.x, f.y, 14, 8);
      g.lineStyle(2.5, 0x2a1f45, 0.8).lineBetween(f.x - 2, f.y, f.x - 10, f.y - 6 * flap).lineBetween(f.x + 2, f.y, f.x + 10, f.y - 6 * flap);
      g.fillStyle(0xffd23c).fillTriangle(f.x - Math.sign(f.vx) * 7, f.y - 1, f.x - Math.sign(f.vx) * 12, f.y, f.x - Math.sign(f.vx) * 7, f.y + 2);
      break;
    }
    case 'school': { // paper plane
      const d = Math.sign(f.vx);
      g.fillStyle(0xffffff, 0.9).fillTriangle(f.x + d * 12, f.y, f.x - d * 10, f.y - 6, f.x - d * 6, f.y + 2);
      g.fillStyle(0xdddddd, 0.9).fillTriangle(f.x + d * 12, f.y, f.x - d * 6, f.y + 2, f.x - d * 8, f.y + 7);
      break;
    }
    case 'market': { // balloon
      g.lineStyle(1, 0x2a1f45, 0.6).lineBetween(f.x, f.y + 12, f.x + Math.sin(t + f.phase) * 4, f.y + 30);
      g.fillStyle([0xff4d6d, 0xffd23c, 0x4ab0e8][Math.floor(f.phase) % 3], 0.9).fillEllipse(f.x, f.y, 18, 22);
      g.fillStyle(0xffffff, 0.5).fillEllipse(f.x - 4, f.y - 5, 5, 7);
      break;
    }
    case 'spaceport': { // mini UFO
      g.fillStyle(0xbfe9ff, 0.8).fillEllipse(f.x, f.y - 4, 12, 10);
      g.fillStyle(0x8894a8).fillEllipse(f.x, f.y, 26, 8);
      g.fillStyle(Math.floor(t * 4 + f.phase) % 2 ? 0xffd23c : 0xff3355).fillCircle(f.x - 7, f.y + 1, 1.5).fillCircle(f.x + 7, f.y + 1, 1.5);
      break;
    }
  }
}

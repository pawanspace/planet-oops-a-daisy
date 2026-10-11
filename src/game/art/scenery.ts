// =============================================================================
// 📘 LESSON: Scenery for the title screen and story scenes
// =============================================================================
// Space, the daisy planet, Leo's ship, bushes and a mailbox, all drawn with shapes (see draw.ts for the basics).
// Two tricks worth knowing:
//   • STARS that don't move: we don't store 120 star positions. A "hash" function turns the star's number into
//     a pseudo-random but ALWAYS THE SAME position, so the sky looks random yet never jumps around.
//   • ROTATION by hand: drawShip uses   x' = x·cos(a) − y·sin(a),   y' = x·sin(a) + y·cos(a)
//     to turn every point of the ship by angle a (so it can tumble during the crash!).
// 🧠 QUIZ Q27: Rotating the point (1, 0) by 90° (π/2) gives which point?
// =============================================================================
import Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
const INK = 0x2a1f45;
const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Ship parts in zone order. */
export const PARTS = ['spark', 'battery', 'wheel', 'key'] as const;

export function drawSpace(g: G, w: number, h: number, t: number, drift = 0): void {
  g.fillGradientStyle(0x0d0820, 0x0d0820, 0x2a1f45, 0x2a1f45, 1).fillRect(0, 0, w, h);
  const hash = (n: number) => { const v = Math.sin(n) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 120; i++) {
    const layer = 0.3 + (i % 3) * 0.3;
    const sx = (hash(i * 12.9898) * (w + 20) + drift * layer) % (w + 20) - 10;
    const sy = hash(i * 78.233) * h;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + (i % 5) * 0.3) + i));
    g.fillStyle(0xffffff, tw).fillCircle(w - sx, sy, i % 9 === 0 ? 2 : 1);
  }
}

export function drawDaisyPlanet(g: G, x: number, y: number, r: number, t: number): void {
  const petals = 12;
  for (let i = 0; i < petals; i++) {
    const a = t * 0.1 + (i / petals) * Math.PI * 2;
    const px = x + Math.cos(a) * r * 0.95, py = y + Math.sin(a) * r * 0.95;
    g.fillStyle(i % 2 ? 0xffffff : 0xf3ecff).fillEllipse(px, py, r * 0.75, r * 0.75);
  }
  g.fillStyle(0xf0b020).fillCircle(x, y, r * 0.86);
  g.fillStyle(0xffd23c).fillCircle(x, y, r * 0.8);
  g.fillStyle(0xd6c8f5).fillCircle(x - r * 0.25, y - r * 0.2, r * 0.18);
  g.fillStyle(0x3a9654).fillCircle(x + r * 0.3, y + r * 0.25, r * 0.14).fillCircle(x - r * 0.35, y + r * 0.35, r * 0.1);
  g.fillStyle(0xffffff, 0.3).fillEllipse(x - r * 0.35, y - r * 0.45, r * 0.5, r * 0.22);
}

/** Leo's ship, side view. `parts` = which ship parts are fitted (missing ones are dashed outlines). */
export function drawShip(g: G, x: number, y: number, s: number, t: number, parts: boolean[], flame = 0, tilt = 0): void {
  const c = Math.cos(tilt), sn = Math.sin(tilt);
  const P = (dx: number, dy: number) => V(x + (dx * c - dy * sn) * s, y + (dx * sn + dy * c) * s);
  if (flame > 0) {
    const f = flame * (1 + 0.2 * Math.sin(t * 40));
    g.fillStyle(0xff8c3c).fillPoints([P(-60, -10), P(-60 - 40 * f, 0), P(-60, 10)], true);
    g.fillStyle(0xffe14a).fillPoints([P(-60, -6), P(-60 - 24 * f, 0), P(-60, 6)], true);
  }
  // fins
  g.fillStyle(0xff4d6d).fillPoints([P(-50, -14), P(-66, -34), P(-36, -14)], true).fillPoints([P(-50, 14), P(-66, 34), P(-36, 14)], true);
  // body
  g.fillStyle(INK).fillPoints([P(-62, -18), P(30, -20), P(64, 0), P(30, 20), P(-62, 18)], true);
  g.fillStyle(0xeef0ff).fillPoints([P(-59, -15), P(29, -17), P(59, 0), P(29, 17), P(-59, 15)], true);
  g.fillStyle(0x4ab0e8).fillPoints([P(-59, 6), P(29, 8), P(52, 3), P(59, 0), P(29, 17), P(-59, 15)], true);
  // window with Leo
  const wv = P(20, -3);
  g.fillStyle(INK).fillCircle(wv.x, wv.y, 11 * s);
  g.fillStyle(0xbfe9ff).fillCircle(wv.x, wv.y, 9 * s);
  g.fillStyle(0xffd2a8).fillCircle(wv.x + 1 * s, wv.y + 1 * s, 5 * s);
  g.fillStyle(0x6a3c1a).fillEllipse(wv.x, wv.y - 3 * s, 9 * s, 4 * s);
  g.fillStyle(INK).fillCircle(wv.x + 3 * s, wv.y, 1 * s);
  // part slots
  const slots = [P(-44, 0), P(-22, 0), P(0, 0), P(38, 10)];
  slots.forEach((p, i) => {
    if (parts[i]) {
      const glow = 0.3 + 0.2 * Math.sin(t * 4 + i);
      g.fillStyle(0xfff27a, glow).fillCircle(p.x, p.y, 9 * s);
      g.fillStyle([0xffe14a, 0x4ae07a, 0x333344, 0xffd23c][i]).fillCircle(p.x, p.y, 6 * s);
      g.lineStyle(1.5, INK).strokeCircle(p.x, p.y, 6 * s);
    } else {
      g.lineStyle(1.5, 0x8888aa, 0.9);
      for (let k = 0; k < 8; k += 2) g.beginPath().arc(p.x, p.y, 6 * s, (k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2).strokePath();
    }
  });
}

export function drawLawn(g: G, w: number, h: number, horizon: number): void {
  g.fillGradientStyle(0x7a5ac8, 0x7a5ac8, 0xd6c8f5, 0xd6c8f5, 1).fillRect(0, 0, w, horizon);
  g.fillStyle(0xb9a4ec).fillRect(0, horizon, w, h - horizon);
  g.fillStyle(0xa58fe0);
  for (let i = 0; i < 30; i++) g.fillEllipse((i * 71) % w, horizon + 20 + ((i * 37) % (h - horizon - 20)), 30, 6);
}

export function drawBush(g: G, x: number, y: number, s: number, rustle = 0): void {
  const r = Math.sin(rustle * 30) * 3 * s;
  g.fillStyle(0x26763e).fillEllipse(x + r, y - 18 * s, 70 * s, 44 * s);
  g.fillStyle(0x3a9654).fillCircle(x - 18 * s + r, y - 26 * s, 18 * s).fillCircle(x + 14 * s + r, y - 28 * s, 20 * s).fillCircle(x + r, y - 14 * s, 20 * s);
  g.fillStyle(0x5cbf74).fillCircle(x - 20 * s + r, y - 34 * s, 6 * s).fillCircle(x + 12 * s + r, y - 38 * s, 5 * s);
}

export function drawMailbox(g: G, x: number, y: number, s: number, dent = 0): void {
  g.fillStyle(0x5a4a3a).fillRect(x - 3 * s, y - 40 * s, 6 * s, 40 * s);
  g.fillStyle(INK).fillRoundedRect(x - 15 * s, y - 58 * s + dent * 4 * s, 30 * s, 20 * s - dent * 4 * s, 8 * s);
  g.fillStyle(0x4ab0e8).fillRoundedRect(x - 13.5 * s, y - 56.5 * s + dent * 4 * s, 27 * s, 17 * s - dent * 4 * s, 7 * s);
  g.fillStyle(0xff4d6d).fillRect(x + 10 * s, y - 64 * s, 3 * s, 10 * s).fillRect(x + 10 * s, y - 64 * s, 8 * s, 4 * s);
}

/** Glowing alien eyes peeking out of the dark. */
export function drawEyes(g: G, x: number, y: number, s: number, t: number, seed: number): void {
  const blink = Math.sin(t * 2 + seed * 3) > 0.96;
  if (blink) return;
  for (const d of [-5, 5]) {
    g.fillStyle(0xffffff).fillCircle(x + d * s, y, 4 * s);
    g.fillStyle(INK).fillCircle(x + d * s + Math.sin(t + seed) * 1.5 * s, y, 2 * s);
  }
}

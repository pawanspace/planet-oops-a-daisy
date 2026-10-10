// Side-view character rigs drawn with Phaser Graphics every frame.
// The joke made visible: locals' faces look one way while their knees and toes point the other.
import Phaser from 'phaser';
import { KINDS } from '../../sim/config';
import type { Alien, Player } from '../../sim/world';

type G = Phaser.GameObjects.Graphics;

const INK = 0x2a1f45;

export interface Outfit { shirt: number; flower: number; shorts: number; hat: 'none' | 'cap' | 'pineapple' | 'crown' | 'propeller' }
export const DEFAULT_OUTFIT: Outfit = { shirt: 0xff7a2f, flower: 0xffe14a, shorts: 0x3a6ad6, hat: 'none' };

const PALETTES: Record<Alien['kind'], number[]> = {
  stroller: [0x37c8b4, 0x5ad66a, 0x4ab0e8],
  lookout: [0xff8c3c],
  hugger: [0xff6eb4],
  kid: [0xffd23c, 0xffa94d, 0x8be06a],
  heavy: [0x9b6bd6],
  scooter: [0x4ad6ff],
  drone: [0xb8c4d6],
};

function shade(c: number, k: number): number {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * k));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * k));
  const b = Math.min(255, Math.max(0, (c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

/** Thick round-capped segment. */
function limb(g: G, x1: number, y1: number, x2: number, y2: number, w: number, color: number): void {
  g.lineStyle(w, color).lineBetween(x1, y1, x2, y2);
  g.fillStyle(color).fillCircle(x1, y1, w / 2).fillCircle(x2, y2, w / 2);
}

/**
 * Two legs. `toe` is where knees and toes point (+1 right / -1 left). `phase` drives the walk cycle,
 * `stride` 0..1 is how big the steps are. `tangle` crosses the legs (after a skid).
 */
function legs(g: G, x: number, y: number, s: number, toe: number, phase: number, stride: number,
  leg: number, shoe: number, shoeToe: number, tangle = 0): void {
  for (const i of [0, 1]) {
    const ph = phase + i * Math.PI;
    const near = i === 1;
    const hipX = x + (near ? 3 : -3) * s, hipY = y - 13 * s;
    let footX = x + toe * Math.sin(ph) * 7 * stride * s + (near ? 2 : -2) * s;
    if (tangle) footX = x + (near ? -4 : 4) * s * tangle;
    const footY = y - Math.max(0, Math.cos(ph)) * 4 * stride * s;
    const kneeX = (hipX + footX) / 2 + toe * 4 * s, kneeY = (hipY + footY) / 2;
    const c = near ? leg : shade(leg, 0.75);
    limb(g, hipX, hipY, kneeX, kneeY, 4 * s, c);
    limb(g, kneeX, kneeY, footX, footY - 1.5 * s, 4 * s, c);
    g.fillStyle(near ? shoe : shade(shoe, 0.8)).fillEllipse(footX + toe * 2.5 * s, footY - 1.5 * s, 10 * s, 5.5 * s);
    g.fillStyle(shoeToe).fillEllipse(footX + toe * 5 * s, footY - 1.5 * s, 3.5 * s, 4 * s);
  }
}

function shadow(g: G, x: number, y: number, w: number): void {
  g.fillStyle(0x000000, 0.18).fillEllipse(x, y, w, w * 0.32);
}

// -----------------------------------------------------------------------------
// Aliens
// -----------------------------------------------------------------------------
export interface AlienPose { face: number; walk: number }

/** Remembers which way each alien faces so it doesn't flicker when looking straight up/down. */
export function updateFace(prev: number, look: number): number {
  const c = Math.cos(look);
  return Math.abs(c) < 0.25 ? prev || 1 : Math.sign(c);
}

export function alienHeight(a: Alien): number {
  return 44 * (KINDS[a.kind].radius / 16);
}

export function drawAlien(g: G, a: Alien, pose: AlienPose, t: number, hugging: boolean): void {
  if (a.kind === 'drone') { drawDrone(g, a, pose, t); return; }
  const s = KINDS[a.kind].radius / 16;
  const pal = PALETTES[a.kind];
  const body = pal[a.id % pal.length];
  const face = pose.face;
  const toe = -face; // backwards legs!
  const x = a.x, y = a.y;
  const lx = Math.cos(a.look), ly = Math.sin(a.look);
  const st = a.state;
  const moving = a.speed > 1 && !['stunned', 'eating', 'sleep', 'hugging', 'suspicious'].includes(st);
  const chase = st === 'chase';
  const stride = moving ? (chase ? 1.2 : 0.8) : 0;
  const bob = moving ? Math.abs(Math.sin(pose.walk)) * 2 * s : st === 'sleep' ? Math.sin(t * 2) * 1 * s : 0;

  shadow(g, x, y, 30 * s);

  if (a.kind === 'scooter') {
    // Kick-scooter: handlebar points where it's going, the rider faces the other way.
    const dir = a.heading.x !== 0 ? Math.sign(a.heading.x) : toe;
    g.fillStyle(0x333344).fillRoundedRect(x - 15 * s, y - 6 * s, 30 * s, 4 * s, 2 * s);
    const spin = t * 25;
    for (const wx of [-12, 12]) {
      g.fillStyle(0x111111).fillCircle(x + wx * s, y - 2 * s, 4 * s);
      g.lineStyle(1.5, 0x888888).lineBetween(x + wx * s - Math.cos(spin) * 3 * s, y - 2 * s - Math.sin(spin) * 3 * s, x + wx * s + Math.cos(spin) * 3 * s, y - 2 * s + Math.sin(spin) * 3 * s);
    }
    limb(g, x + dir * 13 * s, y - 6 * s, x + dir * 11 * s, y - 34 * s, 3 * s, 0xff4d6d);
    limb(g, x + dir * 7 * s, y - 34 * s, x + dir * 15 * s, y - 34 * s, 3 * s, 0x333333);
    legs(g, x, y - 6 * s, s * 0.9, toe, 0, 0, shade(body, 0.8), INK, 0xffffff);
  } else if (st === 'sleep') {
    // sitting down, legs folded forward
    limb(g, x - 6 * s, y - 4 * s, x + toe * 8 * s, y - 3 * s, 4 * s, shade(body, 0.75));
    limb(g, x + 4 * s, y - 4 * s, x + toe * 12 * s, y - 2 * s, 4 * s, shade(body, 0.8));
  } else {
    const tangle = a.untangle > 0 ? 0.6 + 0.4 * Math.sin(t * 30) : 0;
    legs(g, x, y, s, toe, pose.walk, stride, shade(body, 0.8), INK, 0xffffff, tangle);
  }

  const sy = a.kind === 'scooter' ? y - 6 * s : st === 'sleep' ? y + 8 * s : y;
  const squash = st === 'hugging' ? 1.12 : st === 'eating' ? 1 + 0.06 * Math.sin(t * 18) : a.untangle > 0 ? 1 + 0.1 * Math.sin(t * 40) : 1;
  const bw = 28 * s * squash, bh = 26 * s / squash;
  const cx = x, cy = sy - 25 * s - bob;

  // arms (far arm behind the body)
  const armY = cy + 3 * s;
  const reach = chase || hugging;
  const wave = Math.sin(t * 6 + a.id) * 0.4;
  const armEnd = (side: number) => {
    if (reach) return [cx + face * 16 * s, armY - 3 * s + side * 3 * s];
    if (st === 'stunned') return [cx + side * 15 * s, armY - 10 * s];
    if (st === 'eating') return [cx + face * 9 * s, armY - 2 * s];
    if (st === 'search' || st === 'investigate') return side > 0 ? [cx + face * 7 * s, cy - 4 * s] : [cx - face * 12 * s, armY + 8 * s];
    return [cx + side * 14 * s, armY + 8 * s + (side > 0 ? wave : -wave) * 4 * s];
  };
  const [fax, fay] = armEnd(-1);
  limb(g, cx - 8 * s, armY, fax, fay, 3.5 * s, shade(body, 0.75));

  // body
  g.fillStyle(INK).fillEllipse(cx, cy, bw + 3, bh + 3);
  g.fillStyle(body).fillEllipse(cx, cy, bw, bh);
  g.fillStyle(shade(body, 1.15)).fillEllipse(cx + face * 3 * s, cy + 4 * s, bw * 0.55, bh * 0.5);
  g.fillStyle(0xffffff, 0.35).fillEllipse(cx - face * 6 * s, cy - 7 * s, 7 * s, 4 * s);

  // antenna / hats
  const top = cy - bh / 2;
  if (a.kind === 'kid') {
    g.fillStyle(0xff4d6d).fillTriangle(cx - 6 * s, top + 2 * s, cx + 6 * s, top + 2 * s, cx + face * 2 * s, top - 13 * s);
    g.fillStyle(0xffffff).fillCircle(cx + face * 2 * s, top - 13 * s, 2.5 * s);
    g.fillStyle(0xffe14a).fillRect(cx - 3 * s, top - 4 * s, 6 * s, 2 * s);
  } else {
    const wob = Math.sin(t * 6 + a.id) * 3 * s;
    g.lineStyle(2, INK).lineBetween(cx, top + 1, cx + wob, top - 9 * s);
    if (a.kind === 'hugger') {
      const hx = cx + wob, hy = top - 11 * s;
      g.fillStyle(0xff2d6d).fillCircle(hx - 2.5 * s, hy, 3 * s).fillCircle(hx + 2.5 * s, hy, 3 * s).fillTriangle(hx - 5.5 * s, hy + 1, hx + 5.5 * s, hy + 1, hx, hy + 7 * s);
    } else {
      g.fillStyle(0xffe14a).fillCircle(cx + wob, top - 10 * s, 3.5 * s);
    }
  }
  if (a.kind === 'heavy') {
    g.lineStyle(4 * s, 0x333344).beginPath().arc(cx, cy - 2 * s, 14 * s, Math.PI * 1.08, Math.PI * 1.92).strokePath();
    g.fillStyle(0x333344).fillRoundedRect(cx - 17 * s, cy - 7 * s, 6 * s, 10 * s, 2 * s).fillRoundedRect(cx + 11 * s, cy - 7 * s, 6 * s, 10 * s, 2 * s);
    g.fillStyle(0xff4d6d).fillCircle(cx - 14 * s, cy - 2 * s, 1.5 * s).fillCircle(cx + 14 * s, cy - 2 * s, 1.5 * s);
  }
  if (a.kind === 'lookout') {
    // binoculars hanging on a strap, on the belly
    const bx = cx + face * 3 * s, by = cy + 9 * s;
    g.lineStyle(1.5, INK).lineBetween(cx - 7 * s, cy - 3 * s, bx - 3 * s, by).lineBetween(cx + 7 * s, cy - 3 * s, bx + 3 * s, by);
    g.fillStyle(0x333344).fillRoundedRect(bx - 5.5 * s, by - 2.5 * s, 11 * s, 6 * s, 2 * s);
    g.fillStyle(0x88ccff).fillCircle(bx - 2.7 * s, by + 0.5 * s, 1.8 * s).fillCircle(bx + 2.7 * s, by + 0.5 * s, 1.8 * s);
  }

  // face
  const ex = cx + face * 5 * s, ey = cy - 4 * s;
  const eyeR = 4.8 * s;
  if (st === 'sleep') {
    g.lineStyle(2, INK);
    for (const d of [-4.5, 4.5]) g.beginPath().arc(ex + d * s, ey + 1 * s, 2.5 * s, 0.15 * Math.PI, 0.85 * Math.PI).strokePath();
  } else if (st === 'hugging') {
    g.lineStyle(2.2, INK);
    for (const d of [-4.5, 4.5]) g.beginPath().arc(ex + d * s, ey + 2 * s, 3 * s, 1.15 * Math.PI, 1.85 * Math.PI).strokePath();
    g.fillStyle(0xff7aa8, 0.6).fillCircle(ex - 8 * s, ey + 5 * s, 2.5 * s).fillCircle(ex + 8 * s, ey + 5 * s, 2.5 * s);
  } else {
    const big = chase ? 1.2 : 1;
    for (const d of [-4.5, 4.5]) {
      g.fillStyle(INK).fillCircle(ex + d * s, ey, eyeR * big + 1);
      g.fillStyle(0xffffff).fillCircle(ex + d * s, ey, eyeR * big);
      if (st === 'stunned') {
        g.lineStyle(1.5, INK);
        const sp = t * 10;
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = (k / 10) * eyeR * 0.8, an = sp + k * 0.9;
          if (k === 0) g.moveTo(ex + d * s + Math.cos(an) * r, ey + Math.sin(an) * r);
          else g.lineTo(ex + d * s + Math.cos(an) * r, ey + Math.sin(an) * r);
        }
        g.strokePath();
      } else {
        const pupil = chase ? 2 : 2.4;
        g.fillStyle(INK).fillCircle(ex + d * s + lx * 2 * s, ey + ly * 1.6 * s, pupil * s);
        g.fillStyle(0xffffff).fillCircle(ex + d * s + lx * 2 * s - 0.8 * s, ey + ly * 1.6 * s - 0.9 * s, 0.8 * s);
      }
    }
    if (st === 'suspicious') { // one raised eyebrow
      g.lineStyle(2, INK).lineBetween(ex + 1.5 * s, ey - 6.5 * s, ex + 8 * s, ey - 9 * s);
      g.lineStyle(2, INK).lineBetween(ex - 8 * s, ey - 6.5 * s, ex - 1.5 * s, ey - 6.5 * s);
    }
  }
  // mouth
  const mx = ex, my = ey + 8 * s;
  if (chase) {
    g.fillStyle(INK).fillEllipse(mx, my + 1 * s, 9 * s, 6 * s);
    g.fillStyle(0xff7aa8).fillEllipse(mx, my + 2.5 * s, 5 * s, 2.5 * s);
  } else if (st === 'eating') {
    const open = Math.abs(Math.sin(t * 14)) * 4 * s;
    g.fillStyle(INK).fillEllipse(mx, my, 6 * s, 1 * s + open);
  } else if (st === 'stunned') {
    g.lineStyle(1.8, INK).beginPath().moveTo(mx - 4 * s, my).lineTo(mx - 2 * s, my - 1.5 * s).lineTo(mx, my).lineTo(mx + 2 * s, my - 1.5 * s).lineTo(mx + 4 * s, my).strokePath();
  } else if (st === 'sleep') {
    g.fillStyle(INK).fillCircle(mx, my, 1.4 * s);
  } else if (st === 'suspicious' || st === 'search' || st === 'investigate') {
    g.lineStyle(2, INK).lineBetween(mx - 3 * s, my, mx + 3 * s, my - 1 * s);
  } else {
    g.lineStyle(2, INK).beginPath().arc(mx, my - 2 * s, 3.5 * s, 0.15 * Math.PI, 0.85 * Math.PI).strokePath();
  }

  // near arm + held props
  const [nax, nay] = armEnd(1);
  limb(g, cx + 8 * s, armY, nax, nay, 3.5 * s, body);
  if (st === 'eating') drawMiniDonut(g, nax + face * 2 * s, nay - 2 * s, s);
  else if (a.kind === 'kid' && !reach) {
    g.lineStyle(1.5, 0xffffff).lineBetween(nax, nay, nax, nay - 9 * s);
    g.fillStyle(0xff4d8d).fillCircle(nax, nay - 11 * s, 3.5 * s);
    g.lineStyle(1, 0xffffff).beginPath().arc(nax, nay - 11 * s, 2 * s, 0, Math.PI * 1.5).strokePath();
  } else if (a.kind === 'heavy' && !reach) {
    g.fillStyle(0xe8b060).fillRoundedRect(nax - 5 * s, nay - 4 * s, 10 * s, 6 * s, 2 * s);
    g.fillStyle(0x6ad66a).fillRect(nax - 5 * s, nay - 1 * s, 10 * s, 1.5 * s);
  }

  // speed lines while chasing
  if (chase && a.speed > 120) {
    const back = -Math.sign(a.heading.x || -face);
    g.lineStyle(2, 0xffffff, 0.7);
    for (let k = 0; k < 3; k++) g.lineBetween(cx + back * (16 + k * 2) * s, cy - 8 * s + k * 7 * s, cx + back * (26 + k * 3) * s, cy - 8 * s + k * 7 * s);
  }
}

function drawMiniDonut(g: G, x: number, y: number, s: number): void {
  g.fillStyle(0xd99a52).fillCircle(x, y, 5 * s);
  g.fillStyle(0xff6eb4).fillCircle(x, y, 4 * s);
  g.fillStyle(0xd99a52).fillCircle(x, y, 1.5 * s);
}

function drawDrone(g: G, a: Alien, pose: AlienPose, t: number): void {
  const x = a.x, hover = 26 + Math.sin(t * 4 + a.id) * 3, y = a.y - hover;
  shadow(g, a.x, a.y, 26 * (1 - hover / 80));
  // propellers
  for (const d of [-1, 1]) {
    g.lineStyle(2, 0x445566).lineBetween(x + d * 6, y - 8, x + d * 15, y - 13);
    const blade = Math.abs(Math.cos(t * 40 + d));
    g.fillStyle(0xdde6f0, 0.7).fillEllipse(x + d * 15, y - 14, 18 * blade + 3, 3);
  }
  g.fillStyle(INK).fillRoundedRect(x - 14, y - 10, 28, 20, 9);
  g.fillStyle(0xb8c4d6).fillRoundedRect(x - 12.5, y - 8.5, 25, 17, 8);
  g.fillStyle(0x8894a8).fillRect(x - 12, y + 3, 24, 3);
  // siren
  const alert = a.sus > 0.4 || a.alarmT > 0;
  g.fillStyle(alert && Math.floor(t * 8) % 2 ? 0xff3355 : 0x884455).fillRoundedRect(x - 4, y - 15, 8, 6, 3);
  // camera eye looks where it's going (forwards: it's a robot)
  const lx = Math.cos(a.look), ly = Math.sin(a.look);
  const ex = x + pose.face * 5;
  g.fillStyle(INK).fillCircle(ex, y - 1, 6);
  g.fillStyle(alert ? 0xff3355 : 0x2299ff).fillCircle(ex + lx * 1.5, y - 1 + ly * 1.2, 4.5);
  g.fillStyle(0xffffff).fillCircle(ex + lx * 1.5 - 1.5, y - 2.5 + ly * 1.2, 1.4);
}

// -----------------------------------------------------------------------------
// Leo
// -----------------------------------------------------------------------------
export type Mood = 'calm' | 'nervous' | 'panic' | 'hugged' | 'smug';

export function drawLeo(g: G, p: Player, face: number, walk: number, mood: Mood, outfit: Outfit, t: number): void {
  if (p.invuln > 0 && Math.floor(t * 12) % 2 === 0) return;
  const s = 1;
  const moon = p.moonwalkT > 0;
  const toe = moon ? -face : face; // moonwalk: shoes on backwards, like a local!
  const hugged = mood === 'hugged';
  const x = p.x + (hugged ? Math.sin(t * 40) * 2 : 0), y = p.y;
  const stride = p.moving ? (p.running ? 1.3 : 0.9) : 0;
  const bob = p.moving ? Math.abs(Math.sin(walk)) * 2 : 0;
  const lean = p.running ? face * 2 : 0;

  shadow(g, x, y, 26);
  legs(g, x, y, s, toe, walk, stride, 0xffd2a8, moon ? 0xb04ae0 : 0xffffff, 0xff4d6d);

  const cx = x + lean, cy = y - 22 - bob;
  // shorts
  g.fillStyle(INK).fillRoundedRect(cx - 9.5, cy + 4.5, 19, 9, 3);
  g.fillStyle(outfit.shorts).fillRoundedRect(cx - 8.5, cy + 5, 17, 8, 3);
  // far arm
  const armY = cy - 2;
  const panicArms = mood === 'panic';
  const swing = p.moving ? Math.sin(walk) * 6 : 0;
  limb(g, cx - face * 6, armY, cx - face * 6 - swing * face, armY + (panicArms ? -12 : 10), 3.5, shade(0xffd2a8, 0.85));
  // Hawaiian shirt
  g.fillStyle(INK).fillRoundedRect(cx - 10.5, cy - 9.5, 21, 17, 6);
  g.fillStyle(outfit.shirt).fillRoundedRect(cx - 9.5, cy - 8.5, 19, 15, 5);
  g.fillStyle(outfit.flower);
  for (const [fx, fy] of [[-5, -4], [4, -1], [-2, 3], [6, -6]]) g.fillCircle(cx + fx, cy + fy, 1.8);
  g.fillStyle(0xffffff, 0.6).fillTriangle(cx - 3, cy - 8.5, cx + 3, cy - 8.5, cx, cy - 4);
  // head in a bubble helmet
  const hx = cx + face * 1, hy = cy - 17;
  g.fillStyle(0xffd2a8).fillCircle(hx, hy, 8.5);
  g.fillStyle(0x6a3c1a).fillEllipse(hx - face * 2, hy - 6, 14, 6);
  const ex = hx + face * 3.5, ey = hy - 1;
  if (hugged) {
    g.lineStyle(1.8, INK);
    for (const d of [-2.5, 2.5]) g.beginPath().arc(ex + d, ey, 1.8, 1.1 * Math.PI, 1.9 * Math.PI).strokePath();
    g.fillStyle(0xff7aa8, 0.7).fillCircle(ex - 5, ey + 3, 2).fillCircle(ex + 4, ey + 3, 2);
  } else {
    const r = mood === 'panic' ? 2.6 : 1.9;
    for (const d of [-2.5, 2.5]) {
      g.fillStyle(0xffffff).fillCircle(ex + d, ey, r + 0.6);
      g.fillStyle(INK).fillCircle(ex + d + face * 0.6, ey, mood === 'panic' ? 1.4 : 1.2);
    }
  }
  const mx = ex - face * 0.5, my = hy + 4;
  if (mood === 'panic') g.fillStyle(INK).fillEllipse(mx, my, 4, 4.5);
  else if (mood === 'smug' || hugged) g.lineStyle(1.6, INK).beginPath().arc(mx, my - 1.5, 2.6, 0.1 * Math.PI, 0.9 * Math.PI).strokePath();
  else if (mood === 'nervous') g.lineStyle(1.6, INK).lineBetween(mx - 2.5, my, mx + 2.5, my + 0.5);
  else g.lineStyle(1.6, INK).beginPath().arc(mx, my - 1, 2.2, 0.2 * Math.PI, 0.8 * Math.PI).strokePath();
  if (mood === 'nervous' || mood === 'panic') {
    const dy = (t * 20) % 8;
    g.fillStyle(0x8fd8ff).fillCircle(hx - face * 7, hy - 3 + dy, 1.8).fillTriangle(hx - face * 7 - 1.8, hy - 3 + dy, hx - face * 7 + 1.8, hy - 3 + dy, hx - face * 7, hy - 7 + dy);
  }
  // helmet glass
  g.lineStyle(2.5, 0xffffff, 0.9).strokeCircle(hx, hy, 11.5);
  g.fillStyle(0xbfe9ff, 0.22).fillCircle(hx, hy, 11.5);
  g.fillStyle(0xffffff, 0.75).fillEllipse(hx - 5, hy - 6, 5, 3);
  drawHat(g, hx, hy - 11.5, face, outfit.hat, t);
  // near arm
  limb(g, cx + face * 6, armY, cx + face * 6 + swing * face, armY + (panicArms ? -12 : 10), 3.5, 0xffd2a8);
  if (moon) {
    g.fillStyle(0xd9a6ff, 0.6);
    for (let k = 0; k < 3; k++) g.fillCircle(x - toe * (8 + k * 6), y - 2 - k * 2, 2 - k * 0.5);
  }
}

function drawHat(g: G, x: number, y: number, face: number, hat: Outfit['hat'], t: number): void {
  switch (hat) {
    case 'cap': // backwards, obviously
      g.fillStyle(0xff4d6d).fillEllipse(x, y + 2, 16, 8);
      g.fillStyle(0xd02a4a).fillRoundedRect(x - face * 13, y + 2, 9, 3, 1);
      break;
    case 'pineapple':
      g.fillStyle(0xffc23c).fillEllipse(x, y - 3, 12, 14);
      g.lineStyle(1, 0xc08a00).lineBetween(x - 4, y - 8, x + 4, y + 2).lineBetween(x + 4, y - 8, x - 4, y + 2);
      g.fillStyle(0x3ab054).fillTriangle(x - 5, y - 9, x, y - 18, x + 1, y - 9).fillTriangle(x - 1, y - 9, x + 5, y - 17, x + 5, y - 9);
      break;
    case 'crown':
      g.fillStyle(0xffd23c).fillPoints([
        new Phaser.Math.Vector2(x - 8, y + 3), new Phaser.Math.Vector2(x - 8, y - 5), new Phaser.Math.Vector2(x - 4, y - 1),
        new Phaser.Math.Vector2(x, y - 7), new Phaser.Math.Vector2(x + 4, y - 1), new Phaser.Math.Vector2(x + 8, y - 5), new Phaser.Math.Vector2(x + 8, y + 3),
      ], true);
      g.fillStyle(0xff4d6d).fillCircle(x, y - 1, 1.5);
      break;
    case 'propeller': {
      g.fillStyle(0x4ab0e8).fillEllipse(x, y + 1, 14, 7);
      g.lineStyle(1.5, INK).lineBetween(x, y - 2, x, y - 6);
      const b = Math.cos(t * 30) * 9;
      g.fillStyle(0xff4d6d).fillEllipse(x, y - 6, Math.abs(b) * 2 + 2, 2.5);
      break;
    }
    default:
      break;
  }
}

/** Hearts orbiting a hug. */
export function drawHearts(g: G, x: number, y: number, t: number): void {
  for (let i = 0; i < 5; i++) {
    const a = t * 3 + (i * Math.PI * 2) / 5, r = 26 + Math.sin(t * 6 + i) * 4;
    const hx = x + Math.cos(a) * r, hy = y - 30 + Math.sin(a) * r * 0.5;
    g.fillStyle(0xff4d8d).fillCircle(hx - 3, hy, 4).fillCircle(hx + 3, hy, 4).fillTriangle(hx - 7, hy + 1, hx + 7, hy + 1, hx, hy + 9);
  }
}

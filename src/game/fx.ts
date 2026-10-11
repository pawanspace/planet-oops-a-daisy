// =============================================================================
// 📘 LESSON: Particles — lots of tiny things that live for a moment
// =============================================================================
// Confetti, dust puffs, hearts, stars... are all PARTICLES: tiny objects with a position, a velocity, a lifetime
// and a look. Every frame each particle:
//     moves:          x += vx × dt,   y += vy × dt
//     feels gravity:  vy += gravity × dt        (confetti falls, hearts float up with negative gravity)
//     ages:           life -= dt                (and disappears at 0)
// A "burst" creates many at once, flying in random directions.
//
// 💡 EXAMPLE: a confetti piece starts with vy = -220 (flying up) and gravity 260. After 0.5 s, vy = -220 + 130
//    = -90: still rising but slowing down. After about 0.85 s it starts to fall. That's a nice arc!
// 🧪 TRY IT: in GameScene's 'win' case, change the confetti count from 60 to 600.
// 🧠 QUIZ Q23: Particles never change the game rules. Why is it fine that they use random numbers then?
// =============================================================================
import Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
export type ParticleKind = 'dust' | 'spark' | 'crumb' | 'heart' | 'star' | 'confetti' | 'note';

interface Particle {
  kind: ParticleKind; x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: number; gravity: number; spin: number;
}
interface Decal { x1: number; y1: number; x2: number; y2: number; age: number }

const CONFETTI = [0xff6eb4, 0xffd23c, 0x4ad6ff, 0x4ae07a, 0xff8c3c, 0xb98cff];

export class Fx {
  private parts: Particle[] = [];
  private decals: Decal[] = [];
  private seed = 1;

  private rnd(): number { // deterministic-ish, cheap
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  burst(kind: ParticleKind, x: number, y: number, n: number, opts: { color?: number; speed?: number; up?: number; life?: number; size?: number } = {}): void {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2, sp = (opts.speed ?? 80) * (0.4 + this.rnd() * 0.8);
      const life = (opts.life ?? 0.6) * (0.7 + this.rnd() * 0.6);
      this.parts.push({
        kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - (opts.up ?? 0), life, max: life,
        size: (opts.size ?? 3) * (0.7 + this.rnd() * 0.6),
        color: opts.color ?? (kind === 'confetti' ? CONFETTI[i % CONFETTI.length] : 0xffffff),
        gravity: kind === 'confetti' || kind === 'crumb' ? 260 : kind === 'dust' ? -20 : kind === 'heart' || kind === 'note' ? -40 : 0,
        spin: this.rnd() * 10,
      });
    }
  }

  skidMark(x1: number, y1: number, x2: number, y2: number): void {
    this.decals.push({ x1, y1, x2, y2, age: 0 });
    if (this.decals.length > 40) this.decals.shift();
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - dt * (p.kind === 'dust' ? 3 : 0.8);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 8;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const d of this.decals) d.age += dt;
    this.decals = this.decals.filter(d => d.age < 6);
  }

  drawDecals(g: G): void {
    g.clear();
    for (const d of this.decals) {
      const a = 0.35 * (1 - d.age / 6);
      g.lineStyle(5, 0x2a1f45, a).lineBetween(d.x1 - 4, d.y1, d.x2 - 4, d.y2).lineBetween(d.x1 + 4, d.y1 + 2, d.x2 + 4, d.y2 + 2);
    }
  }

  draw(g: G): void {
    for (const p of this.parts) {
      const k = p.life / p.max, s = p.size;
      switch (p.kind) {
        case 'dust':
          g.fillStyle(0xffffff, 0.55 * k).fillCircle(p.x, p.y, s * (1.6 - k * 0.6));
          break;
        case 'spark':
          g.fillStyle(p.color, k).fillRect(p.x - s / 2, p.y - s * 1.5, s, s * 3).fillRect(p.x - s * 1.5, p.y - s / 2, s * 3, s);
          break;
        case 'crumb':
          g.fillStyle(p.color, k).fillRect(p.x - s / 2, p.y - s / 2, s, s);
          break;
        case 'confetti': {
          const w = Math.abs(Math.cos(p.spin)) * s * 2 + 1;
          g.fillStyle(p.color, Math.min(1, k * 2)).fillRect(p.x - w / 2, p.y - s / 2, w, s);
          break;
        }
        case 'heart':
          g.fillStyle(0xff4d8d, k).fillCircle(p.x - s * 0.6, p.y, s * 0.7).fillCircle(p.x + s * 0.6, p.y, s * 0.7)
            .fillTriangle(p.x - s * 1.3, p.y + s * 0.2, p.x + s * 1.3, p.y + s * 0.2, p.x, p.y + s * 1.6);
          break;
        case 'star': {
          g.fillStyle(0xffe14a, k);
          const pts: Phaser.Math.Vector2[] = [];
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? s * 0.45 : s, a = p.spin + (i * Math.PI) / 5;
            pts.push(new Phaser.Math.Vector2(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r));
          }
          g.fillPoints(pts, true);
          break;
        }
        case 'note':
          g.fillStyle(0x2a1f45, k).fillEllipse(p.x, p.y, s * 1.6, s * 1.2);
          g.lineStyle(1.5, 0x2a1f45, k).lineBetween(p.x + s * 0.7, p.y, p.x + s * 0.7, p.y - s * 2.5);
          break;
      }
    }
  }
}

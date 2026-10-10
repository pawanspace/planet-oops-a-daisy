// Draws the app icon (a pink backwards-legged local on a daisy) at several sizes into public/icons/.
import { writeFileSync } from 'node:fs';
import { encodePng } from './png.mjs';

const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
// Shapes in a 0..1 unit square, painted in order.
const circle = (cx, cy, r, color) => ({ color, hit: (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r });
const ellipse = (cx, cy, rx, ry, color) => ({ color, hit: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 });
const capsule = (x1, y1, x2, y2, r, color) => ({
  color, hit: (x, y) => {
    const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    return (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2 <= r * r;
  },
});

const INK = 0x2a1f45, PINK = 0xff6eb4;
const shapes = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  shapes.push(circle(0.5 + Math.cos(a) * 0.3, 0.6 + Math.sin(a) * 0.3, 0.13, i % 2 ? 0xffffff : 0xf3ecff));
}
shapes.push(circle(0.5, 0.6, 0.27, 0xffd23c));
// legs pointing backwards (toes to the left while the face looks right)
shapes.push(capsule(0.44, 0.62, 0.39, 0.7, 0.03, 0xd45a9a), capsule(0.39, 0.7, 0.42, 0.78, 0.03, 0xd45a9a));
shapes.push(capsule(0.56, 0.62, 0.51, 0.7, 0.03, 0xd45a9a), capsule(0.51, 0.7, 0.54, 0.78, 0.03, 0xd45a9a));
shapes.push(ellipse(0.385, 0.795, 0.055, 0.03, INK), ellipse(0.505, 0.795, 0.055, 0.03, INK));
// body + antenna
shapes.push(capsule(0.5, 0.3, 0.55, 0.18, 0.012, INK), circle(0.555, 0.17, 0.035, 0xffe14a));
shapes.push(ellipse(0.5, 0.48, 0.2, 0.19, INK), ellipse(0.5, 0.48, 0.185, 0.175, PINK), ellipse(0.43, 0.41, 0.05, 0.03, 0xffb3d6));
// eyes looking right
for (const ex of [0.5, 0.6]) shapes.push(circle(ex, 0.45, 0.055, INK), circle(ex, 0.45, 0.046, 0xffffff), circle(ex + 0.018, 0.45, 0.022, INK));
shapes.push(ellipse(0.555, 0.535, 0.06, 0.045, INK), ellipse(0.555, 0.515, 0.068, 0.04, PINK)); // smile

function render(size, padding = 0) {
  const px = Buffer.alloc(size * size * 4), SS = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u0 = (x + (sx + 0.5) / SS) / size, v0 = (y + (sy + 0.5) / SS) / size;
      const u = (u0 - padding) / (1 - 2 * padding), v = (v0 - padding) / (1 - 2 * padding);
      // background: night sky gradient
      let c = [Math.round(42 + 40 * v0), Math.round(31 + 30 * v0), Math.round(69 + 60 * v0)];
      for (const s of shapes) if (s.hit(u, v)) c = hex(s.color);
      r += c[0]; g += c[1]; b += c[2];
    }
    const o = (y * size + x) * 4, n = SS * SS;
    px[o] = r / n; px[o + 1] = g / n; px[o + 2] = b / n; px[o + 3] = 255;
  }
  return encodePng(size, size, px);
}

for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.12], ['apple-touch-icon.png', 180, 0], ['favicon-32.png', 32, 0]]) {
  writeFileSync(`public/icons/${name}`, render(size, pad));
}
console.log('wrote public/icons/*');
